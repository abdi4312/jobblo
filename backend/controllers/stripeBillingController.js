const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const {
  getStripeConfiguration,
  getStripeForMode,
} = require('../config/stripe');
const { customerFieldForMode } = require('../services/stripe/customers');
const { ensureStripePlanPrice } = require('../services/stripe/planPrice');
const {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applySubscriptionUpdated,
  subscriptionPeriodEnd,
  invoiceSubscriptionId,
} = require('../services/stripe/provisioning');
const { getStripeWebhookReadiness } = require('../services/stripe/webhookReadiness');
const { logActivity } = require('../services/admin/activityService');
const {
  getOrCreateBillingOperation,
  findActiveBillingOperation,
  finishBillingOperation,
  operationIdempotencyKey,
} = require('../services/stripe/billingOperations');

const objectId = (value) => mongoose.Types.ObjectId.isValid(value);
const idOf = (value) => (typeof value === 'string' ? value : value?.id || null);
const stripeMode = (testMode) => (testMode ? 'test' : 'live');

async function modeForSubscription(current) {
  if (current?.stripeMode === 'test' || current?.stripeMode === 'live') {
    return current.stripeMode === 'test';
  }
  return (await getStripeConfiguration()).testMode;
}

async function ownedSubscriptionContext(userId) {
  const [record, user] = await Promise.all([
    Subscription.findOne({ userId }),
    User.findById(userId),
  ]);
  if (!user) return { error: 'user_not_found' };
  const current = record?.currentPlan;
  if (!current?.stripeSubscriptionId) return { error: 'subscription_not_found', record, user };

  const testMode = await modeForSubscription(current);
  const stripe = await getStripeForMode(testMode);
  const live = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
  const customerId = idOf(live.customer);
  const expectedCustomerId = user[await customerFieldForMode(testMode)];
  if (!customerId || !expectedCustomerId || customerId !== expectedCustomerId) {
    return { error: 'subscription_customer_mismatch', record, user, stripe, testMode };
  }
  return { record, current, user, stripe, testMode, live };
}

function safeBillingError(error, operation) {
  console.error(`${operation} failed [code=%s]`, error?.code || error?.type || 'stripe_error');
}

