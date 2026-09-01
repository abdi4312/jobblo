/**
 * My Applications Controller
 * Provider sees all their job applications with full status.
 *
 * JobRequest field naming note:
 *   customerId = applicant (the worker — confusingly named in this codebase)
 *   providerId = job owner (the poster — confusingly named)
 */
const mongoose = require('mongoose');
const JobRequest = require('../models/JobRequest');
const Order = require('../models/Order');
const Chat = require('../models/ChatMessage');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/my-applications
 */
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // customerId in JobRequest = the applicant (worker)
    const filter = { customerId: userId };
    if (status) filter.status = status;

    const [requests, total] = await Promise.all([
      JobRequest.find(filter)
        .populate({
          path: 'serviceId',
          select: 'title description location price status fromDate userId',
          populate: {
            path: 'userId',
            select: 'name lastName avatarUrl averageRating isSafePayUser',
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      JobRequest.countDocuments(filter),
    ]);

    const enriched = await Promise.all(
      requests.map(async (jobReq) => {
        const serviceId = jobReq.serviceId?._id;
        const jobOwnerId = jobReq.serviceId?.userId?._id;

        // Find active order for this service where current user is the provider
        const order = await Order.findOne({
          serviceId,
          providerId: userId,
          status: { $nin: ['cancelled', 'declined'] },
        }).select(
          '_id status paymentStatus agreedPrice startedAt readyForReviewAt completedAt chatId'
        );

        // Find chat between this applicant and job owner
        const chat = await Chat.findOne({
          $or: [
            { clientId: jobOwnerId, providerId: userId, serviceId },
            { clientId: userId, providerId: jobOwnerId, serviceId },
          ],
        }).select('_id status lastMessage');

        // Determine next required action
        let nextAction = null;
        if (jobReq.status === 'pending') {
          nextAction = 'Venter på svar fra oppdragsgiver';
        } else if (jobReq.status === 'declined') {
          nextAction = 'Søknad avslått';
        } else if (jobReq.status === 'accepted' && order) {
          const actionMap = {
            awaiting_payment: 'Venter på betaling fra oppdragsgiver',
            paid: 'Start jobben',
            in_progress: 'Jobb pågår — oppdater fremdrift',
            ready_for_review: 'Venter på godkjenning fra oppdragsgiver',
            completed: 'Jobb fullført',
            disputed: 'Tvist under behandling',
            refunded: 'Refundert',
            cancelled: 'Kansellert',
          };
          nextAction = actionMap[order.status] || order.status;
        }

        return {
          _id: jobReq._id,
          status: jobReq.status,
          message: jobReq.message || '',
          appliedAt: jobReq.createdAt,
          service: jobReq.serviceId
            ? {
                _id: jobReq.serviceId._id,
                title: jobReq.serviceId.title,
                description: jobReq.serviceId.description,
                location: jobReq.serviceId.location,
                price: jobReq.serviceId.price,
                status: jobReq.serviceId.status,
                fromDate: jobReq.serviceId.fromDate,
                customer: jobReq.serviceId.userId,
              }
            : null,
          order: order
            ? {
                _id: order._id,
                status: order.status,
                paymentStatus: order.paymentStatus,
                agreedPrice: order.agreedPrice,
                startedAt: order.startedAt,
                readyForReviewAt: order.readyForReviewAt,
                completedAt: order.completedAt,
                chatId: order.chatId,
              }
            : null,
          chat: chat
            ? { _id: chat._id, status: chat.status, lastMessage: chat.lastMessage }
            : null,
          nextAction,
        };
      })
    );

    res.json({
      applications: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('[myApplications] getMyApplications error:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av søknader' });
  }
};

/**
 * DELETE /api/my-applications/:requestId
 * Withdraw a pending application.
 */
exports.withdrawApplication = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.userId;

    if (!isValidId(requestId)) {
      return res.status(400).json({ error: 'Ugyldig søknad-ID' });
    }

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
      return res.status(404).json({ error: 'Søknad ikke funnet' });
    }

    // Only the applicant can withdraw
    if (String(jobRequest.customerId) !== String(userId)) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    if (jobRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Kan kun trekke tilbake ventende søknader' });
    }

    // Refuse if a contract already exists for this applicant on this job. `pending`
    // alone is not proof there is no order — the award path can leave the request in a
    // state the applicant should not be able to erase underneath a live contract.
    const liveOrder = await Order.findOne({
      serviceId: jobRequest.serviceId,
      providerId: jobRequest.customerId, // JobRequest.customerId is the applicant
      status: { $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed'] },
    }).select('_id');

    if (liveOrder) {
      return res.status(409).json({
        error: 'Du har en aktiv kontrakt på dette oppdraget og kan ikke trekke søknaden.',
        code: 'application_has_active_order',
      });
    }

    const service = await Service.findById(jobRequest.serviceId).select('title userId');

    // Mark withdrawn rather than hard-deleting.
    //
    // `findByIdAndDelete` erased the audit trail of who applied, orphaned the chat
    // created at application time (whose system message still references this id), and
    // left the owner's applicant list one row shorter with no explanation. Keeping the
    // row preserves the history; the partial unique index only covers `pending`, so the
    // applicant can still re-apply later.
    jobRequest.status = 'declined';
    jobRequest.archived = true;
    jobRequest.withdrawnAt = new Date();
    await jobRequest.save();

    // Give the contact quota back. It was charged when the application was sent, and
    // withdrawing before anyone acted on it should not cost the applicant a contact.
    await User.updateOne(
      { _id: userId, monthlyContactUsage: { $gt: 0 } },
      { $inc: { monthlyContactUsage: -1 } }
    );

    // The owner was never told. Their applicant list simply lost a row.
    if (service?.userId) {
      await Notification.create({
        userId: service.userId,
        senderId: userId,
        type: 'application',
        content: `En søker har trukket søknaden sin på "${service.title}".`,
      }).catch((err) => console.error('withdrawApplication notification failed:', err.message));
    }

    res.json({ message: 'Søknad trukket tilbake' });
  } catch (err) {
    console.error('[myApplications] withdrawApplication error:', err);
    res.status(500).json({ error: 'Serverfeil' });
  }
};
