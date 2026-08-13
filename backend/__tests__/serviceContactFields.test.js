const mongoose = require('mongoose');
const Service = require('../models/Service');

/**
 * Regression guard for the job-creation contact step (F-42).
 *
 * The form has always collected a phone number and an e-mail in step 4 and sent
 * them as `phone` / `email`. The Service schema had neither path, so Mongoose
 * strict mode dropped both on every save and the step was a black hole.
 *
 * They are now stored as contactPhone / contactEmail with `select: false`, since
 * the job listing is served to unauthenticated visitors and the poster's phone
 * number must not ride along in that payload.
 *
 * No DB needed: strict-mode stripping happens at construction and the select
 * flag is readable straight off the schema path.
 */
describe('Service schema — contact fields', () => {
  it('persists the contact step instead of dropping it', () => {
    const service = new Service({
      userId: new mongoose.Types.ObjectId(),
      title: 'Male stuen',
      price: 2500,
      categories: ['Maling'],
      contactPhone: '99887766',
      contactEmail: 'ola@example.no',
    });

    expect(service.contactPhone).toBe('99887766');
    expect(service.contactEmail).toBe('ola@example.no');
  });

  it('keeps both fields out of public reads by default', () => {
    // If either flips to selected, every anonymous visitor to a job page gets
    // the poster's contact details in the JSON.
    expect(Service.schema.path('contactPhone').options.select).toBe(false);
    expect(Service.schema.path('contactEmail').options.select).toBe(false);
  });

  it('still drops the old field names, so nothing silently half-works', () => {
    const service = new Service({
      userId: new mongoose.Types.ObjectId(),
      title: 'Male stuen',
      price: 2500,
      categories: ['Maling'],
      phone: '99887766',
      email: 'ola@example.no',
    });

    expect(service.phone).toBeUndefined();
    expect(service.email).toBeUndefined();
  });
});

describe('updateService — blank contact values (F-42)', () => {
  const OWNER = new mongoose.Types.ObjectId();
  let serviceController;
  let ServiceModel;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../models/Service', () => {
      const model = { findById: jest.fn() };
      return model;
    });
    jest.doMock('../models/JobRequest', () => ({}));
    ServiceModel = require('../models/Service');
    serviceController = require('../controllers/serviceController');
  });

  afterEach(() => {
    jest.dontMock('../models/Service');
    jest.dontMock('../models/JobRequest');
  });

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
      price: 1000,
      paymentType: 'Fastpris',
      images: [],
      imageMetadata: [],
      checklist: [],
      contactPhone: '99887766',
      contactEmail: 'ola@example.no',
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    ServiceModel.findById.mockResolvedValue(doc);
    return doc;
  }

  function req(body, id) {
    return { params: { id: String(id) }, body, userId: String(OWNER), files: [] };
  }

  it('does not erase a saved phone number when the form posts blanks', async () => {
    // /Publish-job/:id reads the public endpoint, which never returns these
    // fields, so it always submits empty strings. That must be a no-op.
    const doc = existingService();
    await serviceController.updateService(
      req({ title: 'Ny tittel', contactPhone: '', contactEmail: '   ' }, doc._id),
      mockRes()
    );

    expect(doc.contactPhone).toBe('99887766');
    expect(doc.contactEmail).toBe('ola@example.no');
    expect(doc.title).toBe('Ny tittel');
    expect(doc.save).toHaveBeenCalled();
  });

  it('still applies a contact value the user actually typed', async () => {
    const doc = existingService();
    await serviceController.updateService(
      req({ contactPhone: ' 40404040 ', contactEmail: 'ny@example.no' }, doc._id),
      mockRes()
    );

    expect(doc.contactPhone).toBe('40404040');
    expect(doc.contactEmail).toBe('ny@example.no');
  });
});
