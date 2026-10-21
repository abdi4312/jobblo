/**
 * Regression guard: listing endpoints must never delete storage they do not own.
 *
 * imageMetadata (`{ url, blobName }`) used to be accepted from the request body on
 * create and update, and every listing delete path then passed `meta.blobName` straight
 * to deleteFromAzure. A listing owner could therefore plant
 * `{ blobName: 'profile_images/<victim>.jpg' }` — or another listing's photo — and
 * delete it by removing the image or the listing (or wait for an admin to delete it).
 *
 * Azure is an in-memory fake; the Service model is mocked with a small "other listings"
 * table so the "used elsewhere" check can be exercised.
 */
const mongoose = require('mongoose');

process.env.AZURE_CONTAINER_NAME = 'test-images';
process.env.AZURE_STORAGE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=a2V5==;EndpointSuffix=core.windows.net';

const store = new Map();
const mockAzure = { failDeletes: false };
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        getBlockBlobClient: (blobName) => ({
          url: `https://acct.blob.core.windows.net/test-images/${blobName}`,
          uploadData: async () => store.set(blobName, true),
          deleteIfExists: async () => {
            if (mockAzure.failDeletes) throw new Error('Azure is down');
            store.delete(blobName);
          },
        }),
      }),
    }),
  },
}));

