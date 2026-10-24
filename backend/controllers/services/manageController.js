const Service = require('../../models/Service');
const Order = require('../../models/Order');
const mongoose = require('mongoose');
const { evaluateListingCapabilities } = require('../../utils/listingCapabilities');
const { SERVICE_LIMITS, validateServiceFields, pickContactUpdates } = require('./serviceHelpers');

/** Writing listings: create, update and delete (with the capability guards). */

// ------------------- Create Service -------------------

exports.createService = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      images,
      // Never trusted from the client: metadata names the blobs a delete removes, so
      // it is only ever built from this request's own uploads (req.files) below.
      imageMetadata: _ignoredClientImageMetadata,
      countyCode,
      municipalityCode,
      areaCode,
      checklist,
      contactPhone,
      contactEmail,
      ...serviceData
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user ID format' });

    const User = require('../../models/User');
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Normalize address
    if (serviceData.location?.address && !serviceData.location.city) {
      const [addr, city] = serviceData.location.address.split(',').map((s) => s.trim());
      serviceData.location.address = addr || '';
      serviceData.location.city = city || '';
    }

    const fieldError = validateServiceFields(req.body);
    if (fieldError) return res.status(400).json({ error: fieldError });

    // Validate paymentType & price (especially Anbud estimated budget)
    const priceNum = Number(serviceData.price);
    if (serviceData.paymentType === 'Anbud') {
      if (
        serviceData.price === undefined ||
        serviceData.price === null ||
        isNaN(priceNum) ||
        priceNum <= 0
      ) {
        return res
          .status(400)
          .json({ error: 'Anbud oppdrag må ha et antatt budsjett større enn 0 kr' });
      }
    } else if (serviceData.paymentType === 'Fastpris') {
      if (
        serviceData.price === undefined ||
        serviceData.price === null ||
        isNaN(priceNum) ||
        priceNum <= 0
      ) {
        return res.status(400).json({ error: 'Fastpris oppdrag må ha en pris større enn 0 kr' });
      }
    } else if (serviceData.paymentType === 'Timepris') {
      const hourlyNum = Number(serviceData.hourlyRate || serviceData.price);
      if (isNaN(hourlyNum) || hourlyNum <= 0) {
        return res
          .status(400)
          .json({ error: 'Timepris oppdrag må ha en timepris større enn 0 kr' });
      }
    }

    // defaults
    serviceData.status = serviceData.status || 'open';
    serviceData.equipment = serviceData.equipment || 'utstyrfri';

    serviceData.urgent = false;

    // Add images from Multer (Azure)
    if (req.files && req.files.length > 0) {
      serviceData.images = req.files.map((file) => file.path);
      serviceData.imageMetadata = req.files.map((file) => ({
        url: file.path,
        blobName: file.filename,
        ogUrl: file.ogPath,
        ogBlobName: file.ogFilename,
        uploadedAt: new Date(),
      }));
    } else {
      // Fallback to body image URLs (backwards compatibility). No metadata: a URL
      // alone carries no authority to delete anything.
      if (images) serviceData.images = images;
    }

    // Parse checklist (frontend sends it as JSON string)
    let parsedChecklist = [];
    if (checklist) {
      try {
        parsedChecklist = typeof checklist === 'string' ? JSON.parse(checklist) : checklist;
        if (!Array.isArray(parsedChecklist)) throw new Error('checklist must be an array');
        if (parsedChecklist.length > SERVICE_LIMITS.MAX_CHECKLIST_ITEMS) {
          return res.status(400).json({
            error: `Sjekklisten kan ha maks ${SERVICE_LIMITS.MAX_CHECKLIST_ITEMS} punkter.`,
          });
        }
        // Format checklist items with default values
        parsedChecklist = parsedChecklist.map((item) => ({
          id: item.id,
          text: String(item.text ?? '').slice(0, SERVICE_LIMITS.CHECKLIST_TEXT_MAX),
          checked: false,
          checkedBy: null,
          checkedAt: null,
        }));
      } catch (err) {
        // Swallowing this created the job with an EMPTY checklist and returned 201, so
        // the poster believed their checklist was saved. The contract made from it
        // later then had nothing to tick off, and nobody was ever told why.
        console.error('Failed to parse checklist:', err.message);
        return res.status(400).json({ error: 'Sjekklisten kunne ikke leses.' });
      }
    }

    // Whitelist what a client may set.
    //
    // This used to spread the un-filtered rest of req.body straight into create, so a
    // client could set `promoted: true` (a paid placement), inflate `views`, or choose
    // its own `status`. The UPDATE path was hardened with a whitelist; create was not.
    const SERVICE_CREATABLE_FIELDS = [
      'title',
      'description',
      'price',
      'hourlyRate',
      'paymentType',
      'location',
      'categories',
      'tags',
      'duration',
      'fromDate',
      'toDate',
      'equipment',
      'maxApplicants',
      'images',
      'imageMetadata', // only ever set from req.files above
      'urgent',
    ];
    const safeServiceData = {};
    for (const field of SERVICE_CREATABLE_FIELDS) {
      if (serviceData[field] !== undefined) safeServiceData[field] = serviceData[field];
    }

    const service = await Service.create({
      ...safeServiceData,
      ...pickContactUpdates(req.body),
      userId,
      countyCode,
      municipalityCode,
      areaCode,
      checklist: parsedChecklist,
      // Never client-supplied.
      status: 'open',
      promoted: false,
      views: 0,
    });

    res.status(201).json(service);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// ------------------- Update Service -------------------

