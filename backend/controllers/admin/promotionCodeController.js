const crypto = require('crypto');
const Coupon = require('../../models/Coupon');
const { getStripe, getStripeModeReport } = require('../../config/stripe');

function bad(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function timestamp(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw bad('Utløpsdatoen er ugyldig.');
  if (date.getTime() <= Date.now()) throw bad('Utløpsdatoen må være i fremtiden.');
  return Math.floor(date.getTime() / 1000);
}

function input(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const type = body.type;
  const amount = Number(body.amount);
  const duration = body.duration;
  const usageLimit = Number(body.usageLimit || 0);

  if (!name || !code) throw bad('Navn og kode er påkrevd.');
  if (!['percentage', 'fixed'].includes(type)) throw bad('Rabatt-typen er ugyldig.');
  if (!Number.isFinite(amount) || amount <= 0 || (type === 'percentage' && amount > 100)) {
    throw bad('Rabattbeløpet er ugyldig.');
  }
  if (!['once', 'forever', 'repeating'].includes(duration)) throw bad('Varigheten er ugyldig.');
  if (!Number.isInteger(usageLimit) || usageLimit < 0) throw bad('Bruksgrensen er ugyldig.');

  const durationInMonths = body.durationInMonths == null ? null : Number(body.durationInMonths);
  if (duration === 'repeating' && (!Number.isInteger(durationInMonths) || durationInMonths <= 0)) {
    throw bad('Antall måneder må være et positivt heltall.');
  }

  const expiresAt = timestamp(body.expiresDate);
  const activeDate = body.activeDate ? new Date(body.activeDate) : null;
  if (activeDate && (Number.isNaN(activeDate.getTime()) || activeDate.getTime() > Date.now())) {
    throw bad('Stripe-koder kan ikke ha fremtidig aktivering.');
  }

  return { name, code, type, amount, duration, durationInMonths, usageLimit, expiresAt };
}

exports.listPromotionCodes = async (_req, res) => {
  try {
    const rows = await Coupon.find()
      .sort({ createdAt: -1 })
      .lean();
    const report = await getStripeModeReport();
    const stripe = await getStripe();
    const promotions = await Promise.all(rows.map(async (row) => {
      if (row.source !== 'stripe' || !row.stripePromotionCodeId) {
        return {
          ...row,
          source: 'legacy',
          redemptions: row.usedBy?.length || 0,
          maxRedemptions: row.usageLimit || 0,
        };
      }
      try {
        const promotion = await stripe.promotionCodes.retrieve(row.stripePromotionCodeId);
        return {
          ...row,
          stripeMode: row.stripeMode,
          active: Boolean(promotion.active),
          redemptions: promotion.times_redeemed || 0,
          maxRedemptions: promotion.max_redemptions || 0,
          expiresAt: promotion.expires_at || null,
        };
      } catch {
        return { ...row, active: false, redemptions: 0, maxRedemptions: row.usageLimit || 0, stripeUnavailable: true };
      }
    }));
    return res.json({ promotions, mode: report.keyMode, mismatch: report.mismatch });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createPromotionCode = async (req, res) => {
  let stripeCouponId = null;
  try {
    const values = input(req.body);
    if (req.body.targetPlanType && req.body.targetPlanType !== 'all') {
      throw bad('Stripe-rabattkoder gjelder foreløpig alle medlemsplaner.');
    }
    const existing = await Coupon.findOne({ code: values.code });
    if (existing) return res.status(409).json({ error: 'Kupongkoden finnes allerede.' });

    const stripe = await getStripe();
    const report = await getStripeModeReport();
    if (report.mismatch || !['test', 'live'].includes(report.keyMode)) {
      return res.status(503).json({ error: 'Stripe-modus er ikke konfigurert riktig.' });
    }

    const idempotencyKey = `promotion_create_${crypto.randomUUID()}`;
    const coupon = await stripe.coupons.create(
      {
        ...(values.type === 'percentage'
          ? { percent_off: values.amount }
          : { amount_off: Math.round(values.amount * 100), currency: 'nok' }),
        duration: values.duration,
        ...(values.duration === 'repeating' ? { duration_in_months: values.durationInMonths } : {}),
      },
      { idempotencyKey: `${idempotencyKey}_coupon` }
    );
    stripeCouponId = coupon.id;

    const promotion = await stripe.promotionCodes.create(
      {
        promotion: { type: 'coupon', coupon: stripeCouponId },
        code: values.code,
        active: req.body.active !== false,
        ...(values.usageLimit > 0 ? { max_redemptions: values.usageLimit } : {}),
        ...(values.expiresAt ? { expires_at: values.expiresAt } : {}),
      },
      { idempotencyKey: `${idempotencyKey}_promotion` }
    );

    const local = await Coupon.create({
      createdBy: req.user._id,
      name: values.name,
      code: values.code,
      type: values.type,
      amount: values.amount,
      usageLimit: values.usageLimit,
      targetPlanType: 'all',
      active: promotion.active,
      expiresDate: values.expiresAt ? new Date(values.expiresAt * 1000) : new Date('2099-12-31'),
      source: 'stripe',
      stripeCouponId,
      stripePromotionCodeId: promotion.id,
      stripeMode: report.keyMode,
      duration: values.duration,
      durationInMonths: values.durationInMonths,
    });

    return res.status(201).json(local);
  } catch (error) {
    if (stripeCouponId) {
      try {
        const stripe = await getStripe();
        await stripe.coupons.del(stripeCouponId);
      } catch {
        console.error('Promotion cleanup failed for Stripe coupon %s', stripeCouponId);
      }
    }
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.deactivatePromotionCode = async (req, res) => {
  try {
    const local = await Coupon.findOne({ _id: req.params.id, source: 'stripe' });
    if (!local) return res.status(404).json({ error: 'Stripe-rabattkode ble ikke funnet.' });
    const report = await getStripeModeReport();
    if (local.stripeMode !== report.keyMode) return res.status(409).json({ error: 'Rabattkoden tilhører en annen Stripe-modus.' });
    const stripe = await getStripe();
    const promotion = await stripe.promotionCodes.update(local.stripePromotionCodeId, { active: false });
    const updated = await Coupon.findByIdAndUpdate(local._id, { active: false }, { new: true });
    return res.json({ promotion: { ...updated.toObject(), active: promotion.active } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};
