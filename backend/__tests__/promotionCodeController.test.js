jest.mock('../models/Coupon', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../config/stripe', () => ({
  getStripe: jest.fn(),
  getStripeModeReport: jest.fn(),
}));

const Coupon = require('../models/Coupon');
const { getStripe, getStripeModeReport } = require('../config/stripe');
const controller = require('../controllers/admin/promotionCodeController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(body = {}) {
  return { body, user: { _id: 'admin_1' } };
}

let stripe;

beforeEach(() => {
  jest.clearAllMocks();
  Coupon.findOne.mockResolvedValue(null);
  Coupon.create.mockResolvedValue({ _id: 'local_1' });
  getStripeModeReport.mockResolvedValue({ keyMode: 'test', mismatch: false });
  stripe = {
    coupons: {
      create: jest.fn().mockResolvedValue({ id: 'coupon_1' }),
      del: jest.fn().mockResolvedValue({}),
    },
    promotionCodes: {
      create: jest.fn().mockResolvedValue({ id: 'promo_1', active: true }),
      update: jest.fn().mockResolvedValue({ active: false }),
    },
  };
  getStripe.mockResolvedValue(stripe);
});

describe('Stripe promotion code admin controller', () => {
  it('creates a percentage promotion in the selected Stripe mode', async () => {
    const res = response();
    await controller.createPromotionCode(request({
      name: 'Welcome 20', code: ' jobblo20 ', type: 'percentage', amount: 20,
      duration: 'once', usageLimit: 100, expiresDate: '2099-12-31', targetPlanType: 'all', active: true,
    }), res);

    expect(res.statusCode).toBe(201);
    expect(stripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({ percent_off: 20, duration: 'once' }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
    expect(stripe.promotionCodes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        promotion: { type: 'coupon', coupon: 'coupon_1' },
        code: 'JOBBLO20', max_redemptions: 100,
        expires_at: expect.any(Number),
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
    expect(Coupon.create).toHaveBeenCalledWith(expect.objectContaining({
      source: 'stripe', stripeMode: 'test', targetPlanType: 'all',
      stripeCouponId: 'coupon_1', stripePromotionCodeId: 'promo_1',
    }));
  });

  it('maps fixed NOK amounts and repeating duration', async () => {
    const res = response();
    await controller.createPromotionCode(request({
      name: 'Fixed', code: 'fixed10', type: 'fixed', amount: 10.5,
      duration: 'repeating', durationInMonths: 3, usageLimit: 0,
    }), res);

    expect(stripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount_off: 1050, currency: 'nok', duration: 'repeating', duration_in_months: 3 }),
      expect.any(Object)
    );
    expect(stripe.promotionCodes.create.mock.calls[0][0]).not.toHaveProperty('max_redemptions');
  });

  it('rejects scoped plan types because dynamic price_data has no stable Stripe product restriction', async () => {
    const res = response();
    await controller.createPromotionCode(request({
      name: 'Private only', code: 'private', type: 'percentage', amount: 10,
      duration: 'forever', targetPlanType: 'private',
    }), res);

    expect(res.statusCode).toBe(400);
    expect(stripe.coupons.create).not.toHaveBeenCalled();
  });

  it('rejects future activation and duplicate codes', async () => {
    const future = response();
    await controller.createPromotionCode(request({
      name: 'Future', code: 'future', type: 'percentage', amount: 10,
      duration: 'forever', activeDate: '2099-01-01',
    }), future);
    expect(future.statusCode).toBe(400);

    Coupon.findOne.mockResolvedValue({ _id: 'existing' });
    const duplicate = response();
    await controller.createPromotionCode(request({
      name: 'Duplicate', code: 'JOBBLO20', type: 'percentage', amount: 10,
      duration: 'forever',
    }), duplicate);
    expect(duplicate.statusCode).toBe(409);
    expect(stripe.coupons.create).not.toHaveBeenCalled();
  });

  it('cleans up the Stripe coupon when promotion creation fails', async () => {
    stripe.promotionCodes.create.mockRejectedValue(new Error('promotion failed'));
    const res = response();
    await controller.createPromotionCode(request({
      name: 'Broken', code: 'broken', type: 'percentage', amount: 10,
      duration: 'forever',
    }), res);

    expect(res.statusCode).toBe(500);
    expect(stripe.coupons.del).toHaveBeenCalledWith('coupon_1');
  });

  it('deactivates a Stripe promotion without deleting local history', async () => {
    Coupon.findOne.mockResolvedValue({
      _id: 'local_1', source: 'stripe', stripeMode: 'test', stripePromotionCodeId: 'promo_1',
    });
    Coupon.findByIdAndUpdate.mockResolvedValue({ _id: 'local_1', toObject: () => ({ active: false }) });
    const res = response();
    await controller.deactivatePromotionCode({ params: { id: 'local_1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(stripe.promotionCodes.update).toHaveBeenCalledWith('promo_1', { active: false });
    expect(Coupon.findByIdAndUpdate).toHaveBeenCalledWith('local_1', { active: false }, { new: true });
  });
});
