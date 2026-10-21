/**
 * PUT /api/admin/orders/:id/status (cancel) used an unconditional findByIdAndUpdate, so an
 * admin could cancel a PAID order with no refund and strand the captured money (payout
 * refuses cancelled orders). It now goes through transitionOrder: the transition table,
 * the active-dispute freeze, "held money needs a refund or payout", and a CAS.
 * Real orderState logic; models mocked.
 */
const captured = {};
jest.mock('../utils/apiResponse', () => ({
  asyncHandler: (fn) => fn,
  sendSuccess: jest.fn((res, data) => { captured.success = data; return res; }),
  sendError: jest.fn((res, message, status) => { captured.error = { message, status }; return res; }),
  buildPagination: jest.fn(),
}));
jest.mock('../utils/pagination', () => ({ parsePagination: jest.fn(), parseObjectId: jest.fn((v) => v), parseSort: jest.fn(), parseDate: jest.fn() }));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));
jest.mock('../models/Order', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Payment', () => ({ findOne: jest.fn() }));
jest.mock('../models/Payout', () => ({ findOne: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));

const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Dispute = require('../models/Dispute');
const { updateOrderStatus } = require('../controllers/admin/ordersAdminController');

let current;
function setOrder(fields) {
  current = { _id: 'order_1', status: 'awaiting_payment', paymentStatus: 'unpaid', checkoutSessionStatus: null, ...fields };
  // findById is used both with .select().lean() (controller) and awaited directly (transitionOrder).
  Order.findById.mockImplementation(() => {
    const value = { ...current };
    return { select: () => ({ lean: async () => value }), lean: async () => value, then: (r, j) => Promise.resolve(value).then(r, j) };
  });
  Order.findOneAndUpdate.mockImplementation(async (filter, update) =>
    filter.status.$in.includes(current.status) ? (current = { ...current, ...update.$set }) : null
  );
}
const cancel = () => updateOrderStatus(
  { params: { id: 'order_1' }, body: { status: 'cancelled', adminNote: 'kunden trakk seg' }, user: { _id: 'admin_1' }, ip: '1', headers: {} },
  {}
);

beforeEach(() => {
  jest.clearAllMocks();
  captured.success = null;
  captured.error = null;
  Dispute.findOne.mockResolvedValue(null);
  Payment.findOne.mockResolvedValue(null);
});

it('refuses to cancel a paid order whose money has not been refunded', async () => {
  setOrder({ status: 'paid', paymentStatus: 'paid', checkoutSessionStatus: 'complete' });
  Payment.findOne.mockResolvedValue({ status: 'completed' });
  await cancel();
  expect(captured.error).toMatchObject({ status: 409 });
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  expect(current.status).toBe('paid');
});

it('cancels an unpaid order through a compare-and-swap on its current status', async () => {
  setOrder({ status: 'awaiting_payment', checkoutSessionStatus: 'expired' });
  await cancel();
  expect(captured.error).toBeNull();
  expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: 'order_1', status: { $in: ['awaiting_payment'] } },
    expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelled' }) }),
    { new: true }
  );
  expect(current.status).toBe('cancelled');
});

it('refuses while a checkout is open, because the customer may be paying right now', async () => {
  setOrder({ status: 'awaiting_payment', checkoutSessionStatus: 'open' });
  await cancel();
  expect(captured.error).toMatchObject({ status: 409 });
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
});

it('refuses while a dispute is active', async () => {
  setOrder({ status: 'in_progress', paymentStatus: 'paid', checkoutSessionStatus: 'complete' });
  Dispute.findOne.mockResolvedValue({ _id: 'd1' });
  await cancel();
  expect(captured.error).toMatchObject({ status: 409 });
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
});

it('allows cancelling a paid order once its payment was refunded', async () => {
  setOrder({ status: 'paid', paymentStatus: 'refunded', checkoutSessionStatus: 'complete' });
  Payment.findOne.mockResolvedValue({ status: 'refunded' });
  await cancel();
  expect(captured.error).toBeNull();
  expect(current.status).toBe('cancelled');
});

it('refuses illegal transitions such as cancelling a completed order', async () => {
  setOrder({ status: 'completed', paymentStatus: 'paid', checkoutSessionStatus: 'complete' });
  await cancel();
  expect(captured.error).toMatchObject({ status: 409 });
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
});
