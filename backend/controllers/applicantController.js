const JobRequest = require('../models/JobRequest');
const Service = require('../models/Service');
const Order = require('../models/Order');

/**
 * GET /api/applicants/:serviceId
 * Get all applicants for a specific service with sort/filter
 */
exports.getApplicantsForService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { sort, filter } = req.query;
    const userId = req.userId; // Current logged-in user (owner of the service)

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Oppdraget ble ikke funnet' });
    }

    // Verify ownership
    if (service.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Ikke autorisert. Du eier ikke dette oppdraget.' });
    }

    // Build filter query
    let query = { serviceId };
    if (filter === 'favorites') {
      query.favorite = true;
    } else if (filter === 'archived') {
      query.archived = true;
    } else if (filter === 'notArchived') {
      query.archived = false;
    }

    // Get all pending and accepted requests (applicants)
    let requestsQuery = JobRequest.find(query)
      .populate({
        path: 'customerId',
        select:
          'name lastName avatarUrl verified isTrusted averageRating reviewCount skills locations createdAt',
      });

    // Apply sorting
    if (sort === 'rating') {
      // We'll sort after fetching because we need to populate first
    } else if (sort === 'completedJobs') {
      // Also sort after fetching
    } else if (sort === 'favorites') {
      requestsQuery = requestsQuery.sort({ favorite: -1, createdAt: -1 });
    } else {
      requestsQuery = requestsQuery.sort({ createdAt: -1 });
    }

    const requests = await requestsQuery;

    // Calculate additional stats per applicant (like completed jobs)
    // For a production app, this might be heavily aggregated, but we'll do simple counts here.
    const applicantsWithStats = await Promise.all(
      requests.map(async (reqDoc) => {
        const applicant = reqDoc.customerId;

        // Count completed orders where this applicant was the provider
        const completedJobsCount = await Order.countDocuments({
          providerId: applicant._id,
          status: 'completed',
        });

        // Calculate real response rate
        const totalRequests = await JobRequest.countDocuments({
          providerId: applicant._id,
        });
        const respondedRequests = await JobRequest.countDocuments({
          providerId: applicant._id,
          status: { $in: ['accepted', 'declined'] },
        });
        const responseRatePercent =
          totalRequests > 0 ? Math.round((respondedRequests / totalRequests) * 100) : 100;
        const responseRate = `${responseRatePercent}%`;
        const responseTime = '< 1t';

        return {
          _id: reqDoc._id,
          status: reqDoc.status,
          message: reqDoc.message || 'Ingen melding',
          appliedAt: reqDoc.createdAt,
          favorite: reqDoc.favorite,
          archived: reqDoc.archived,
          applicant: {
            _id: applicant._id,
            name: `${applicant.name} ${applicant.lastName || ''}`.trim(),
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
      })
    );

    // Apply sorting that depends on the populated data
    let sortedApplicants = [...applicantsWithStats];
    if (sort === 'rating') {
      sortedApplicants.sort((a, b) => b.applicant.rating - a.applicant.rating);
    } else if (sort === 'completedJobs') {
      sortedApplicants.sort((a, b) => b.applicant.completedJobs - a.applicant.completedJobs);
    }

    res.json({
      service: {
        _id: service._id,
        title: service.title,
        price: service.price,
        location: service.location,
        status: service.status,
        date: service.fromDate || service.createdAt,
      },
      applicants: sortedApplicants,
      activeOrder: await Order.findOne({
        serviceId: service._id,
        status: {
          $in: ['awaiting_payment', 'paid', 'in_progress', 'completed'],
        },
      }).select('_id status'),
    });
  } catch (err) {
    console.error('Error fetching applicants:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av søkere' });
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
    const uniqueServiceIds = await JobRequest.distinct('serviceId', {
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
          .populate('customerId', 'avatarUrl name lastName')
          .sort({ createdAt: -1 });

        // Find active order to get selected worker
        const activeOrder = await Order.findOne({
          serviceId: service._id,
          status: {
            $in: ['awaiting_payment', 'paid', 'in_progress', 'completed'],
          },
        }).populate('customerId', 'name lastName avatarUrl');

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
                name: `${activeOrder.customerId.name} ${activeOrder.customerId.lastName || ''}`.trim(),
                avatarUrl: activeOrder.customerId.avatarUrl,
              }
            : null,
        };
      })
    );

    res.json(servicesWithApplicants);
  } catch (err) {
    console.error('Error fetching services with applicants:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av oppdrag' });
  }
};

/**
 * PATCH /api/applicants/:requestId/favorite
 * Toggle favorite status of an applicant
 */
exports.toggleFavorite = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.userId;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
      return res.status(404).json({ error: 'Forespørsel ikke funnet' });
    }

    // Verify ownership
    const service = await Service.findById(jobRequest.serviceId);
    if (!service || service.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    jobRequest.favorite = !jobRequest.favorite;
    await jobRequest.save();

    res.json({ favorite: jobRequest.favorite });
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ error: 'Serverfeil ved endring av favoritt' });
  }
};

/**
 * PATCH /api/applicants/:requestId/archive
 * Toggle archive status of an applicant
 */
exports.toggleArchive = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.userId;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
      return res.status(404).json({ error: 'Forespørsel ikke funnet' });
    }

    // Verify ownership
    const service = await Service.findById(jobRequest.serviceId);
    if (!service || service.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    jobRequest.archived = !jobRequest.archived;
    await jobRequest.save();

    res.json({ archived: jobRequest.archived });
  } catch (err) {
    console.error('Error toggling archive:', err);
    res.status(500).json({ error: 'Serverfeil ved endring av arkiv' });
  }
};

/**
 * PATCH /api/applicants/:requestId/decline
 * Decline an applicant and optionally archive
 */
exports.declineApplicant = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { archive = false } = req.body;
    const userId = req.userId;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
      return res.status(404).json({ error: 'Forespørsel ikke funnet' });
    }

    // Verify ownership
    const service = await Service.findById(jobRequest.serviceId);
    if (!service || service.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    jobRequest.status = 'declined';
    if (archive) {
      jobRequest.archived = true;
    }
    await jobRequest.save();

    res.json({ status: jobRequest.status, archived: jobRequest.archived });
  } catch (err) {
    console.error('Error declining applicant:', err);
    res.status(500).json({ error: 'Serverfeil ved avslåing av søker' });
  }
};