exports.createPortalSession = async (req, res) => {
  try {
    const context = await ownedSubscriptionContext(req.userId);
    if (context.error) {
      const statusCode =
        context.error === 'user_not_found'
          ? 404
          : context.error === 'subscription_customer_mismatch'
            ? 409
            : 400;
      return res.status(statusCode).json({
        message: 'Et aktivt Stripe-abonnement ble ikke funnet.',
      });
    }
    const origin = process.env.FRONTEND_URL?.trim().replace(/\/$/, '');
    if (!origin || !/^https?:\/\//i.test(origin)) {
      return res.status(503).json({ message: 'Abonnementsadministrasjon er ikke tilgjengelig.' });
    }
    const customer = await context.user[
      await customerFieldForMode(context.testMode)
    ];
    const session = await context.stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/membership`,
    });
    res.json({ url: session.url });
  } catch (error) {
    safeBillingError(error, 'Stripe billing portal');
    res.status(503).json({ message: 'Kunne ikke åpne abonnementsadministrasjonen.' });
  }
};

exports.getBillingHistory = async (req, res) => {
  try {
    const mode = req.query.mode || 'all';
    if (!['all', 'test', 'live'].includes(mode)) {
      return res.status(400).json({ message: 'Ugyldig Stripe-modus.' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Brukeren ble ikke funnet.' });

    const payments = await Transaction.find({
      userId: req.userId,
      type: 'subscription',
      ...(mode === 'all' ? {} : { livemode: mode === 'live' }),
    })
      .select('stripeSessionId planName planType amount currency status livemode createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const modes = mode === 'all' ? [false, true] : [mode === 'test'];
    const invoices = [];
    let paymentMethod = null;
    let billingAddress = null;
    const active = (await Subscription.findOne({ userId: req.userId }).select('currentPlan').lean())
      ?.currentPlan;
    const activeTestMode =
      active?.stripeMode === 'test'
        ? true
        : active?.stripeMode === 'live'
          ? false
          : active?.stripeSubscriptionId
            ? (await getStripeConfiguration()).testMode
            : null;

    for (const testMode of modes) {
      const customerId = user[await customerFieldForMode(testMode)];
      if (!customerId) continue;
      const stripe = await getStripeForMode(testMode);
      const [customer, invoicePage] = await Promise.all([
        stripe.customers.retrieve(customerId, {
          expand: ['invoice_settings.default_payment_method'],
        }),
        stripe.invoices.list({ customer: customerId, limit: 30 }),
      ]);
      if (customer.deleted) continue;
      billingAddress ||= customer.address || null;
      if (activeTestMode === testMode && !paymentMethod) {
        const sub = active.stripeSubscriptionId
          ? await stripe.subscriptions.retrieve(active.stripeSubscriptionId, {
              expand: ['default_payment_method'],
            })
          : null;
        const method =
          sub?.default_payment_method || customer.invoice_settings?.default_payment_method;
        if (method && typeof method !== 'string') {
          paymentMethod = {
            brand: method.card?.brand || null,
            last4: method.card?.last4 || null,
            expMonth: method.card?.exp_month || null,
            expYear: method.card?.exp_year || null,
          };
        }
      }
      invoices.push(
        ...invoicePage.data.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          createdAt: invoice.created ? new Date(invoice.created * 1000) : null,
          amountPaid: invoice.amount_paid,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          status: invoice.status,
          mode: testMode ? 'test' : 'live',
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          hasPdf: Boolean(invoice.invoice_pdf),
        }))
      );
    }

    invoices.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({
      payments: payments.map((payment) => ({
        id: payment.stripeSessionId,
        plan: payment.planName,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        mode: payment.livemode === null ? 'unknown' : payment.livemode ? 'live' : 'test',
        createdAt: payment.createdAt,
      })),
      invoices: invoices.slice(0, 50),
      paymentMethod,
      billingAddress,
    });
  } catch (error) {
    safeBillingError(error, 'Stripe billing history');
    res.status(503).json({ message: 'Kunne ikke hente faktura- og betalingshistorikken.' });
  }
};

exports.downloadInvoicePdf = async (req, res) => {
  try {
    const mode = req.query.mode;
    if (!['test', 'live'].includes(mode)) {
      return res.status(400).json({ message: 'Ugyldig Stripe-modus.' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Faktura ble ikke funnet.' });
    const testMode = mode === 'test';
    const customerId = user[await customerFieldForMode(testMode)];
    if (!customerId) return res.status(404).json({ message: 'Faktura ble ikke funnet.' });
    const stripe = await getStripeForMode(testMode);
    const invoice = await stripe.invoices.retrieve(req.params.invoiceId);
    if (idOf(invoice.customer) !== customerId || !invoice.invoice_pdf) {
      return res.status(404).json({ message: 'Faktura ble ikke funnet.' });
    }
    res.json({ url: invoice.invoice_pdf });
  } catch (error) {
    safeBillingError(error, 'Stripe invoice download');
    res.status(404).json({ message: 'Faktura ble ikke funnet.' });
  }
};

async function resolveChange(req) {
  if (!objectId(req.body?.planId)) return { error: 'invalid_plan' };
  const context = await ownedSubscriptionContext(req.userId);
  if (context.error) return { error: context.error };
  const plan = await SubscriptionPlan.findById(req.body.planId);
  if (!plan || !plan.isActive || plan.price <= 0) return { error: 'invalid_plan' };
  const allowed = context.user.role === 'company' ? 'business' : 'private';
  if (plan.type !== allowed || plan.type !== context.current.planType) {
    return { error: 'plan_type_not_allowed' };
  }
  if (!['active', 'trialing'].includes(context.live.status)) {
    return { error: 'subscription_not_active' };
  }
  if (context.live.cancel_at_period_end) return { error: 'subscription_canceling' };

  const items = context.live.items?.data || [];
  if (items.length !== 1) return { error: 'unsupported_subscription_items' };
  const item = items[0];
  const targetPriceId = await ensureStripePlanPrice(
    context.stripe,
    plan,
    context.testMode
  );
  const targetPrice = await context.stripe.prices.retrieve(targetPriceId);
  const currentAmount = item.price?.unit_amount;
  if (!Number.isInteger(currentAmount) || !Number.isInteger(targetPrice.unit_amount)) {
    return { error: 'unsupported_subscription_price' };
  }
  return {
    ...context,
    plan,
    item,
    targetPrice,
    strategy: targetPrice.unit_amount >= currentAmount ? 'immediate' : 'period_end',
  };
}

function changeError(res, error) {
  const responses = {
    invalid_plan: [400, 'Velg en gyldig, aktiv betalt plan.'],
    plan_type_not_allowed: [403, 'Denne planen er ikke tilgjengelig for kontotypen din.'],
    subscription_not_found: [404, 'Et aktivt abonnement ble ikke funnet.'],
    user_not_found: [404, 'Brukeren ble ikke funnet.'],
    subscription_customer_mismatch: [409, 'Abonnementet kunne ikke verifiseres. Kontakt support.'],
    subscription_not_active: [409, 'Bare et aktivt abonnement kan endres.'],
    subscription_canceling: [409, 'Gjenoppta abonnementet før du endrer planen.'],
    unsupported_subscription_items: [409, 'Denne abonnementstypen må endres i Stripe Portal.'],
    unsupported_subscription_price: [409, 'Abonnementsprisen kunne ikke verifiseres.'],
  };
  const [status, message] = responses[error] || [503, 'Planen kunne ikke endres nå. Prøv igjen.'];
  return res.status(status).json({ message, code: error });
}

exports.previewPlanChange = async (req, res) => {
  try {
    const change = await resolveChange(req);
    if (change.error) return changeError(res, change.error);
    if (String(change.current.planId || '') === String(change.plan._id)) {
      return res.json({ strategy: 'no_change', amountDueNow: 0, currency: 'nok' });
    }
    if (change.strategy === 'period_end') {
      return res.json({
        strategy: 'period_end',
        effectiveAt: subscriptionPeriodEnd(change.live),
        amountDueNow: 0,
        currentPlan: change.current.plan,
        targetPlan: change.plan.name,
      });
    }
    const customer = idOf(change.live.customer);
    const preview = await change.stripe.invoices.createPreview({
      customer,
      subscription: change.live.id,
      subscription_details: {
        items: [{ id: change.item.id, price: change.targetPrice.id }],
        proration_behavior: 'always_invoice',
      },
    });
    res.json({
      strategy: 'immediate',
      effectiveAt: new Date(),
      amountDueNow: preview.amount_due,
      currency: preview.currency || 'nok',
      currentPlan: change.current.plan,
      targetPlan: change.plan.name,
      currentPrice: change.item.price.unit_amount,
      targetPrice: change.targetPrice.unit_amount,
    });
  } catch (error) {
    safeBillingError(error, 'Stripe plan change preview');
    res.status(503).json({ message: 'Kunne ikke beregne prisjusteringen. Prøv igjen.' });
  }
};

exports.changePlan = async (req, res) => {
  try {
    const change = await resolveChange(req);
    if (change.error) return changeError(res, change.error);
    if (String(change.current.planId || '') === String(change.plan._id)) {
      return res.json({ message: 'Dette er allerede planen din.', strategy: 'no_change' });
    }
    if (change.strategy === 'immediate') {
      if (change.item.price.id === change.targetPrice.id) {
        return res.json({ message: 'Denne planen behandles allerede av Stripe.', strategy: 'no_change' });
      }
      const fingerprint = `${stripeMode(change.testMode)}:${change.live.id}:upgrade:${change.item.price.id}:${change.targetPrice.id}`;
      const operation = await getOrCreateBillingOperation({
        fingerprint,
        operationType: 'upgrade',
        userId: req.userId,
        subscriptionId: change.live.id,
        targetPlanId: change.plan._id,
        testMode: change.testMode,
      });
      try {
        await change.stripe.subscriptions.update(
          change.live.id,
          {
            items: [{ id: change.item.id, price: change.targetPrice.id }],
            proration_behavior: 'always_invoice',
            payment_behavior: 'error_if_incomplete',
            metadata: {
              ...change.live.metadata,
              userId: String(req.userId),
              planId: String(change.plan._id),
              planType: change.plan.type,
            },
          },
          { idempotencyKey: operationIdempotencyKey(operation) }
        );
        const verified = await change.stripe.subscriptions.retrieve(change.live.id, {
          expand: ['items.data.price'],
        });
        const verifiedPriceId = verified.items?.data?.[0]?.price?.id;
        if (verifiedPriceId !== change.targetPrice.id) {
          throw new Error('Stripe subscription update has not reached the requested plan.');
        }
        await finishBillingOperation(operation, 'succeeded', { stripeObjectId: verified.id });
      } catch (error) {
        await finishBillingOperation(operation, 'reconciliation_required', {
          failureCode: error?.code || error?.type || 'stripe_upgrade_outcome_unknown',
        });
        throw error;
      }
      return res.json({
        message: 'Oppgraderingen er betalt og behandles. Planfordelene oppdateres når Stripe bekrefter endringen.',
        strategy: 'immediate',
      });
    }

    if (
      change.record.pendingPlan &&
      String(change.record.pendingPlan.planId || '') === String(change.plan._id)
    ) {
      const scheduleId = idOf(change.live.schedule);
      if (!scheduleId) {
        return res.status(409).json({
          message: 'Den planlagte endringen kunne ikke bekreftes. Kontakt support.',
          code: 'pending_plan_change_unverified',
        });
      }
      const schedule = await change.stripe.subscriptionSchedules.retrieve(scheduleId);
      if (
        schedule.metadata?.jobbloPendingPlanId !== String(change.plan._id) ||
        schedule.metadata?.jobbloUserId !== String(req.userId)
      ) {
        return res.status(409).json({
          message: 'Et annet planbytte er allerede planlagt. Administrer det i Stripe Portal.',
          code: 'pending_plan_change_exists',
        });
      }
      const fingerprint = `${stripeMode(change.testMode)}:${change.live.id}:downgrade:${change.item.price.id}:${change.targetPrice.id}`;
      const activeOperation = await findActiveBillingOperation(fingerprint);
      if (activeOperation) {
        await finishBillingOperation(activeOperation, 'succeeded', { stripeObjectId: schedule.id });
      }
      return res.json({
        message: `Planen endres til ${change.plan.name} ved neste periode.`,
        strategy: 'period_end',
        effectiveAt: change.record.pendingPlan.effectiveAt,
      });
    }
    if (change.record.pendingPlan) {
      return res.status(409).json({
        message: 'Du har allerede en planendring som venter. Administrer den i Stripe Portal.',
        code: 'pending_plan_change_exists',
      });
    }
    const periodEnd = subscriptionPeriodEnd(change.live);
    if (!periodEnd || periodEnd.getTime() <= Date.now()) {
      return res.status(409).json({
        message: 'Kunne ikke bekrefte sluttdatoen for perioden. Prøv igjen senere.',
        code: 'billing_period_unavailable',
      });
    }
    let schedule;
    const fingerprint = `${stripeMode(change.testMode)}:${change.live.id}:downgrade:${change.item.price.id}:${change.targetPrice.id}`;
    const activeOperation = await findActiveBillingOperation(fingerprint);
    const operation = activeOperation || await getOrCreateBillingOperation({
      fingerprint,
      operationType: 'downgrade',
      userId: req.userId,
      subscriptionId: change.live.id,
      targetPlanId: change.plan._id,
      testMode: change.testMode,
    });
    const attachedScheduleId = idOf(change.live.schedule);
    if (attachedScheduleId) {
      schedule = await change.stripe.subscriptionSchedules.retrieve(attachedScheduleId);
      if (
        (schedule.metadata?.jobbloPendingPlanId !== String(change.plan._id) ||
          schedule.metadata?.jobbloUserId !== String(req.userId)) &&
        !activeOperation
      ) {
        await finishBillingOperation(operation, 'failed', {
          failureCode: 'unrelated_subscription_schedule',
        });
        return res.status(409).json({
          message: 'Et annet planbytte er allerede planlagt. Administrer det i Stripe Portal.',
          code: 'pending_plan_change_exists',
        });
      }
      if (
        activeOperation &&
        (schedule.metadata?.jobbloPendingPlanId !== String(change.plan._id) ||
          schedule.metadata?.jobbloUserId !== String(req.userId))
      ) {
        try {
          const recovered = await change.stripe.subscriptionSchedules.create(
            { from_subscription: change.live.id },
            { idempotencyKey: operationIdempotencyKey(operation, 'schedule_create') }
          );
          if (recovered.id !== attachedScheduleId) {
            throw new Error('Stripe returned a different schedule during recovery.');
          }
          schedule = recovered;
        } catch (error) {
          await finishBillingOperation(operation, 'reconciliation_required', {
            failureCode: error?.code || error?.type || 'stripe_downgrade_schedule_unresolved',
          });
          throw error;
        }
      }
    } else {
      try {
        schedule = await change.stripe.subscriptionSchedules.create(
          { from_subscription: change.live.id },
          { idempotencyKey: operationIdempotencyKey(operation, 'schedule_create') }
        );
      } catch (error) {
        await finishBillingOperation(operation, 'reconciliation_required', {
          failureCode: error?.code || error?.type || 'stripe_downgrade_schedule_outcome_unknown',
        });
        throw error;
      }
    }
    try {
      await change.stripe.subscriptionSchedules.update(
        schedule.id,
        {
          end_behavior: 'release',
          metadata: {
            ...schedule.metadata,
            jobbloPendingPlanId: String(change.plan._id),
            jobbloUserId: String(req.userId),
            jobbloBillingOperationId: operation.operationId,
          },
          phases: [
            {
              items: [{ price: change.item.price.id, quantity: change.item.quantity || 1 }],
              start_date: schedule.current_phase?.start_date || change.live.start_date,
              end_date: Math.floor(periodEnd.getTime() / 1000),
              proration_behavior: 'none',
            },
            {
              items: [{ price: change.targetPrice.id, quantity: change.item.quantity || 1 }],
              iterations: 1,
              proration_behavior: 'none',
              metadata: {
                userId: String(req.userId),
                planId: String(change.plan._id),
                planType: change.plan.type,
              },
            },
          ],
        },
        { idempotencyKey: operationIdempotencyKey(operation, 'schedule_update') }
      );
    } catch (error) {
      await finishBillingOperation(operation, 'reconciliation_required', {
        failureCode: error?.code || error?.type || 'stripe_downgrade_schedule_update_unknown',
      });
      throw error;
    }
    change.record.pendingPlan = {
      planId: change.plan._id,
      plan: change.plan.name,
      planType: change.plan.type,
      effectiveAt: periodEnd,
      stripeMode: stripeMode(change.testMode),
    };
    await change.record.save();
    await finishBillingOperation(operation, 'succeeded', { stripeObjectId: schedule.id });
    res.json({
      message: `Planen endres til ${change.plan.name} ved neste periode.`,
      strategy: 'period_end',
      effectiveAt: periodEnd,
    });
  } catch (error) {
    safeBillingError(error, 'Stripe plan change');
    res.status(503).json({ message: 'Kunne ikke endre abonnementet. Prøv igjen.' });
  }
};

exports.getAdminSummary = async (req, res) => {
  try {
    const mode = req.query.mode || 'all';
    if (!['all', 'test', 'live'].includes(mode)) {
      return res.status(400).json({ message: 'Ugyldig Stripe-modus.' });
    }
    const match =
      mode === 'all'
        ? { 'currentPlan.stripeSubscriptionId': { $exists: true, $ne: null } }
        : {
            'currentPlan.stripeSubscriptionId': { $exists: true, $ne: null },
            'currentPlan.stripeMode': mode,
          };
    const [subscribers, statuses, failures, readiness] = await Promise.all([
      Subscription.countDocuments(match),
      Subscription.aggregate([
        { $match: match },
        { $group: { _id: '$currentPlan.status', count: { $sum: 1 } } },
      ]),
      Transaction.find({
        type: 'subscription',
        status: 'failed',
        ...(mode === 'all' ? {} : { livemode: mode === 'live' }),
      })
        .select('userId planName amount currency livemode stripeSessionId createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      getStripeWebhookReadiness(),
    ]);
    res.json({ mode, subscribers, statuses, failedInvoices: failures, webhookReadiness: readiness });
  } catch (error) {
    safeBillingError(error, 'Admin subscription billing summary');
    res.status(503).json({ message: 'Kunne ikke hente abonnementsoversikten.' });
  }
};

exports.reconcileSubscriptions = async (req, res) => {
  try {
    const { mode, cursorUserId } = req.body || {};
    const limit = Number(req.body?.limit || 10);
    if (!['test', 'live'].includes(mode)) {
      return res.status(400).json({ message: 'Velg test eller live-modus.' });
    }
    if (cursorUserId && !objectId(cursorUserId)) {
      return res.status(400).json({ message: 'Ugyldig avstemmingsmarkør.' });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return res.status(400).json({ message: 'Velg mellom 1 og 20 abonnementer per avstemming.' });
    }
    const testMode = mode === 'test';
    const stripe = await getStripeForMode(testMode);
    const query = {
      'currentPlan.stripeSubscriptionId': { $exists: true, $ne: null },
      $or: [
        { 'currentPlan.stripeMode': mode },
        { 'currentPlan.stripeMode': { $exists: false } },
        { 'currentPlan.stripeMode': null },
      ],
      ...(cursorUserId ? { userId: { $gt: cursorUserId } } : {}),
    };
    const records = await Subscription.find(query)
      .select('userId currentPlan.stripeSubscriptionId')
      .sort({ userId: 1 })
      .limit(limit)
      .lean();
    const results = [];
    for (const record of records) {
      try {
        const live = await stripe.subscriptions.retrieve(record.currentPlan.stripeSubscriptionId);
        if (typeof live.livemode === 'boolean' && live.livemode === testMode) {
          results.push({ userId: String(record.userId), status: 'mode_mismatch' });
          continue;
        }
        const owner = await User.findById(record.userId)
          .select('stripeCustomerId stripeCustomerIdTest')
          .lean();
        const ownerCustomer = owner?.[await customerFieldForMode(testMode)];
        if (!ownerCustomer || idOf(live.customer) !== ownerCustomer) {
          results.push({ userId: String(record.userId), status: 'customer_mismatch' });
          continue;
        }
        await applySubscriptionUpdated({ id: live.id, livemode: !testMode });
        const customerId = idOf(live.customer);
        if (customerId) {
          const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
          for (const invoice of invoices.data) {
            if (invoiceSubscriptionId(invoice) !== live.id) continue;
            if (invoice.status === 'paid') {
              const applied = await applyInvoicePaid(invoice);
              if (!applied.ok) throw new Error('Invoice reconciliation did not complete');
            } else if (invoice.status === 'open' && invoice.attempted) {
              const applied = await applyInvoicePaymentFailed(invoice);
              if (!applied.ok) throw new Error('Failed invoice reconciliation did not complete');
            }
          }
        }
        results.push({ userId: String(record.userId), status: 'synchronized' });
      } catch (error) {
        safeBillingError(error, 'Stripe subscription reconciliation item');
        results.push({ userId: String(record.userId), status: 'failed' });
      }
    }
    const lastUserId = records.at(-1)?.userId;
    const hasMore = records.length === limit;
    await logActivity({
      adminId: req.userId,
      action: 'other',
      description: `Read-only Stripe subscription reconciliation (${mode})`,
      metadata: { mode, count: results.length, failed: results.filter((r) => r.status === 'failed').length },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    res.json({
      mode,
      results,
      synchronized: results.filter((item) => item.status === 'synchronized').length,
      nextCursorUserId: hasMore && lastUserId ? String(lastUserId) : null,
    });
  } catch (error) {
    safeBillingError(error, 'Stripe subscription reconciliation');
    res.status(503).json({ message: 'Avstemming kunne ikke gjennomføres.' });
  }
};