exports.updateService = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: 'Invalid service ID format' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    if (service.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    /**
     * Same gate as delete. Editing a listing that already has a contract rewrites the
     * terms the other party agreed to -- price, scope and dates are exactly the fields
     * this endpoint accepts -- after they have committed, and in the paid case after
     * the money is in escrow.
     */
    const capabilities = await loadCapabilities(service);
    if (!capabilities.canEdit) {
      return res.status(409).json({
        error: capabilities.blockedReason,
        code: capabilities.blockedCode,
        blockingStatus: capabilities.blockingStatus,
      });
    }

    // Validate paymentType & price if being updated
    const updatedPaymentType = req.body.paymentType || service.paymentType;
    const updatedPrice = req.body.price !== undefined ? Number(req.body.price) : service.price;
    if (updatedPaymentType === 'Anbud') {
      if (!updatedPrice || isNaN(updatedPrice) || updatedPrice <= 0) {
        return res
          .status(400)
          .json({ error: 'Anbud oppdrag må ha et antatt budsjett større enn 0 kr' });
      }
    } else if (updatedPaymentType === 'Fastpris') {
      if (!updatedPrice || isNaN(updatedPrice) || updatedPrice <= 0) {
        return res.status(400).json({ error: 'Fastpris oppdrag må ha en pris større enn 0 kr' });
      }
    } else if (updatedPaymentType === 'Timepris') {
      const updatedHourly =
        req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : service.hourlyRate;
      if (!updatedHourly || isNaN(updatedHourly) || updatedHourly <= 0) {
        return res
          .status(400)
          .json({ error: 'Timepris oppdrag må ha en timepris større enn 0 kr' });
      }
    }

    // Split "address, city"
    if (req.body.location?.address && !req.body.location.city) {
      const [addr, city] = req.body.location.address.split(',').map((s) => s.trim());
      req.body.location.address = addr || '';
      req.body.location.city = city || '';
    }

    // ⭐ HANDLE IMAGE DELETION
    // Only entries already on THIS listing are candidates; the blobs themselves are
    // removed after the save (deleteListingImage verifies each one first).
    const removedImageMetadata = [];
    if (req.body.imagesToDelete) {
      const toDelete = Array.isArray(req.body.imagesToDelete)
        ? req.body.imagesToDelete
        : [req.body.imagesToDelete];

      for (const imageUrl of toDelete) {
        if (typeof imageUrl !== 'string') continue;
        removedImageMetadata.push(...service.imageMetadata.filter((m) => m.url === imageUrl));
        service.images = service.images.filter((url) => url !== imageUrl);
        service.imageMetadata = service.imageMetadata.filter((m) => m.url !== imageUrl);
      }
    }

    // ⭐ MERGE existing + new images (handle Multer files)
    if (req.files && req.files.length > 0) {
      const newImageUrls = req.files.map((file) => file.path);
      const newImageMetadata = req.files.map((file) => ({
        url: file.path,
        blobName: file.filename,
        ogUrl: file.ogPath,
        ogBlobName: file.ogFilename,
        uploadedAt: new Date(),
      }));

      service.images = [...service.images, ...newImageUrls];
      service.imageMetadata = [...service.imageMetadata, ...newImageMetadata];
    } else if (req.body.images) {
      // Fallback for body image URLs. Client imageMetadata is ignored — see createService.
      service.images = [...service.images, ...req.body.images];
    }

    // ⭐ HANDLE CHECKLIST UPDATE
    if (req.body.checklist) {
      try {
        let parsedChecklist =
          typeof req.body.checklist === 'string'
            ? JSON.parse(req.body.checklist)
            : req.body.checklist;

        // Update checklist, preserving existing checked state if available
        service.checklist = parsedChecklist.map((newItem) => {
          const existingItem = service.checklist.find((item) => item.id === newItem.id);
          return {
            id: newItem.id,
            text: newItem.text,
            checked: existingItem ? existingItem.checked : false,
            checkedBy: existingItem ? existingItem.checkedBy : null,
            checkedAt: existingItem ? existingItem.checkedAt : null,
          };
        });
      } catch (err) {
        console.error('Failed to parse checklist:', err);
      }
    }

    // Whitelist, mirroring the allowedUpdates pattern in userController.
    //
    // This used to be `Object.assign(service, otherFields)` with everything the
    // client sent. `otherFields` still carried `status`, `userId`, `promoted`,
    // `urgent` and `views`, so the owner could PUT {"promoted":true,"urgent":true}
    // for free promotion, re-open a job that already had a paid contract with
    // {"status":"open"}, or hand the listing to someone else with a new userId.
    const SERVICE_UPDATABLE_FIELDS = [
      'title',
      'description',
      'price',
      'hourlyRate',
      'paymentType',
      'location',
      'categories',
      'tags',
      'duration',
      'fromDate',
      'toDate',
      'equipment',
      'maxApplicants',
      'customerType',
    ];

    // Same bounds as create, applied to whichever fields this edit actually sends.
    const editError = validateServiceFields(req.body, { partial: true });
    if (editError) return res.status(400).json({ error: editError });

    for (const field of SERVICE_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) service[field] = req.body[field];
    }
    Object.assign(service, pickContactUpdates(req.body));

    // Urgent placement was a subscription entitlement and stays disabled until V2.
    if (req.body.urgent !== undefined) {
      service.urgent = false;
    }

    const { countyCode, municipalityCode, areaCode } = req.body;
    if (countyCode !== undefined) service.countyCode = countyCode;
    if (municipalityCode !== undefined) service.municipalityCode = municipalityCode;
    if (areaCode !== undefined) service.areaCode = areaCode;

    await service.save();

    // After the save: a failed save must not leave the listing pointing at deleted blobs.
    const { deleteListingImage } = require('../../utils/azureUpload');
    for (const meta of removedImageMetadata) await deleteListingImage(meta, service._id);

    res.json(service);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Delete Service -------------------

