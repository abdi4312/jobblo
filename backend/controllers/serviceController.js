const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const mongoose = require('mongoose');

/** A user-supplied string is not a regex. Same escape the admin search already uses. */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    // forced into an in-memory sort. Whitelist to fields that are actually indexed or
    // cheap to sort.
    const SORTABLE_FIELDS = ['createdAt', 'price', 'views', 'updatedAt'];
    let sortOption = { createdAt: -1 };
    if (sort && typeof sort === 'string') {
      const desc = sort.startsWith('-');
      const field = desc ? sort.substring(1) : sort;
      if (SORTABLE_FIELDS.includes(field)) {
        sortOption = { [field]: desc ? -1 : 1 };
      }
    }

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

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('userId', 'name avatarUrl averageRating verified role orgNumber companyName');

    if (!service) return res.status(404).json({ error: 'Service not found' });

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
        // Format checklist items with default values
        parsedChecklist = parsedChecklist.map((item) => ({
          id: item.id,
          text: item.text,
          checked: false,
          checkedBy: null,
          checkedAt: null,
        }));
      } catch (err) {
        console.error('Failed to parse checklist:', err);
      }
    }

    const service = await Service.create({
      ...serviceData,
      ...pickContactUpdates(req.body),
      userId,
      countyCode,
      municipalityCode,
      areaCode,
      checklist: parsedChecklist,
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
    const { userId, hours, date, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user ID' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    service.timeEntries.push({ userId, hours, date, note });
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
