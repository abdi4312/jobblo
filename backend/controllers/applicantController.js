const JobRequest = require("../models/JobRequest");
const Service = require("../models/Service");
const Order = require("../models/Order");

/**
 * GET /api/applicants/:serviceId
 * Get all applicants for a specific service
 */
exports.getApplicantsForService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userId = req.userId; // Current logged-in user (owner of the service)

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: "Oppdraget ble ikke funnet" });
    }

    // Verify ownership
    if (service.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Ikke autorisert. Du eier ikke dette oppdraget." });
    }

    // Get all pending and accepted requests (applicants)
    const requests = await JobRequest.find({ serviceId })
      .populate({
        path: "customerId",
        select:
          "name lastName avatarUrl verified isTrusted averageRating reviewCount skills locations createdAt",
      })
      .sort({ createdAt: -1 });

    // Calculate additional stats per applicant (like completed jobs)
    // For a production app, this might be heavily aggregated, but we'll do simple counts here.
    const applicantsWithStats = await Promise.all(
      requests.map(async (reqDoc) => {
        const applicant = reqDoc.customerId;

        // Count completed orders where this applicant was the provider
        const completedJobsCount = await Order.countDocuments({
          providerId: applicant._id,
          status: "completed",
        });

        // Calculate real response rate
        const totalRequests = await JobRequest.countDocuments({
          providerId: applicant._id,
        });
        const respondedRequests = await JobRequest.countDocuments({
          providerId: applicant._id,
          status: { $in: ["accepted", "declined"] },
        });
        const responseRatePercent =
          totalRequests > 0
            ? Math.round((respondedRequests / totalRequests) * 100)
            : 100;
        const responseRate = `${responseRatePercent}%`;
        const responseTime = "< 1t";

        return {
          _id: reqDoc._id,
          status: reqDoc.status,
          message: reqDoc.message || "Ingen melding",
          appliedAt: reqDoc.createdAt,
          applicant: {
            _id: applicant._id,
            name: `${applicant.name} ${applicant.lastName || ""}`.trim(),
            avatarUrl: applicant.avatarUrl,
            verified: applicant.verified || applicant.isTrusted,
            skills: applicant.skills || [],
            locations: applicant.locations || [],
            rating: applicant.averageRating || 0,
            reviewCount: applicant.reviewCount || 0,
            completedJobs: completedJobsCount,
            responseRate,
            responseTime,
            isSafePayUser: true, // Mocked badge
            isFastResponder: true, // Mocked badge
          },
        };
      }),
    );

    res.json({
      service: {
        _id: service._id,
        title: service.title,
        price: service.price,
        location: service.location,
        status: service.status,
        date: service.fromDate || service.createdAt,
      },
      applicants: applicantsWithStats,
      activeOrder: await Order.findOne({
        serviceId: service._id,
        status: {
          $in: ["awaiting_payment", "paid", "in_progress", "completed"],
        },
      }).select("_id status"),
    });
  } catch (err) {
    console.error("Error fetching applicants:", err);
    res.status(500).json({ error: "Serverfeil ved henting av søkere" });
  }
};

/**
 * GET /api/applicants/my/overview
 * Get all services for the logged-in user with applicant counts and some applicant avatars
 */
exports.getMyServicesWithApplicants = async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Find all unique serviceIds that have at least one job request where the user is the provider
    const uniqueServiceIds = await JobRequest.distinct("serviceId", {
      providerId: userId,
    });

    if (!uniqueServiceIds || uniqueServiceIds.length === 0) {
      return res.json([]);
    }

    // 2. Fetch those specific services
    const services = await Service.find({
      _id: { $in: uniqueServiceIds },
    }).sort({ createdAt: -1 });

    const servicesWithApplicants = await Promise.all(
      services.map(async (service) => {
        // Count job requests for this service
        const requests = await JobRequest.find({ serviceId: service._id })
          .populate("customerId", "avatarUrl name lastName")
          .sort({ createdAt: -1 });

        // Find active order to get selected worker
        const activeOrder = await Order.findOne({
          serviceId: service._id,
          status: {
            $in: ["awaiting_payment", "paid", "in_progress", "completed"],
          },
        }).populate("customerId", "name lastName avatarUrl");

        // Last activity: use latest between service updatedAt, last request createdAt, last order updatedAt
        let lastActivity = service.updatedAt;
        if (requests.length > 0 && requests[0].createdAt > lastActivity) {
          lastActivity = requests[0].createdAt;
        }
        if (activeOrder && activeOrder.updatedAt > lastActivity) {
          lastActivity = activeOrder.updatedAt;
        }

        return {
          _id: service._id,
          title: service.title,
          price: service.price,
          status: service.status,
          location: service.location,
          applicantCount: requests.length,
          applicantAvatars: requests
            .slice(0, 3)
            .map((r) => r.customerId?.avatarUrl)
            .filter((url) => !!url),
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
          lastActivity,
          categories: service.categories,
          fromDate: service.fromDate,
          toDate: service.toDate,
          selectedWorker: activeOrder?.customerId
            ? {
                _id: activeOrder.customerId._id,
                name: `${activeOrder.customerId.name} ${activeOrder.customerId.lastName || ""}`.trim(),
                avatarUrl: activeOrder.customerId.avatarUrl,
              }
            : null,
        };
      }),
    );

    res.json(servicesWithApplicants);
  } catch (err) {
    console.error("Error fetching services with applicants:", err);
    res.status(500).json({ error: "Serverfeil ved henting av oppdrag" });
  }
};
