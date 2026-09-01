const mongoose = require('mongoose');

jest.mock('../models/Review', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../models/Order', () => ({ findById: jest.fn() }));
jest.mock('../models/User', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Service', () => ({}));

const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');
const reviewController = require('../controllers/reviewController');

/**
 * Regression guard for F-34.
 *
 * POST /api/reviews previously validated only `revieweeId` format and the rating range.
 * Any authenticated account could therefore post a 1-star review against any user and
 * permanently move their public averageRating. These tests pin the four eligibility
 * rules: a real order, reviewer is a participant, order is completed, and the reviewee
 * is the counterparty.
 */

const CUSTOMER = new mongoose.Types.ObjectId();
const PROVIDER = new mongoose.Types.ObjectId();
const STRANGER = new mongoose.Types.ObjectId();
const SERVICE = new mongoose.Types.ObjectId();
const ORDER = new mongoose.Types.ObjectId();

function mockOrder(overrides = {}) {
  const order = {
    _id: ORDER,
    customerId: CUSTOMER,
    providerId: PROVIDER,
    serviceId: SERVICE,
    status: 'completed',
    ...overrides,
  };
  Order.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(order) });
  return order;
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

/** Minimal thenable that also supports .populate() chaining. */
function chain(value) {
  const o = {
    populate: jest.fn(() => o),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return o;
}

function req(body, userId) {
  return { body, userId: String(userId), params: {} };
}

describe('createReview eligibility (F-34)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Review.find.mockResolvedValue([{ rating: 5 }]);
    Review.create.mockResolvedValue({ _id: 'rev1' });
    Review.findById.mockReturnValue(chain({ _id: 'rev1' }));
    User.findByIdAndUpdate.mockResolvedValue({});
  });

  const validBody = {
    orderId: String(ORDER),
    revieweeId: String(CUSTOMER),
    revieweeRole: 'seeker',
    rating: 5,
    comment: 'Bra jobb',
  };

  it('rejects a stranger who was not part of the order', async () => {
    mockOrder();
    const res = mockRes();
    await reviewController.createReview(req(validBody, STRANGER), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Review.create).not.toHaveBeenCalled();
  });

  it('rejects when the order is not completed', async () => {
    mockOrder({ status: 'in_progress' });
    const res = mockRes();
    await reviewController.createReview(req(validBody, PROVIDER), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Review.create).not.toHaveBeenCalled();
  });

  it('rejects reviewing someone who is not the counterparty', async () => {
    mockOrder();
    const res = mockRes();
    await reviewController.createReview(
      req({ ...validBody, revieweeId: String(STRANGER) }, PROVIDER),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Review.create).not.toHaveBeenCalled();
  });

  it('rejects a review with no order attached', async () => {
    const res = mockRes();
    await reviewController.createReview(
      req({ ...validBody, orderId: undefined }, PROVIDER),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Review.create).not.toHaveBeenCalled();
  });

  it('rejects when the order does not exist', async () => {
    Order.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res = mockRes();
    await reviewController.createReview(req(validBody, PROVIDER), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Review.create).not.toHaveBeenCalled();
  });

  it('allows the provider to review the customer on a completed order', async () => {
    mockOrder();
    const res = mockRes();
    await reviewController.createReview(req(validBody, PROVIDER), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Review.create).toHaveBeenCalledTimes(1);
  });

  it('takes serviceId from the order, not the request body', async () => {
    mockOrder();
    const res = mockRes();
    const forgedService = new mongoose.Types.ObjectId();
    await reviewController.createReview(
      req({ ...validBody, serviceId: String(forgedService) }, PROVIDER),
      res
    );

    expect(Review.create).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: SERVICE })
    );
  });
});

describe('getReviewByOrderId access control (F-34)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-participant', async () => {
    mockOrder();
    const res = mockRes();
    await reviewController.getReviewByOrderId(
      { params: { orderId: String(ORDER) }, userId: String(STRANGER) },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Review.find).not.toHaveBeenCalled();
  });

  it('allows a participant', async () => {
    mockOrder();
    Review.find.mockReturnValue(chain([]));
    const res = mockRes();
    await reviewController.getReviewByOrderId(
      { params: { orderId: String(ORDER) }, userId: String(CUSTOMER) },
      res
    );

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(Review.find).toHaveBeenCalledWith({ orderId: String(ORDER) });
  });
});
