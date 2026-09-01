/**
 * Job-posting validation.
 *
 * None of this was enforced: title and description had no length bounds, `price` had
 * no ceiling (1e308 was accepted and then overflowed Stripe at checkout), fromDate and
 * toDate were never compared, a checklist that failed to parse was silently dropped
 * and the job created anyway with 201, and the create path spread the unfiltered
 * request body into the document — so `promoted`, `views` and `status` were client-settable.
 */

jest.mock('../models/Service', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../models/JobRequest', () => ({ countDocuments: jest.fn(), find: jest.fn() }));
jest.mock('../models/Order', () => ({ findOne: jest.fn(), aggregate: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));

const mongoose = require('mongoose');
const Service = require('../models/Service');
const User = require('../models/User');
const serviceController = require('../controllers/serviceController');

const USER = new mongoose.Types.ObjectId();

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

/** A payload that passes every rule, so each test varies exactly one thing. */
function validBody(overrides = {}) {
  return {
    title: 'Male stuen i andre etasje',
    description: 'Stuen er 25 kvadratmeter og trenger to strøk maling. Maling er kjøpt inn.',
    price: 5000,
    paymentType: 'Fastpris',
    location: { address: 'Storgata 1', city: 'Oslo' },
    ...overrides,
  };
}

function callCreate(body) {
  const res = makeRes();
  return serviceController
    .createService({ body, userId: String(USER), files: [] }, res)
    .then(() => res);
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({ _id: USER, subscription: 'Plus' });
  Service.create.mockImplementation(async (doc) => ({ _id: 'svc_1', ...doc }));
});

describe('field bounds', () => {
  it('accepts a well-formed posting', async () => {
    const res = await callCreate(validBody());
    expect(res.statusCode).toBe(201);
  });

  it.each([
    ['a title that is too short', { title: 'Mal' }],
    ['a description that is too short', { description: 'For kort' }],
    ['a title beyond the cap', { title: 'x'.repeat(300) }],
    ['a description beyond the cap', { description: 'x'.repeat(6000) }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await callCreate(validBody(overrides));
    expect(res.statusCode).toBe(400);
    expect(Service.create).not.toHaveBeenCalled();
  });

  it('rejects a price above the ceiling that would overflow Stripe', async () => {
    const res = await callCreate(validBody({ price: 1e308 }));
    expect(res.statusCode).toBe(400);
    expect(Service.create).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    const res = await callCreate(
      validBody({ fromDate: '2026-09-01', toDate: '2026-08-01' })
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/startdato/i);
  });

  it('accepts a date range the right way round', async () => {
    const res = await callCreate(
      validBody({ fromDate: '2026-08-01', toDate: '2026-09-01' })
    );
    expect(res.statusCode).toBe(201);
  });

  it('rejects an unusable duration', async () => {
    const res = await callCreate(validBody({ duration: { value: -5, unit: 'timer' } }));
    expect(res.statusCode).toBe(400);
  });
});

describe('checklist handling', () => {
  it('reports a broken checklist instead of silently creating an empty one', async () => {
    // This used to log and carry on, returning 201 — so the poster believed their
    // checklist was saved, and the contract made from it later had nothing to tick off.
    const res = await callCreate(validBody({ checklist: '{ not valid json' }));

    expect(res.statusCode).toBe(400);
    expect(Service.create).not.toHaveBeenCalled();
  });

  it('stores a valid checklist unchecked', async () => {
    const res = await callCreate(
      validBody({ checklist: JSON.stringify([{ id: '1', text: 'Rydde etter seg' }]) })
    );

    expect(res.statusCode).toBe(201);
    const created = Service.create.mock.calls[0][0];
    expect(created.checklist).toEqual([
      expect.objectContaining({ id: '1', text: 'Rydde etter seg', checked: false }),
    ]);
  });
});

describe('mass assignment', () => {
  it('ignores client-supplied promoted, views and status', async () => {
    const res = await callCreate(
      validBody({ promoted: true, views: 999999, status: 'completed' })
    );

    expect(res.statusCode).toBe(201);
    const created = Service.create.mock.calls[0][0];
    // `promoted` is paid placement; `views` feeds a public sort; `status` decides
    // whether the listing is even visible.
    expect(created.promoted).toBe(false);
    expect(created.views).toBe(0);
    expect(created.status).toBe('open');
  });

  it('keeps the owner from being spoofed', async () => {
    const other = new mongoose.Types.ObjectId();
    await callCreate(validBody({ userId: String(other) }));

    const created = Service.create.mock.calls[0][0];
    expect(String(created.userId)).toBe(String(USER));
  });
});
