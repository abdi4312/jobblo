const mongoose = require('mongoose');

jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../models/JobRequest', () => ({}));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
// updateService now asks utils/listingCapabilities what the owner may do, which reads
// the orders attached to the listing. Deletion is what those capabilities actually
// block; editing stays open except during a dispute, so an empty result here is the
// ordinary case and leaves every assertion below unchanged.
jest.mock('../models/Order', () => ({ find: jest.fn() }));

const Service = require('../models/Service');
const User = require('../models/User');
const Order = require('../models/Order');
const serviceController = require('../controllers/serviceController');

/**
 * Regression guard for F-39.
 *
 * updateService used to end with `Object.assign(service, otherFields)` where
 * otherFields was everything the client sent minus a few destructured keys. It
 * still carried `status`, `userId`, `promoted`, `urgent` and `views`, so a job's
 * own owner could:
 *   - promote and flag their listing as urgent for free,
 *   - re-open a job that already had a paid SafePay contract,
 *   - reassign the listing to another account.
 */

const OWNER = new mongoose.Types.ObjectId();
const STRANGER = new mongoose.Types.ObjectId();

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function existingService(overrides = {}) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    userId: OWNER,
    title: 'Male stuen',
    price: 2500,
    status: 'awaiting_payment',
    promoted: false,
    urgent: false,
    views: 42,
    paymentType: 'Fastpris',
    images: [],
    imageMetadata: [],
    checklist: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Service.findById.mockResolvedValue(doc);
  return doc;
}

const req = (body, id) => ({ params: { id: String(id) }, body, userId: String(OWNER), files: [] });

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ subscription: 'Standard' }) });
  Order.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
});

describe('updateService field whitelist (F-39)', () => {
  it('ignores promoted, views, status and userId from the request body', async () => {
    const doc = existingService();

    await serviceController.updateService(
      req(
        {
          title: 'Ny tittel',
          promoted: true,
          views: 99999,
          status: 'open',
          userId: String(STRANGER),
        },
        doc._id
      ),
      mockRes()
    );

    expect(doc.title).toBe('Ny tittel');
    expect(doc.promoted).toBe(false);
    expect(doc.views).toBe(42);
    expect(doc.status).toBe('awaiting_payment');
    expect(String(doc.userId)).toBe(String(OWNER));
  });

  it('refuses urgent for a Standard subscriber, matching the create-time rule', async () => {
    const doc = existingService();

    await serviceController.updateService(req({ urgent: true }, doc._id), mockRes());

    expect(doc.urgent).toBe(false);
  });

  it('allows urgent for a paid subscriber', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ subscription: 'Pro' }),
    });
    const doc = existingService();

    await serviceController.updateService(req({ urgent: true }, doc._id), mockRes());

    expect(doc.urgent).toBe(true);
  });

  it('still applies the ordinary editable fields', async () => {
    const doc = existingService();

    await serviceController.updateService(
      req({ price: 3000, paymentType: 'Timepris', hourlyRate: 500 }, doc._id),
      mockRes()
    );

    expect(doc.price).toBe(3000);
    expect(doc.paymentType).toBe('Timepris');
    expect(doc.hourlyRate).toBe(500);
    expect(doc.save).toHaveBeenCalled();
  });

  it('rejects a non-owner before touching anything', async () => {
    const doc = existingService({ userId: STRANGER });
    const res = mockRes();

    await serviceController.updateService(req({ title: 'Kapret' }, doc._id), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(doc.title).toBe('Male stuen');
    expect(doc.save).not.toHaveBeenCalled();
  });
});
