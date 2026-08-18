const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const { resolveSort } = require('../utils/serviceSort');

/** A user-supplied string is not a regex. Same escape the admin search already uses. */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bounds for a job posting. The schema only had `price: { min: 0 }`. */
const SERVICE_LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 200,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  PRICE_MAX: 1000000,
  DURATION_MAX: 1000,
  MAX_CHECKLIST_ITEMS: 50,
  CHECKLIST_TEXT_MAX: 300,
};

/**
 * Shared field validation for creating and editing a job.
 *
 * None of this existed: title and description had no length caps, `price` had no
 * ceiling (so 1e308 was accepted and then overflowed Stripe at checkout), and
 * `fromDate`/`toDate` were never compared — a job could end before it started, which
 * nothing downstream would ever question.
 *
 * Returns an error string, or null when the payload is acceptable.
 */
function validateServiceFields(body, { partial = false } = {}) {
  const has = (field) => body[field] !== undefined && body[field] !== null;

  if (!partial || has('title')) {
    const title = String(body.title ?? '').trim();
    if (title.length < SERVICE_LIMITS.TITLE_MIN)
      return `Tittelen må være minst ${SERVICE_LIMITS.TITLE_MIN} tegn.`;
    if (title.length > SERVICE_LIMITS.TITLE_MAX)
      return `Tittelen kan være maks ${SERVICE_LIMITS.TITLE_MAX} tegn.`;
  }

  if (!partial || has('description')) {
    const description = String(body.description ?? '').trim();
    if (description.length < SERVICE_LIMITS.DESCRIPTION_MIN)
      return `Beskrivelsen må være minst ${SERVICE_LIMITS.DESCRIPTION_MIN} tegn.`;
    if (description.length > SERVICE_LIMITS.DESCRIPTION_MAX)
      return `Beskrivelsen kan være maks ${SERVICE_LIMITS.DESCRIPTION_MAX} tegn.`;
  }

  for (const field of ['price', 'hourlyRate']) {
    if (!has(field)) continue;
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0) return `${field} må være et positivt tall.`;
    if (value > SERVICE_LIMITS.PRICE_MAX)
      return `${field} kan ikke overstige ${SERVICE_LIMITS.PRICE_MAX} kr.`;
  }

  if (has('duration')) {
    const value = Number(body.duration?.value);
    if (body.duration?.value !== undefined) {
      if (!Number.isFinite(value) || value <= 0) return 'Varighet må være større enn 0.';
      if (value > SERVICE_LIMITS.DURATION_MAX)
        return `Varighet kan ikke overstige ${SERVICE_LIMITS.DURATION_MAX}.`;
    }
  }

  const from = has('fromDate') ? new Date(body.fromDate) : null;
  const to = has('toDate') ? new Date(body.toDate) : null;
  if (from && Number.isNaN(from.getTime())) return 'Ugyldig fra-dato.';
  if (to && Number.isNaN(to.getTime())) return 'Ugyldig til-dato.';
  if (from && to && from > to) return 'Sluttdato kan ikke være før startdato.';

  return null;
}

/** Guards against Mongo operator injection from query strings (`?userId[$ne]=null`). */
const isValidId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

/**
 * Trims the optional contact fields and drops the blanks.
 *
 * Both edit entry points post the whole form, but only /api/services/my-posted
 * can read these back (they are `select: false`), so the other one always sends
 * empty strings. Assigning those would silently erase a saved phone number just
 * because the user edited the job from a screen that couldn't see it.
 */
const pickContactUpdates = (body) => {
  const updates = {};
  for (const field of ['contactPhone', 'contactEmail']) {
    const value = body[field];
    if (typeof value === 'string' && value.trim()) updates[field] = value.trim();
  }
  return updates;
};

// ------------------- Get All Services -------------------