/**
 * Load the orders attached to a listing and work out what its owner may do with it.
 *
 * Both the edit and the delete endpoint call this before writing. The same evaluation
 * is attached to every listing in getMyPostedServices, so in normal use the interface
 * has already explained the situation and never offers the action -- this is the check
 * that makes that true rather than merely presentational.
 */
async function loadCapabilities(service) {
  const orders = await Order.find({ serviceId: service._id }).select('status').lean();
  return evaluateListingCapabilities({ service, orders });
}

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: 'Invalid service ID format' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    if (service.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    /**
     * Refuse when the listing is tied to a live commitment.
     *
     * This used to check ownership and nothing else, so an owner could delete a
     * listing with a paid SafePay escrow, work in progress or an open dispute against
     * it. The Order survives pointing at a `serviceId` that no longer resolves, and so
     * does every Review carrying it -- the provider's order page and the customer's
     * approval page lose the job they describe while the money is still held.
     */
    const capabilities = await loadCapabilities(service);
    if (!capabilities.canDelete) {
      return res.status(409).json({
        error: capabilities.blockedReason,
        code: capabilities.blockedCode,
        blockingStatus: capabilities.blockingStatus,
      });
    }

    await service.deleteOne();

    // ⭐ DELETE THIS LISTING'S OWN IMAGES FROM AZURE (verified per blob; after the
    // document is gone so a failed delete never leaves it pointing at missing files).
    const { deleteListingImage } = require('../../utils/azureUpload');
    for (const meta of service.imageMetadata || []) await deleteListingImage(meta, service._id);

    // Cascade cleanup: delete Orders and Reviews referencing this service.
    // Orders are not deleted but cancelled to preserve audit trail of completed work.
    try {
      const cancelledOrders = await require('../../models/Order').updateMany(
        { serviceId: id, status: { $in: ['pending', 'accepted'] } },
        { $set: { status: 'cancelled', cancelledAt: new Date() } }
      );
      if (cancelledOrders.modifiedCount > 0) {
        console.log(
          `deleteService: cancelled ${cancelledOrders.modifiedCount} pending orders for service ${id}`
        );
      }
    } catch (orderErr) {
      console.error('Order cascade cancel on service delete failed:', orderErr.message);
    }

    // Delete all Reviews for this service. Reviews become meaningless once the service
    // is gone, and preserving them orphaned clutters the database.
    try {
      const deletedReviews = await require('../../models/Review').deleteMany({ serviceId: id });
      if (deletedReviews.deletedCount > 0) {
        console.log(
          `deleteService: deleted ${deletedReviews.deletedCount} reviews for service ${id}`
        );
      }
    } catch (reviewErr) {
      console.error('Review cascade delete on service delete failed:', reviewErr.message);
    }

    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

Object.assign(exports, { loadCapabilities });
