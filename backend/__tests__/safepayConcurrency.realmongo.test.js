/**
 * Concurrency guarantees that mocks cannot prove, against a REAL MongoDB.
 * Opt-in: SAFEPAY_REAL_MONGO_URI=mongodb://127.0.0.1:27017/jobblo-concurrency-test npx jest safepayConcurrency
 * The database name must end in "-test"; it is dropped afterwards.
 */
const mongoose = require('mongoose');

const uri = process.env.SAFEPAY_REAL_MONGO_URI;
const run = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]+-test(\?.*)?$/.test(uri) ? describe : describe.skip;

run('SafePay concurrency on a real MongoDB', () => {
  let Order; let Service; let acquireServiceContractLock; let openDispute;
  const id = () => new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    Order = require('../models/Order');
    Service = require('../models/Service');
    ({ acquireServiceContractLock } = require('../services/order/contractLock'));
    ({ openDispute } = require('../services/admin/safePayStateService'));
  });
  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  it('20 concurrent contract awards: exactly one acquires the service lock', async () => {
    const service = await Service.create({ userId: id(), title: 'concurrency', description: 'concurrency test job', price: 500, categories: ['Annet'] });
    const results = await Promise.all(Array.from({ length: 20 }, () => acquireServiceContractLock(service._id)));
    expect(results.filter(Boolean)).toHaveLength(1);
    await results.find(Boolean).release();
    expect(await acquireServiceContractLock(service._id)).not.toBeNull();
  });

  const paidOrder = (extra = {}) => Order.create({
    serviceId: id(), customerId: id(), providerId: id(), status: 'ready_for_review',
    paymentStatus: 'paid', agreedPrice: 500, ...extra,
  });
  const dispute = (order) => openDispute({
    orderId: order._id, openedByUserId: order.customerId, openedByRole: 'customer',
    reasonCategory: 'poor_quality', title: 'test', description: 'test',
  });

  it('a dispute cannot open while a provider transfer holds the order fence', async () => {
    const order = await paidOrder({ payoutLockId: 'payout_x', payoutLockedAt: new Date() });
    await expect(dispute(order)).rejects.toThrow(/utbetalingsbehandling/);
    expect((await Order.findById(order._id).lean()).status).toBe('ready_for_review');
  });

  it('an abandoned fence (older than the payout lease) no longer blocks a dispute', async () => {
    const order = await paidOrder({ payoutLockId: 'payout_x', payoutLockedAt: new Date(Date.now() - 6 * 60 * 1000) });
    await dispute(order);
    expect((await Order.findById(order._id).lean()).status).toBe('disputed');
  });

  it.each(Array.from({ length: 10 }, (_, i) => i))('fence vs dispute racing on the same order: exactly one wins (run %i)', async () => {
    const order = await paidOrder();
    const fence = Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ['ready_for_review', 'completed'] }, $or: [{ payoutLockId: null }] },
      { $set: { payoutLockId: 'payout_y', payoutLockedAt: new Date() } },
      { new: true }
    );
    const [fenced, opened] = await Promise.allSettled([fence, dispute(order)]);
    const transferWouldRun = fenced.status === 'fulfilled' && fenced.value !== null;
    const disputeOpened = opened.status === 'fulfilled';
    expect(transferWouldRun !== disputeOpened).toBe(true);
  });

});
