const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { parseObjectId } = require('../../utils/pagination');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Service = require('../../models/Service');
const Review = require('../../models/Review');
const Chat = require('../../models/ChatMessage');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const Session = require('../../models/Session');
const SupportTicket = require('../../models/SupportTicket');
const AdminActivity = require('../../models/AdminActivity');
const SubscriptionV2 = require('../../models/SubscriptionV2');

/**
 * Everything an admin needs about one user on one page. Read-only; explicit field list so
 * bank details, tokens and identity numbers never leave the server.
 */
const PROFILE_FIELDS = [
  'name lastName email phone avatarUrl bannerUrl bio role companyName orgNumber orgType website',
  'address postNumber postSted country locations skills planType subscription verified isTrusted',
  'acceptedTerms termsVersion termsAcceptedAt lastLogin createdAt updatedAt accountStatus deactivatedAt mfaEnabledAt',
  'isDeleted deletedAt averageRating reviewCount completedJobs earnings spending pointsBalance',
  'payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted payoutMethod connectAccountCreatedAt',
  'oauthProviders.provider identityVerification.provider identityVerification.verifiedAt identityVerification.assuranceLevel',
].join(' ');

const PAID = ['paid', 'partially_refunded'];

const getUserOverview = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);
  const user = await User.findById(id).select(PROFILE_FIELDS).lean();
  if (!user) return sendError(res, 'Bruker ikke funnet.', 404);

  const either = { $or: [{ customerId: id }, { providerId: id }] };
  const [
    orders,
    orderStats,
    services,
    serviceCount,
    reviews,
    reviewsGiven,
    chats,
    chatCount,
    payouts,
    payoutTotals,
    disputes,
    sessions,
    tickets,
    activity,
    subscription,
  ] = await Promise.all([
    Order.find(either)
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('serviceId', 'title')
      .populate('customerId providerId', 'name avatarUrl')
      .select('status paymentStatus agreedPrice createdAt completedAt serviceId customerId providerId chatId')
      .lean(),
    Order.aggregate([
      { $match: either },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$customerId', id] }, 'customer', 'provider'] },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          active: { $sum: { $cond: [{ $in: ['$status', ['paid', 'in_progress', 'ready_for_review', 'disputed']] }, 1, 0] } },
          paidValue: { $sum: { $cond: [{ $in: ['$paymentStatus', PAID] }, { $ifNull: ['$agreedPrice', 0] }, 0] } },
        },
      },
    ]),
    Service.find({ userId: id }).sort({ createdAt: -1 }).limit(12).select('title status price createdAt images').lean(),
    Service.countDocuments({ userId: id }),
    Review.find({ revieweeId: id }).sort({ createdAt: -1 }).limit(10).populate('reviewerId', 'name avatarUrl').select('rating comment createdAt reviewerId orderId').lean(),
    Review.countDocuments({ reviewerId: id }),
    Chat.find({ $or: [{ clientId: id }, { providerId: id }] })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('clientId providerId', 'name avatarUrl')
      .populate('serviceId', 'title')
      .select('clientId providerId serviceId orderId status lastMessage updatedAt createdAt')
      .lean(),
    Chat.countDocuments({ $or: [{ clientId: id }, { providerId: id }] }),
    Payout.find({ providerId: id }).sort({ createdAt: -1 }).limit(10).select('orderId status grossAmount netProviderAmount releaseSource createdAt transferCompletedAt failureReason').lean(),
    Payout.aggregate([{ $match: { providerId: id } }, { $group: { _id: '$status', n: { $sum: 1 }, net: { $sum: '$netProviderAmount' } } }]),
    Dispute.find({ $or: [{ openedBy: id }, { openedAgainst: id }] }).sort({ createdAt: -1 }).limit(10).select('orderId status title priority openedAt openedBy').lean(),
    Session.find({ userId: id }).sort({ lastUsed: -1 }).limit(10).select('deviceName device browser os location ip lastUsed createdAt expiresAt').lean(),
    SupportTicket.find({ userId: id }).sort({ createdAt: -1 }).limit(10).select('subject status priority orderId createdAt').lean(),
    AdminActivity.find({ targetId: id }).sort({ createdAt: -1 }).limit(20).populate('adminId', 'name').select('action description createdAt adminId').lean(),
    SubscriptionV2.findOne({ userId: id }).sort({ createdAt: -1 }).populate('planId', 'name price').select('status planType autoRenew currentPeriodEnd nextRenewalAt cancellationEffectiveAt planId').lean(),
  ]);

  const role = (r) => orderStats.find((s) => s._id === r) || { count: 0, completed: 0, cancelled: 0, active: 0, paidValue: 0 };
  const transferred = payoutTotals.filter((p) => ['transferred', 'released_internal', 'processing'].includes(p._id));
  const now = Date.now();

  return sendSuccess(res, {
    user,
    stats: {
      asCustomer: role('customer'),
      asProvider: role('provider'),
      services: serviceCount,
      reviewsReceived: user.reviewCount ?? reviews.length,
      reviewsGiven,
      averageRating: user.averageRating ?? null,
      chats: chatCount,
      disputes: disputes.length,
      paidOut: transferred.reduce((a, p) => a + p.net, 0),
      payoutsFailed: payoutTotals.filter((p) => ['failed', 'reconciliation_required'].includes(p._id)).reduce((a, p) => a + p.n, 0),
      activeSessions: sessions.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now).length,
    },
    orders: orders.map((o) => {
      const asCustomer = String(o.customerId?._id) === String(id);
      const other = asCustomer ? o.providerId : o.customerId;
      return {
        _id: o._id,
        title: o.serviceId?.title || null,
        role: asCustomer ? 'customer' : 'provider',
        counterpart: other ? { _id: other._id, name: other.name, avatarUrl: other.avatarUrl } : null,
        status: o.status,
        paymentStatus: o.paymentStatus,
        agreedPrice: o.agreedPrice,
        chatId: o.chatId || null,
        createdAt: o.createdAt,
      };
    }),
    services,
    reviews,
    chats: chats.map((c) => {
      const isClient = String(c.clientId?._id) === String(id);
      const other = isClient ? c.providerId : c.clientId;
      return {
        _id: c._id,
        counterpart: other ? { _id: other._id, name: other.name, avatarUrl: other.avatarUrl } : null,
        role: isClient ? 'customer' : 'provider',
        service: c.serviceId?.title || null,
        orderId: c.orderId || null,
        status: c.status,
        lastMessage: c.lastMessage ? String(c.lastMessage).slice(0, 140) : null,
        updatedAt: c.updatedAt,
      };
    }),
    payouts,
    disputes,
    sessions,
    tickets,
    activity,
    subscription,
  });
});

module.exports = { getUserOverview };