exports.getAllServices = async (req, res) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort,
      userId,
      page = 1,
      limit = 25,
      urgent,
      countyCodes,
      municipalityCodes,
      areaCodes,
      lat,
      lng,
      radius,
    } = req.query;

    const query = {};

    // Express parses `?userId[$ne]=null` into an OBJECT, and this value went straight
    // into the query. That skipped the public-status filter below and returned drafts,
    // cancelled and completed listings to anonymous callers. Only accept a real id.
    const ownerId = isValidId(userId) ? userId : null;

    // The public status filter is now unconditional. Passing ANY `userId` used to
    // remove it, so one user could enumerate another's drafts, cancelled and
    // completed jobs. This route is unauthenticated; owners read their own listings
    // (including non-public ones) through GET /api/services/my-posted, which is
    // authenticated and scoped to the caller.
    query.status = { $in: ['open', 'active'] };

    if (ownerId) {
      query.userId = ownerId;
    }

    if (urgent === 'true') {
      query.urgent = true;
    }

    if (category && typeof category === 'string') {
      const categoriesArray = category.split(',').map((c) => c.trim());
      query.categories = { $in: categoriesArray };
    }

    const searchConditions = [];
    if (search && typeof search === 'string') {
      // Unescaped, a search term is a regex: `(a+)+$` is a ReDoS and `.*` forces a
      // full collection scan. The admin controller already escapes; this did not.
      const safeSearch = escapeRegex(search).slice(0, 200);
      searchConditions.push(
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
      );
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Location code filters — use $and so location + search don't overwrite each other
    const locationConditions = [];

    if (countyCodes) {
      const codes = countyCodes.split(',').map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) {
        // Match jobs stored directly with countyCode OR jobs stored with a municipality
        // that belongs to the selected county (for backwards compatibility)
        const NorwayMunicipality = require('../models/NorwayMunicipality');
        const munisInCounty = await NorwayMunicipality.find({ countyCode: { $in: codes } }).select('code').lean();
        const munCodes = munisInCounty.map((m) => m.code);

        const countyOrConditions = [{ countyCode: { $in: codes } }];
        if (munCodes.length > 0) {
          countyOrConditions.push({ municipalityCode: { $in: munCodes } });
        }
        locationConditions.push({ $or: countyOrConditions });
      }
    }

    if (municipalityCodes) {
      const codes = municipalityCodes.split(',').map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) {
        locationConditions.push({ municipalityCode: { $in: codes } });
      }
    }

    if (areaCodes) {
      const codes = areaCodes.split(',').map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) {
        locationConditions.push({ areaCode: { $in: codes } });
      }
    }

    // Geo filter: lat/lng/radius (meters) → services within a circle around the point
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Number(radius);
    if (lat && lng && radius && !isNaN(latNum) && !isNaN(lngNum) && !isNaN(radiusNum) && radiusNum > 0) {
      query['location.coordinates'] = {
        $geoWithin: { $centerSphere: [[lngNum, latNum], radiusNum / 6378100] },
      };
    }

    // Combine location conditions with $or (match any selected region)
    // Combine search and location using $and so neither overwrites the other
    const andConditions = [];
    if (searchConditions.length > 0) {
      andConditions.push({ $or: searchConditions });
    }
    if (locationConditions.length > 0) {
      andConditions.push({ $or: locationConditions });
    }
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Sort field came straight from the query string, so any unindexed field could be
    // forced into an in-memory sort. The whitelist that fixed that is still here — it
    // just lives in utils/serviceSort.js now, next to the vocabulary the options
    // endpoint advertises. The two used to be written out separately and had drifted
    // completely apart: the picker offered `price_low`, this endpoint accepted only
    // `price`, so every choice fell through to the default and sorting did nothing.
    const { sort: sortOption } = resolveSort(sort);

    // `limit` was parsed with no ceiling, so `?limit=1000000` returned the whole
    // collection in one response. MAX_LIMIT matches utils/pagination.js, which the
    // admin routes already use.
    const MAX_LIMIT = 100;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), MAX_LIMIT);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);

    // find() and countDocuments() ran sequentially for no reason.
    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('userId', 'name avatarUrl verified role orgNumber companyName')
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .sort(sortOption),
      Service.countDocuments(query),
    ]);

    res.json({
      data: services,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Get Service By ID -------------------

/** Statuses a listing may be read at by anyone. Mirrors the public list filter. */
const PUBLIC_SERVICE_STATUSES = ['open', 'active'];

exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    // A malformed id used to reach findByIdAndUpdate and throw a CastError → 500.
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid service ID' });

    // Read BEFORE deciding whether to count the view. This used to be a single
    // findByIdAndUpdate with `$inc: { views: 1 }` and no status filter at all, so
    // drafts, cancelled, completed and awaiting_payment listings were all readable by
    // id — exactly the set the list endpoint was hardened to hide — and the counter
    // rose on the owner's own refreshes and on every crawler hit, while `views` is a
    // sortable public field.
    const service = await Service.findById(id).populate(
      'userId',
      'name avatarUrl averageRating verified role orgNumber companyName'
    );

    if (!service) return res.status(404).json({ error: 'Service not found' });

    const viewerId = req.userId ? String(req.userId) : null;
    const ownerId = String(service.userId?._id || service.userId);
    const isOwner = Boolean(viewerId) && viewerId === ownerId;

    if (!PUBLIC_SERVICE_STATUSES.includes(service.status) && !isOwner) {
      // A party to the contract still needs to open the job they are working on.
      const involved = viewerId
        ? await Order.findOne({
            serviceId: service._id,
            $or: [{ customerId: viewerId }, { providerId: viewerId }],
          }).select('_id')
        : null;

      if (!involved) {
        // 404 rather than 403 — a non-public listing should not confirm it exists.
        return res.status(404).json({ error: 'Service not found' });
      }
    }

    // Count a view only when a visitor other than the owner reads a live listing.
    if (!isOwner && PUBLIC_SERVICE_STATUSES.includes(service.status)) {
      await Service.updateOne({ _id: service._id }, { $inc: { views: 1 } });
      service.views = (service.views || 0) + 1;
    }

    // Fetch applicant count if maxApplicants is set (HIDDEN FOR NOW)
    // let applicantCount = 0;
    // if (service.maxApplicants > 0) {
    //   applicantCount = await JobRequest.countDocuments({
    //     serviceId: service._id,
    //     status: { $in: ['pending', 'accepted'] },
    //   });
    // }

    const serviceData = service.toObject();
    // serviceData.currentApplicants = applicantCount;
    // serviceData.isLimitReached =
    //   service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json(serviceData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Full Service Details -------------------

exports.getServiceDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: 'Invalid service ID format' });

    const service = await Service.findById(id)
      .populate('userId', 'name email avatarUrl role subscription verified')
      .populate('categories', 'name description');

    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Stats
    const Order = require('../models/Order');
    const orderStats = await Order.aggregate([
      { $match: { serviceId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = {
      totalOrders: orderStats[0]?.totalOrders || 0,
      completedOrders: orderStats[0]?.completedOrders || 0,
    };

    // Similar services
    const similarServices = await findSimilarServices(service);

    // Fetch applicant count if maxApplicants is set (HIDDEN FOR NOW)
    // let applicantCount = 0;
    // if (service.maxApplicants > 0) {
    //   applicantCount = await JobRequest.countDocuments({
    //     serviceId: service._id,
    //     status: { $in: ['pending', 'accepted'] },
    //   });
    // }

    const serviceData = service.toObject();
    // serviceData.currentApplicants = applicantCount;
    // serviceData.isLimitReached =
    //   service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json({
      service: serviceData,
      provider: service.userId,
      stats,
      similarServices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper: Find similar services
async function findSimilarServices(service) {
  try {
    const query = {
      _id: { $ne: service._id },
      status: 'open',
    };

    if (service.categories?.length > 0) {
      query.categories = { $in: service.categories };
    }

    if (service.price) {
      const min = service.price * 0.7;
      const max = service.price * 1.3;
      query.price = { $gte: min, $lte: max };
    }

    let similar = await Service.find(query)
      .limit(6)
      .populate('userId', 'name avatarUrl verified role orgNumber companyName')
      .populate('categories', 'name')
      .sort({ createdAt: -1 });

    if (service.location?.coordinates?.length === 2) {
      const nearby = await Service.find({
        ...query,
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: service.location.coordinates,
            },
            $maxDistance: 50000,
          },
        },
      })
        .limit(6)
        .populate('userId', 'name avatarUrl verified role orgNumber companyName')
        .populate('categories', 'name');

      if (nearby.length > 0) similar = nearby;
    }

    return similar;
  } catch (err) {
    console.error('Similar services error:', err);
    return [];
  }
}

// ------------------- Create Service -------------------

exports.createService = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      images,
      imageMetadata,
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

    const User = require('../models/User');
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
      if (serviceData.price === undefined || serviceData.price === null || isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: 'Anbud oppdrag må ha et antatt budsjett større enn 0 kr' });
      }
    } else if (serviceData.paymentType === 'Fastpris') {
      if (serviceData.price === undefined || serviceData.price === null || isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: 'Fastpris oppdrag må ha en pris større enn 0 kr' });
      }
    } else if (serviceData.paymentType === 'Timepris') {
      const hourlyNum = Number(serviceData.hourlyRate || serviceData.price);
      if (isNaN(hourlyNum) || hourlyNum <= 0) {
        return res.status(400).json({ error: 'Timepris oppdrag må ha en timepris større enn 0 kr' });
      }
    }

    // defaults
    serviceData.status = serviceData.status || 'open';
    serviceData.equipment = serviceData.equipment || 'utstyrfri';

    // Restriction for urgent (haste) - only for paid subscribers
    if (serviceData.urgent && user.subscription === 'Standard') {
      serviceData.urgent = false;
    }

    // Add images from Multer (Cloudinary)
    if (req.files && req.files.length > 0) {
      serviceData.images = req.files.map((file) => file.path);
      serviceData.imageMetadata = req.files.map((file) => ({
        url: file.path,
        blobName: file.filename,
        uploadedAt: new Date(),
      }));
    } else {
      // Fallback to body images if no files uploaded (backwards compatibility)
      if (images) serviceData.images = images;
      if (imageMetadata) serviceData.imageMetadata = imageMetadata;
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
      'title', 'description', 'price', 'hourlyRate', 'paymentType', 'location',
      'categories', 'tags', 'duration', 'fromDate', 'toDate', 'equipment',
      'maxApplicants', 'images', 'imageMetadata', 'urgent',
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

    // Validate paymentType & price if being updated
    const updatedPaymentType = req.body.paymentType || service.paymentType;
    const updatedPrice = req.body.price !== undefined ? Number(req.body.price) : service.price;
    if (updatedPaymentType === 'Anbud') {
      if (!updatedPrice || isNaN(updatedPrice) || updatedPrice <= 0) {
        return res.status(400).json({ error: 'Anbud oppdrag må ha et antatt budsjett større enn 0 kr' });
      }
    } else if (updatedPaymentType === 'Fastpris') {
      if (!updatedPrice || isNaN(updatedPrice) || updatedPrice <= 0) {
        return res.status(400).json({ error: 'Fastpris oppdrag må ha en pris større enn 0 kr' });
      }
    } else if (updatedPaymentType === 'Timepris') {
      const updatedHourly = req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : service.hourlyRate;
      if (!updatedHourly || isNaN(updatedHourly) || updatedHourly <= 0) {
        return res.status(400).json({ error: 'Timepris oppdrag må ha en timepris større enn 0 kr' });
      }
    }

    // Split "address, city"
    if (req.body.location?.address && !req.body.location.city) {
      const [addr, city] = req.body.location.address.split(',').map((s) => s.trim());
      req.body.location.address = addr || '';
      req.body.location.city = city || '';
    }

    // ⭐ HANDLE IMAGE DELETION
    if (req.body.imagesToDelete) {
      const cloudinary = require('../config/cloudinary');
      const toDelete = Array.isArray(req.body.imagesToDelete)
        ? req.body.imagesToDelete
        : [req.body.imagesToDelete];

      for (const imageUrl of toDelete) {
        // Find metadata to get public_id
        const meta = service.imageMetadata.find((m) => m.url === imageUrl);
        if (meta && meta.blobName) {
          try {
            await cloudinary.uploader.destroy(meta.blobName);
          } catch (err) {
            console.error('Cloudinary deletion error:', err);
          }
        }
        // Remove from arrays
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
        uploadedAt: new Date(),
      }));

      service.images = [...service.images, ...newImageUrls];
      service.imageMetadata = [...service.imageMetadata, ...newImageMetadata];
    } else if (req.body.images) {
      // Fallback for body images
      service.images = [...service.images, ...req.body.images];
      if (req.body.imageMetadata) {
        service.imageMetadata = [...service.imageMetadata, ...req.body.imageMetadata];
      }
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
    ];

    // Same bounds as create, applied to whichever fields this edit actually sends.
    const editError = validateServiceFields(req.body, { partial: true });
    if (editError) return res.status(400).json({ error: editError });

    for (const field of SERVICE_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) service[field] = req.body[field];
    }
    Object.assign(service, pickContactUpdates(req.body));

    // `urgent` is a paid-tier feature, enforced on create but previously not on
    // update — which made the restriction free to bypass by editing.
    if (req.body.urgent !== undefined) {
      const owner = await require('../models/User').findById(req.userId).select('subscription');
      const wantsUrgent = req.body.urgent === true || req.body.urgent === 'true';
      service.urgent = wantsUrgent && owner?.subscription !== 'Standard';
    }

    const { countyCode, municipalityCode, areaCode } = req.body;
    if (countyCode !== undefined) service.countyCode = countyCode;
    if (municipalityCode !== undefined) service.municipalityCode = municipalityCode;
    if (areaCode !== undefined) service.areaCode = areaCode;

    await service.save();

    res.json(service);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Delete Service -------------------

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

    // ⭐ DELETE ALL IMAGES FROM CLOUDINARY
    if (service.imageMetadata && service.imageMetadata.length > 0) {
      const cloudinary = require('../config/cloudinary');
      for (const meta of service.imageMetadata) {
        if (meta.blobName) {
          try {
            await cloudinary.uploader.destroy(meta.blobName);
          } catch (err) {
            console.error('Cloudinary bulk deletion error:', err);
          }
        }
      }
    }

    await service.deleteOne();

    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- GeoJSON Endpoints -------------------

exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, address, city } = req.body;

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid service ID' });

    // Authenticated but NOT authorized: this wrote straight to findByIdAndUpdate, so
    // any logged-in user could relocate someone else's job — and because the whole
    // `location` object is replaced, omitting address/city wiped them too.
    const existing = await Service.findById(id).select('userId');
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    if (String(existing.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Ikke autorisert. Du eier ikke dette oppdraget.' });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude og longitude må være tall' });
    }

    const service = await Service.findByIdAndUpdate(
      id,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
          address,
          city,
        },
      },
      { new: true }
    );

    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Fetch applicant count if maxApplicants is set
    let applicantCount = 0;
    if (service.maxApplicants > 0) {
      applicantCount = await JobRequest.countDocuments({
        serviceId: service._id,
        status: { $in: ['pending', 'accepted'] },
      });
    }

    const serviceData = service.toObject();
    serviceData.currentApplicants = applicantCount;
    serviceData.isLimitReached =
      service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json(serviceData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getNearbyServices = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius)
      return res.status(400).json({ error: 'Missing lat, lng or radius' });

    const services = await Service.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(radius),
        },
      },
    });

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getServicesInBox = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng } = req.query;

    const polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [parseFloat(swLng), parseFloat(swLat)],
          [parseFloat(neLng), parseFloat(swLat)],
          [parseFloat(neLng), parseFloat(neLat)],
          [parseFloat(swLng), parseFloat(neLat)],
          [parseFloat(swLng), parseFloat(swLat)],
        ],
      ],
    };

    const services = await Service.find({
      location: { $geoWithin: { $geometry: polygon } },
    });

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Time Entries -------------------