jest.mock('../models/Service', () => ({ findById: jest.fn(), exists: jest.fn(), create: jest.fn() }));
jest.mock('../models/JobRequest', () => ({}));
jest.mock('../models/Order', () => ({ find: jest.fn(), updateMany: jest.fn() }));
jest.mock('../models/Review', () => ({ deleteMany: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));

const Service = require('../models/Service');
const Order = require('../models/Order');
const Review = require('../models/Review');
const User = require('../models/User');
const serviceController = require('../controllers/serviceController');
const servicesAdmin = require('../controllers/admin/servicesAdminController');
const { deleteListingImage, isListingBlobName } = require('../utils/azureUpload');

const URL_OF = (name) => `https://acct.blob.core.windows.net/test-images/${name}`;
const OWNER = new mongoose.Types.ObjectId();
const OTHER_USER = new mongoose.Types.ObjectId();

// Blobs that belong to other people / other features.
const VICTIM_AVATAR = 'profile_images/victim.jpg';
const VICTIM_LISTING_PHOTO = 'job_images/11111111-1111-4111-8111-111111111111.jpg';
const VICTIM_LISTING_OG = 'job_images/og/22222222-2222-4222-8222-222222222222.jpg';
const ORDER_EVIDENCE = 'orders/abc/evidence/x.jpg';
// The owner's own, server-generated upload.
const OWN_PHOTO = 'job_images/33333333-3333-4333-8333-333333333333.png';
const OWN_OG = 'job_images/og/44444444-4444-4444-8444-444444444444.jpg';
const OWN_LEGACY = `job_images/${OWNER}/55555555-5555-4555-8555-555555555555.jpg`;

const ownMeta = { url: URL_OF(OWN_PHOTO), blobName: OWN_PHOTO, ogUrl: URL_OF(OWN_OG), ogBlobName: OWN_OG };

/** Other listings in the "database", for the shared-reference check. */
let otherListings;
function matches(listing, cond) {
  const [[key, value]] = Object.entries(cond);
  if (key === 'images') return listing.images.includes(value);
  const field = key.split('.')[1];
  return listing.imageMetadata.some((m) => m[field] === value);
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function listing(imageMetadata, overrides = {}) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    userId: OWNER,
    title: 'Male stuen',
    price: 2500,
    paymentType: 'Fastpris',
    status: 'open',
    images: imageMetadata.map((m) => m.url),
    imageMetadata: [...imageMetadata],
    checklist: [],
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Service.findById.mockResolvedValue(doc);
  return doc;
}

const updateReq = (doc, body, userId = OWNER) => ({
  params: { id: String(doc._id) },
  body,
  userId: String(userId),
  files: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockAzure.failDeletes = false;
  store.clear();
  for (const name of [VICTIM_AVATAR, VICTIM_LISTING_PHOTO, VICTIM_LISTING_OG, ORDER_EVIDENCE, OWN_PHOTO, OWN_OG, OWN_LEGACY]) {
    store.set(name, true);
  }
  otherListings = [
    {
      _id: new mongoose.Types.ObjectId(),
      images: [URL_OF(VICTIM_LISTING_PHOTO)],
      imageMetadata: [
        { url: URL_OF(VICTIM_LISTING_PHOTO), blobName: VICTIM_LISTING_PHOTO, ogUrl: URL_OF(VICTIM_LISTING_OG), ogBlobName: VICTIM_LISTING_OG },
      ],
    },
  ];
  Service.exists.mockImplementation(async ({ _id, $or }) =>
    otherListings.some((l) => String(l._id) !== String(_id.$ne) && $or.some((c) => matches(l, c)))
      ? { _id: 'other' }
      : null
  );
  Order.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
  Order.updateMany.mockResolvedValue({ modifiedCount: 0 });
  Review.deleteMany.mockResolvedValue({ deletedCount: 0 });
});

describe('owner image removal (updateService imagesToDelete)', () => {
  it('1/8. deletes the owner’s verified image and its OG derivative', async () => {
    const doc = listing([ownMeta]);
    await serviceController.updateService(updateReq(doc, { imagesToDelete: [ownMeta.url] }), mockRes());
    expect(store.has(OWN_PHOTO)).toBe(false);
    expect(store.has(OWN_OG)).toBe(false);
    expect(doc.images).toEqual([]);
    expect(doc.imageMetadata).toEqual([]);
  });

  it('keeps historical job_images/<ownerId>/… names deletable', async () => {
    const meta = { url: URL_OF(OWN_LEGACY), blobName: OWN_LEGACY };
    const doc = listing([meta]);
    await serviceController.updateService(updateReq(doc, { imagesToDelete: meta.url }), mockRes());
    expect(store.has(OWN_LEGACY)).toBe(false);
  });

  it('2. a non-owner cannot remove images at all', async () => {
    const doc = listing([ownMeta]);
    const res = mockRes();
    await serviceController.updateService(updateReq(doc, { imagesToDelete: [ownMeta.url] }, OTHER_USER), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(store.has(OWN_PHOTO)).toBe(true);
  });

  it('3/5. a forged entry pointing outside job_images/ is never deleted', async () => {
    for (const name of [VICTIM_AVATAR, ORDER_EVIDENCE]) {
      const forged = { url: URL_OF(name), blobName: name };
      const doc = listing([forged]);
      await serviceController.updateService(updateReq(doc, { imagesToDelete: forged.url }), mockRes());
      expect(store.has(name)).toBe(true);
      expect(doc.imageMetadata).toEqual([]); // the bogus entry is still dropped from the listing
    }
  });

  it("3b. a forged entry naming another listing's photo is not deleted", async () => {
    const forged = { url: URL_OF(VICTIM_LISTING_PHOTO), blobName: VICTIM_LISTING_PHOTO, ogUrl: URL_OF(VICTIM_LISTING_OG), ogBlobName: VICTIM_LISTING_OG };
    const doc = listing([forged]);
    await serviceController.updateService(updateReq(doc, { imagesToDelete: forged.url }), mockRes());
    expect(store.has(VICTIM_LISTING_PHOTO)).toBe(true);
    expect(store.has(VICTIM_LISTING_OG)).toBe(true);
  });

  it('6. a blobName that does not match its own URL (legacy / mismatched) fails safe', async () => {
    const mismatched = { url: URL_OF(OWN_PHOTO), blobName: VICTIM_LISTING_PHOTO };
    const cloudinary = { url: 'https://res.cloudinary.com/x/image/upload/v1/job_images/a.jpg', blobName: 'job_images/a' };
    const doc = listing([mismatched, cloudinary]);
    await serviceController.updateService(
      updateReq(doc, { imagesToDelete: [mismatched.url, cloudinary.url] }),
      mockRes()
    );
    expect(store.has(VICTIM_LISTING_PHOTO)).toBe(true);
    expect(doc.imageMetadata).toEqual([]);
  });

  it('only entries already on this listing are candidates; unknown URLs delete nothing', async () => {
    const doc = listing([ownMeta]);
    await serviceController.updateService(
      updateReq(doc, { imagesToDelete: [URL_OF(VICTIM_AVATAR), { $ne: null }] }),
      mockRes()
    );
    expect(store.size).toBe(7);
    expect(doc.imageMetadata).toEqual([ownMeta]);
  });

  it('9. an Azure failure does not break the saved listing', async () => {
    mockAzure.failDeletes = true;
    const doc = listing([ownMeta]);
    const res = mockRes();
    await serviceController.updateService(updateReq(doc, { imagesToDelete: [ownMeta.url] }), res);
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled(); // plain 200 res.json
    expect(doc.imageMetadata).toEqual([]);
  });

  it('a failed save deletes nothing from storage', async () => {
    const doc = listing([ownMeta]);
    doc.save.mockRejectedValue(new Error('db down'));
    await serviceController.updateService(updateReq(doc, { imagesToDelete: [ownMeta.url] }), mockRes());
    expect(store.has(OWN_PHOTO)).toBe(true);
  });
});

describe('metadata injection (create / update)', () => {
  it('4. createService ignores client imageMetadata', async () => {
    User.findById.mockResolvedValue({ _id: OWNER });
    Service.create.mockImplementation(async (data) => data);
    await serviceController.createService(
      {
        userId: String(OWNER),
        files: [],
        body: {
          title: 'Male stuen min',
          description: 'Trenger hjelp til å male stuen, ca 30 kvm.',
          price: 2500,
          paymentType: 'Fastpris',
          categories: ['Maling'],
          images: [URL_OF(VICTIM_AVATAR)],
          imageMetadata: [{ url: URL_OF(VICTIM_AVATAR), blobName: VICTIM_AVATAR }],
        },
      },
      mockRes()
    );
    const created = Service.create.mock.calls[0][0];
    expect(created.imageMetadata).toBeUndefined();
  });

  it('4b. updateService ignores client imageMetadata', async () => {
    const doc = listing([]);
    await serviceController.updateService(
      updateReq(doc, {
        images: [URL_OF(VICTIM_AVATAR)],
        imageMetadata: [{ url: URL_OF(VICTIM_AVATAR), blobName: VICTIM_AVATAR }],
      }),
      mockRes()
    );
    expect(doc.imageMetadata).toEqual([]);
  });

  it('11. uploads still create server-generated metadata with the OG derivative', async () => {
    User.findById.mockResolvedValue({ _id: OWNER });
    Service.create.mockImplementation(async (data) => data);
    await serviceController.createService(
      {
        userId: String(OWNER),
        files: [{ path: ownMeta.url, filename: OWN_PHOTO, ogPath: ownMeta.ogUrl, ogFilename: OWN_OG }],
        body: {
          title: 'Male stuen min',
          description: 'Trenger hjelp til å male stuen, ca 30 kvm.',
          price: 2500,
          paymentType: 'Fastpris',
          categories: ['Maling'],
          imageMetadata: [{ url: 'x', blobName: VICTIM_AVATAR }],
        },
      },
      mockRes()
    );
    const created = Service.create.mock.calls[0][0];
    expect(created.imageMetadata).toEqual([expect.objectContaining(ownMeta)]);
  });
});

describe('whole-listing deletion', () => {
  it('7. deleting a listing removes only its own verified images', async () => {
    const forged = [
      { url: URL_OF(VICTIM_AVATAR), blobName: VICTIM_AVATAR },
      { url: URL_OF(VICTIM_LISTING_PHOTO), blobName: VICTIM_LISTING_PHOTO },
      { url: URL_OF(OWN_PHOTO), blobName: ORDER_EVIDENCE },
    ];
    const doc = listing([ownMeta, ...forged]);
    await serviceController.deleteService(updateReq(doc, {}), mockRes());
    expect(doc.deleteOne).toHaveBeenCalled();
    expect(store.has(OWN_PHOTO)).toBe(false);
    expect(store.has(OWN_OG)).toBe(false);
    for (const name of [VICTIM_AVATAR, VICTIM_LISTING_PHOTO, ORDER_EVIDENCE]) expect(store.has(name)).toBe(true);
  });

  it('deletes no blobs when the document delete fails', async () => {
    const doc = listing([ownMeta]);
    doc.deleteOne.mockRejectedValue(new Error('db down'));
    await serviceController.deleteService(updateReq(doc, {}), mockRes());
    expect(store.has(OWN_PHOTO)).toBe(true);
  });

  it('7b. an admin deleting a poisoned listing does not delete foreign files', async () => {
    const doc = listing([ownMeta, { url: URL_OF(VICTIM_AVATAR), blobName: VICTIM_AVATAR }]);
    const res = mockRes();
    await servicesAdmin.deleteService(
      { params: { id: String(doc._id) }, user: { _id: OTHER_USER }, headers: {} },
      res,
      jest.fn()
    );
    expect(store.has(VICTIM_AVATAR)).toBe(true);
    expect(store.has(OWN_PHOTO)).toBe(false);
  });

  it('10. repeated deletion of the same entry is harmless and touches nothing else', async () => {
    await Promise.all([deleteListingImage(ownMeta, 'svc'), deleteListingImage(ownMeta, 'svc')]);
    await deleteListingImage(ownMeta, 'svc');
    expect(store.has(OWN_PHOTO)).toBe(false);
    expect(store.size).toBe(5);
  });
});

describe('isListingBlobName', () => {
  it.each([
    [OWN_PHOTO, true],
    [OWN_OG, true],
    [OWN_LEGACY, true],
    [VICTIM_AVATAR, false],
    [ORDER_EVIDENCE, false],
    ['hero/a.jpg', false],
    ['job_images/../profile_images/a.jpg', false],
    ['job_images//a.jpg', false],
    ['job_images/a.jpg?x=1', false],
    ['job_images/%2e%2e/a.jpg', false],
    ['/job_images/a.jpg', false],
    [{ $gt: '' }, false],
    [undefined, false],
  ])('%p -> %p', (name, expected) => {
    expect(isListingBlobName(name)).toBe(expected);
  });
});
