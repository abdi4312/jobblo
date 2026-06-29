const Service = require("../models/Service");
const JobRequest = require("../models/JobRequest");
const mongoose = require("mongoose");

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
      radius = 50000, // 50km default
    } = req.query;

    // Build match stage first
    const matchStage = {};

    if (userId) {
      matchStage.userId = userId;
    }

    if (urgent === "true") {
      matchStage.urgent = true;
    }

    if (category) {
      const categoriesArray = category.split(",").map((c) => c.trim());
      matchStage.categories = { $in: categoriesArray };
    }

    if (search) {
      matchStage.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (minPrice || maxPrice) {
      matchStage.price = {};
      if (minPrice) matchStage.price.$gte = Number(minPrice);
      if (maxPrice) matchStage.price.$lte = Number(maxPrice);
    }

    // Location code filters
    const locationQueries = [];
    if (countyCodes) {
      const codes = countyCodes.split(",").map((c) => c.trim());
      locationQueries.push({ countyCode: { $in: codes } });
    }
    if (municipalityCodes) {
      const codes = municipalityCodes.split(",").map((c) => c.trim());
      locationQueries.push({ municipalityCode: { $in: codes } });
    }
    if (areaCodes) {
      const codes = areaCodes.split(",").map((c) => c.trim());
      locationQueries.push({ areaCode: { $in: codes } });
    }

    if (locationQueries.length > 0) {
      // If we already have $or from search, combine them
      if (matchStage.$or) {
        matchStage.$and = [matchStage.$or, { $or: locationQueries }];
        delete matchStage.$or;
      } else {
        matchStage.$or = locationQueries;
      }
    }

    let total = 0;
    let services = [];

    // Try geolocation first if we have coordinates
    if (lat && lng) {
      try {
        const geoDataPipeline = [];
        geoDataPipeline.push({
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            distanceField: "distance",
            maxDistance: parseInt(radius),
            spherical: true,
            query: matchStage,
            key: "location",
          },
        });

        // Get count and data in one go for geolocation
        const geoCountPipeline = [...geoDataPipeline];
        geoCountPipeline.push({ $count: "total" });
        const geoCountResult = await Service.aggregate(geoCountPipeline);
        const geoTotal = geoCountResult[0]?.total || 0;

        if (geoTotal > 0) {
          // We have nearby jobs, use them
          total = geoTotal;

          // Add sort
          let sortOption = { distance: 1 }; // Default sort by distance for geolocation
          if (sort) {
            switch (sort) {
              case "price_low":
                sortOption = { price: 1 };
                break;
              case "price_high":
                sortOption = { price: -1 };
                break;
              case "newest":
                sortOption = { createdAt: -1 };
                break;
              case "relevant":
                sortOption = { distance: 1 }; // Default to distance for relevant
                break;
              default:
                // Handle direct field sorting like "price" or "-price"
                if (sort.startsWith("-")) {
                  sortOption = { [sort.substring(1)]: -1 };
                } else {
                  sortOption = { [sort]: 1 };
                }
            }
          }
          geoDataPipeline.push({ $sort: sortOption });

          geoDataPipeline.push({ $skip: (page - 1) * limit });
          geoDataPipeline.push({ $limit: parseInt(limit) });

          // Add user population
          geoDataPipeline.push({
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "userId",
            },
          });
          geoDataPipeline.push({
            $unwind: {
              path: "$userId",
              preserveNullAndEmptyArrays: true,
            },
          });
          geoDataPipeline.push({
            $project: {
              "userId.password": 0,
              "userId.email": 0,
              "userId.phone": 0,
            },
          });

          services = await Service.aggregate(geoDataPipeline);
        } else {
          // No nearby jobs, fall back to all jobs
          const fallbackDataPipeline = [];
          fallbackDataPipeline.push({ $match: matchStage });

          // Add sort
          let sortOption = { createdAt: -1 };
          if (sort) {
            switch (sort) {
              case "price_low":
                sortOption = { price: 1 };
                break;
              case "price_high":
                sortOption = { price: -1 };
                break;
              case "newest":
                sortOption = { createdAt: -1 };
                break;
              case "relevant":
                sortOption = { createdAt: -1 }; // Default to newest for relevant
                break;
              default:
                // Handle direct field sorting like "price" or "-price"
                if (sort.startsWith("-")) {
                  sortOption = { [sort.substring(1)]: -1 };
                } else {
                  sortOption = { [sort]: 1 };
                }
            }
          }
          fallbackDataPipeline.push({ $sort: sortOption });

          // Get total count for fallback
          const fallbackCountPipeline = [...fallbackDataPipeline];
          fallbackCountPipeline.push({ $count: "total" });
          const fallbackCountResult = await Service.aggregate(
            fallbackCountPipeline,
          );
          total = fallbackCountResult[0]?.total || 0;

          // Pagination
          fallbackDataPipeline.push({ $skip: (page - 1) * limit });
          fallbackDataPipeline.push({ $limit: parseInt(limit) });

          // Populate user
          fallbackDataPipeline.push({
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "userId",
            },
          });
          fallbackDataPipeline.push({
            $unwind: {
              path: "$userId",
              preserveNullAndEmptyArrays: true,
            },
          });
          fallbackDataPipeline.push({
            $project: {
              "userId.password": 0,
              "userId.email": 0,
              "userId.phone": 0,
            },
          });

          services = await Service.aggregate(fallbackDataPipeline);
        }
      } catch (geoErr) {
        console.log(
          "Geolocation failed, falling back to standard search:",
          geoErr,
        );
        // If geolocation fails, fall back to standard search
        const fallbackDataPipeline = [];
        fallbackDataPipeline.push({ $match: matchStage });

        // Add sort
        let sortOption = { createdAt: -1 };
        if (sort) {
          switch (sort) {
            case "price_low":
              sortOption = { price: 1 };
              break;
            case "price_high":
              sortOption = { price: -1 };
              break;
            case "newest":
              sortOption = { createdAt: -1 };
              break;
            case "relevant":
              sortOption = { createdAt: -1 }; // Default to newest for relevant
              break;
            default:
              // Handle direct field sorting like "price" or "-price"
              if (sort.startsWith("-")) {
                sortOption = { [sort.substring(1)]: -1 };
              } else {
                sortOption = { [sort]: 1 };
              }
          }
        }
        fallbackDataPipeline.push({ $sort: sortOption });

        // Get total count
        const fallbackCountPipeline = [...fallbackDataPipeline];
        fallbackCountPipeline.push({ $count: "total" });
        const fallbackCountResult = await Service.aggregate(
          fallbackCountPipeline,
        );
        total = fallbackCountResult[0]?.total || 0;

        // Pagination
        fallbackDataPipeline.push({ $skip: (page - 1) * limit });
        fallbackDataPipeline.push({ $limit: parseInt(limit) });

        // Populate user
        fallbackDataPipeline.push({
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userId",
          },
        });
        fallbackDataPipeline.push({
          $unwind: {
            path: "$userId",
            preserveNullAndEmptyArrays: true,
          },
        });
        fallbackDataPipeline.push({
          $project: {
            "userId.password": 0,
            "userId.email": 0,
            "userId.phone": 0,
          },
        });

        services = await Service.aggregate(fallbackDataPipeline);
      }
    } else {
      // No geolocation at all, use standard search
      const dataPipeline = [];
      dataPipeline.push({ $match: matchStage });

      // Add sort
      let sortOption = { createdAt: -1 };
      if (sort) {
        switch (sort) {
          case "price_low":
            sortOption = { price: 1 };
            break;
          case "price_high":
            sortOption = { price: -1 };
            break;
          case "newest":
            sortOption = { createdAt: -1 };
            break;
          case "relevant":
            sortOption = { createdAt: -1 }; // Default to newest for relevant
            break;
          default:
            // Handle direct field sorting like "price" or "-price"
            if (sort.startsWith("-")) {
              sortOption = { [sort.substring(1)]: -1 };
            } else {
              sortOption = { [sort]: 1 };
            }
        }
      }
      dataPipeline.push({ $sort: sortOption });

      // Get total count
      const countPipeline = [...dataPipeline];
      countPipeline.push({ $count: "total" });
      const countResult = await Service.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      // Pagination
      dataPipeline.push({ $skip: (page - 1) * limit });
      dataPipeline.push({ $limit: parseInt(limit) });

      // Populate user
      dataPipeline.push({
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      });
      dataPipeline.push({
        $unwind: {
          path: "$userId",
          preserveNullAndEmptyArrays: true,
        },
      });
      dataPipeline.push({
        $project: {
          "userId.password": 0,
          "userId.email": 0,
          "userId.phone": 0,
        },
      });

      services = await Service.aggregate(dataPipeline);
    }

    res.json({
      data: services,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------- Get Service By ID -------------------

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true },
    ).populate(
      "userId",
      "name avatarUrl averageRating verified role orgNumber companyName",
    );

    if (!service) return res.status(404).json({ error: "Service not found" });

    // Fetch applicant count if maxApplicants is set
    let applicantCount = 0;
    if (service.maxApplicants > 0) {
      applicantCount = await JobRequest.countDocuments({
        serviceId: service._id,
        status: { $in: ["pending", "accepted"] },
      });
    }

    const serviceData = service.toObject();
    serviceData.currentApplicants = applicantCount;
    serviceData.isLimitReached =
      service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json(serviceData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------- Full Service Details -------------------

exports.getServiceDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid service ID format" });

    const service = await Service.findById(id)
      .populate("userId", "name email avatarUrl role subscription verified")
      .populate("categories", "name description");

    if (!service) return res.status(404).json({ error: "Service not found" });

    // Stats
    const Order = require("../models/Order");
    const orderStats = await Order.aggregate([
      { $match: { serviceId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
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

    // Fetch applicant count if maxApplicants is set
    let applicantCount = 0;
    if (service.maxApplicants > 0) {
      applicantCount = await JobRequest.countDocuments({
        serviceId: service._id,
        status: { $in: ["pending", "accepted"] },
      });
    }

    const serviceData = service.toObject();
    serviceData.currentApplicants = applicantCount;
    serviceData.isLimitReached =
      service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json({
      service: serviceData,
      provider: service.userId,
      stats,
      similarServices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Helper: Find similar services
async function findSimilarServices(service) {
  try {
    const query = {
      _id: { $ne: service._id },
      status: "open",
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
      .populate("userId", "name avatarUrl verified role orgNumber companyName")
      .populate("categories", "name")
      .sort({ createdAt: -1 });

    if (service.location?.coordinates?.length === 2) {
      const nearby = await Service.find({
        ...query,
        location: {
          $nearSphere: {
            $geometry: {
              type: "Point",
              coordinates: service.location.coordinates,
            },
            $maxDistance: 50000,
          },
        },
      })
        .limit(6)
        .populate(
          "userId",
          "name avatarUrl verified role orgNumber companyName",
        )
        .populate("categories", "name");

      if (nearby.length > 0) similar = nearby;
    }

    return similar;
  } catch (err) {
    console.error("Similar services error:", err);
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
      ...serviceData
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: "Invalid user ID format" });

    const User = require("../models/User");
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Normalize address
    if (serviceData.location?.address && !serviceData.location.city) {
      const [addr, city] = serviceData.location.address
        .split(",")
        .map((s) => s.trim());
      serviceData.location.address = addr || "";
      serviceData.location.city = city || "";
    }

    // defaults
    serviceData.status = serviceData.status || "open";
    serviceData.equipment = serviceData.equipment || "utstyrfri";

    // Restriction for urgent (haste) - only for paid subscribers
    if (serviceData.urgent && user.subscription === "Standard") {
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
        parsedChecklist =
          typeof checklist === "string" ? JSON.parse(checklist) : checklist;
        // Format checklist items with default values
        parsedChecklist = parsedChecklist.map((item) => ({
          id: item.id,
          text: item.text,
          checked: false,
          checkedBy: null,
          checkedAt: null,
        }));
      } catch (err) {
        console.error("Failed to parse checklist:", err);
      }
    }

    const service = await Service.create({
      ...serviceData,
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
      return res.status(400).json({ error: "Invalid service ID format" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: "Service not found" });

    if (service.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Split "address, city"
    if (req.body.location?.address && !req.body.location.city) {
      const [addr, city] = req.body.location.address
        .split(",")
        .map((s) => s.trim());
      req.body.location.address = addr || "";
      req.body.location.city = city || "";
    }

    // ⭐ HANDLE IMAGE DELETION
    if (req.body.imagesToDelete) {
      const cloudinary = require("../config/cloudinary");
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
            console.error("Cloudinary deletion error:", err);
          }
        }
        // Remove from arrays
        service.images = service.images.filter((url) => url !== imageUrl);
        service.imageMetadata = service.imageMetadata.filter(
          (m) => m.url !== imageUrl,
        );
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
        service.imageMetadata = [
          ...service.imageMetadata,
          ...req.body.imageMetadata,
        ];
      }
    }

    // ⭐ HANDLE CHECKLIST UPDATE
    if (req.body.checklist) {
      try {
        let parsedChecklist =
          typeof req.body.checklist === "string"
            ? JSON.parse(req.body.checklist)
            : req.body.checklist;

        // Update checklist, preserving existing checked state if available
        service.checklist = parsedChecklist.map((newItem) => {
          const existingItem = service.checklist.find(
            (item) => item.id === newItem.id,
          );
          return {
            id: newItem.id,
            text: newItem.text,
            checked: existingItem ? existingItem.checked : false,
            checkedBy: existingItem ? existingItem.checkedBy : null,
            checkedAt: existingItem ? existingItem.checkedAt : null,
          };
        });
      } catch (err) {
        console.error("Failed to parse checklist:", err);
      }
    }

    // Update other fields (including location codes)
    const {
      countyCode,
      municipalityCode,
      areaCode,
      checklist,
      ...otherFields
    } = req.body;
    Object.assign(service, otherFields);
    if (countyCode !== undefined) service.countyCode = countyCode;
    if (municipalityCode !== undefined)
      service.municipalityCode = municipalityCode;
    if (areaCode !== undefined) service.areaCode = areaCode;

    await service.save();

    res.json(service);
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError")
      return res.status(400).json({ error: err.message });
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------- Delete Service -------------------

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid service ID format" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: "Service not found" });

    if (service.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // ⭐ DELETE ALL IMAGES FROM CLOUDINARY
    if (service.imageMetadata && service.imageMetadata.length > 0) {
      const cloudinary = require("../config/cloudinary");
      for (const meta of service.imageMetadata) {
        if (meta.blobName) {
          try {
            await cloudinary.uploader.destroy(meta.blobName);
          } catch (err) {
            console.error("Cloudinary bulk deletion error:", err);
          }
        }
      }
    }

    await service.deleteOne();

    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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
          type: "Point",
          coordinates: [longitude, latitude],
          address,
          city,
        },
      },
      { new: true },
    );

    if (!service) return res.status(404).json({ error: "Service not found" });

    // Fetch applicant count if maxApplicants is set
    let applicantCount = 0;
    if (service.maxApplicants > 0) {
      applicantCount = await JobRequest.countDocuments({
        serviceId: service._id,
        status: { $in: ["pending", "accepted"] },
      });
    }

    const serviceData = service.toObject();
    serviceData.currentApplicants = applicantCount;
    serviceData.isLimitReached =
      service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json(serviceData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getNearbyServices = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius)
      return res.status(400).json({ error: "Missing lat, lng or radius" });

    const services = await Service.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(radius),
        },
      },
    });

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getServicesInBox = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng } = req.query;

    const polygon = {
      type: "Polygon",
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
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------- Time Entries -------------------

exports.addTimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, hours, date, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: "Invalid user ID" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: "Service not found" });

    service.timeEntries.push({ userId, hours, date, note });
    await service.save();

    res.status(201).json(service.timeEntries.at(-1));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getTimeEntries = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: "Service not found" });

    res.json(service.timeEntries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------- Checklist -------------------

exports.updateChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { checked } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid service ID" });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Find the checklist item
    const checklistItem = service.checklist.find((item) => item.id === itemId);
    if (!checklistItem) {
      return res.status(404).json({ error: "Checklist item not found" });
    }

    // Update the item
    checklistItem.checked = checked;
    checklistItem.checkedBy = checked ? userId : null;
    checklistItem.checkedAt = checked ? new Date() : null;

    await service.save();

    res.json(service.checklist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------- My Services -------------------

exports.getMyPostedServices = async (req, res) => {
  try {
    const services = await Service.find({ userId: req.userId })
      .populate("categories")
      .populate(
        "userId",
        "name email avatarUrl verified role orgNumber companyName",
      )
      .sort({ _id: -1 });

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
