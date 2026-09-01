const JobRequest = require('../models/JobRequest');
const Service = require('../models/Service');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

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
    let requestsQuery = JobRequest.find(query).populate({
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

        // A deleted user leaves a dangling ref that populates to null. Dereferencing it
        // threw, and the catch returned 500 for the WHOLE applicants page — one removed
        // account made the job unmanageable. Skip the row instead.
        if (!applicant?._id) return null;

        // Count completed orders where this applicant was the provider
        const completedJobsCount = await Order.countDocuments({
          providerId: applicant._id,
          status: 'completed',
        });

        // Response rate = how promptly this applicant answers requests on jobs THEY
        // posted. JobRequest.providerId is the job owner, so counting by it here
        // measured their behaviour as a poster, not as a worker — and every pure
        // worker (who has never posted) fell to the `: 100` default and was shown to
        // the hiring owner as a flawless 100%. Report it only when it is real.
        const totalRequests = await JobRequest.countDocuments({
          providerId: applicant._id,
        });
        const respondedRequests = await JobRequest.countDocuments({
          providerId: applicant._id,
          status: { $in: ['accepted', 'declined'] },
        });
        const responseRate =
          totalRequests > 0
            ? `${Math.round((respondedRequests / totalRequests) * 100)}%`
            : null;

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
            // `responseTime: '< 1t'`, `isSafePayUser: true` and
            // `isFastResponder: true` used to be sent here, hardcoded, for every
            // applicant. They were rendered to the poster as fact, which made all
            // applicants look identically verified and identically fast — the
            // opposite of what a badge is for. Removed rather than guessed;
            // completedJobs, responseRate, rating and reviewCount above are real.
          },
        };
      })
    );

    // Drop the rows skipped above (applicant account no longer exists).
    let sortedApplicants = applicantsWithStats.filter(Boolean);
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
        // (F-38) Sent so the page can show the real estimate instead of a hardcoded
        // "Ca. 2 timer".
        duration: service.duration,
      },
      applicants: sortedApplicants,
      // ready_for_review and disputed were missing. The moment a provider marked
      // work ready, activeOrder went null, the page re-armed "Velg og start
      // SafePay" for every applicant and reset the timeline — and clicking it
      // returned "Kontrakt finnes allerede" with no way forward.
      activeOrder: await Order.findOne({
        serviceId: service._id,
        status: {
          $in: [
            'awaiting_payment',
            'paid',
            'in_progress',
            'ready_for_review',
            'waiting_for_approval',
            'completed',
            'disputed',
          ],
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

        // Find active order to get selected worker.
        //
        // `providerId`, not `customerId`. On an Order the two mean the opposite of what
        // they mean on a JobRequest: here `customerId` is the person who pays — the job
        // owner, i.e. whoever is looking at this page — and `providerId` is the worker
        // they picked. Populating `customerId` made "Valgt utfører" show the viewer their
        // own name on every awarded job.
        const activeOrder = await Order.findOne({
          serviceId: service._id,
          status: {
            $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'completed'],
          },
        }).populate('providerId', 'name lastName avatarUrl');

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
          selectedWorker: activeOrder?.providerId
            ? {
                _id: activeOrder.providerId._id,
                name: `${activeOrder.providerId.name} ${activeOrder.providerId.lastName || ''}`.trim(),
                avatarUrl: activeOrder.providerId.avatarUrl,
              }
            : null,
          // The order's own state, so the list can say "betalt" or "venter på godkjenning"
          // rather than only ever "utfører valgt".
          order: activeOrder
            ? {
                _id: activeOrder._id,
                status: activeOrder.status,
                paymentStatus: activeOrder.paymentStatus,
                agreedPrice: activeOrder.agreedPrice,
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

    // Refuse to decline the applicant who is actually doing the job.
    //
    // There was no status check, so an owner could decline the worker mid-contract.
    // The application then read `declined` while the order read `in_progress`, and
    // because the applicant's dashboard tests `declined` before the accepted-with-order
    // branch, the worker was told "Søknad avslått" in the middle of a paid job.
    const liveOrder = await Order.findOne({
      serviceId: jobRequest.serviceId,
      providerId: jobRequest.customerId, // JobRequest.customerId is the applicant
      status: { $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed'] },
    }).select('_id status');

    if (liveOrder) {
      return res.status(409).json({
        error: 'Denne søkeren har en aktiv kontrakt og kan ikke avslås. Avbryt kontrakten først.',
        code: 'applicant_has_active_order',
      });
    }

    jobRequest.status = 'declined';
    if (archive) {
      jobRequest.archived = true;
    }
    await jobRequest.save();

    // Declines were silent — no notification, unlike the accept/decline path in
    // orderController. The applicant was left waiting on a job already given away.
    await Notification.create({
      userId: jobRequest.customerId,
      senderId: userId,
      type: 'application',
      content: `Søknaden din på "${service.title}" ble dessverre ikke valgt.`,
    }).catch((err) => console.error('declineApplicant notification failed:', err.message));

    res.json({ status: jobRequest.status, archived: jobRequest.archived });
  } catch (err) {
    console.error('Error declining applicant:', err);
    res.status(500).json({ error: 'Serverfeil ved avslåing av søker' });
  }
};