exports.addTimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { hours, date, note } = req.body;

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid service ID' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Time is logged against the caller, never against a user named in the body.
    // `userId` used to come from req.body with no ownership check at all, so any
    // logged-in user could write a billable entry on any listing and attribute it to
    // anyone.
    const userId = req.userId;

    // The owner logs time on their own job; the assigned worker logs time on a job
    // they were awarded. Nobody else.
    const isOwner = String(service.userId) === String(userId);
    let isAssignedWorker = false;
    if (!isOwner) {
      const order = await Order.findOne({
        serviceId: service._id,
        providerId: userId,
        status: { $in: ['paid', 'in_progress', 'ready_for_review'] },
      }).select('_id');
      isAssignedWorker = Boolean(order);
    }
    if (!isOwner && !isAssignedWorker) {
      return res.status(403).json({ error: 'Ikke autorisert for dette oppdraget.' });
    }

    const numericHours = Number(hours);
    if (!Number.isFinite(numericHours) || numericHours <= 0 || numericHours > 24) {
      return res.status(400).json({ error: 'hours må være mellom 0 og 24' });
    }
    const entryDate = date ? new Date(date) : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      return res.status(400).json({ error: 'Ugyldig dato' });
    }

    service.timeEntries.push({ userId, hours: numericHours, date: entryDate, note });
    await service.save();

    res.status(201).json(service.timeEntries.at(-1));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getTimeEntries = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    res.json(service.timeEntries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Checklist -------------------

exports.updateChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { checked } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Ticking off work was authenticated but not authorized — any logged-in user could
    // mark items complete on any listing, and be stamped into `checkedBy` doing it.
    // The owner or the assigned worker only.
    const isOwner = String(service.userId) === String(userId);
    let isAssignedWorker = false;
    if (!isOwner) {
      const order = await Order.findOne({
        serviceId: service._id,
        providerId: userId,
        status: { $in: ['paid', 'in_progress', 'ready_for_review'] },
      }).select('_id');
      isAssignedWorker = Boolean(order);
    }
    if (!isOwner && !isAssignedWorker) {
      return res.status(403).json({ error: 'Ikke autorisert for dette oppdraget.' });
    }

    // Find the checklist item
    const checklistItem = service.checklist.find((item) => item.id === itemId);
    if (!checklistItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    // Update the item
    checklistItem.checked = checked;
    checklistItem.checkedBy = checked ? userId : null;
    checklistItem.checkedAt = checked ? new Date() : null;

    await service.save();

    res.json(service.checklist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- My Services -------------------

exports.getMyPostedServices = async (req, res) => {
  try {
    // Only place the select:false contact fields are returned — this route is
    // owner-scoped, and the edit form needs them to avoid saving blanks back.
    const services = await Service.find({ userId: req.userId })
      .select('+contactPhone +contactEmail')
      .populate('userId', 'name email avatarUrl verified role orgNumber companyName')
      .sort({ _id: -1 });

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
