const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const Session = require('../../models/Session');
const ErrorLog = require('../../models/ErrorLog');
const SupportTicket = require('../../models/SupportTicket');
const AdminActivity = require('../../models/AdminActivity');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const { escapeRegex, isId } = require('../../utils/devQuery');
const { USER_SAFE_FIELDS } = require('../../services/monitoring/orderHealth');
const { groupCount } = require('../../utils/devQuery');

/** Developer console — user search and diagnostics (no passwords or tokens). Read-only. */

// ── 15. User diagnostics ────────────────────────────────────────────────────
const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q.length < 2) return sendSuccess(res, { users: [] });
  const query = isId(q)
    ? { _id: q }
    : { $or: [{ email: { $regex: `^${escapeRegex(q.toLowerCase())}` } }, { name: { $regex: `^${escapeRegex(q)}`, $options: 'i' } }] };
  const users = await User.find(query).limit(20).select('name email role accountStatus isDeleted createdAt lastLogin avatarUrl').lean();
  return sendSuccess(res, { users });
});

const getUserDiagnostics = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const user = await User.findById(req.params.id).select(USER_SAFE_FIELDS).lean();
  if (!user) return sendError(res, 'User not found.', 404);
  const id = user._id;

  const [sessions, asCustomer, asProvider, subscription, billingOps, paymentIssues, errors, tickets, auditOn, roleChanges, disputes] = await Promise.all([
    Session.find({ userId: id }).sort({ lastUsed: -1 }).limit(20).select('deviceName device browser os location lastUsed createdAt expiresAt').lean(),
    groupCount(Order, 'status', { customerId: id }),
    groupCount(Order, 'status', { providerId: id }),
    SubscriptionV2.findOne({ userId: id }).populate('planId', 'name type price').select('status planType stripeMode autoRenew currentPeriodEnd nextRenewalAt paymentRecoveryStatus pendingPlanChange cancellationEffectiveAt').lean(),
    SubscriptionBillingOperationV2.find({ userId: id }).sort({ createdAt: -1 }).limit(10).select('operationType status lastErrorCode createdAt').lean(),
    (async () => {
      const orderIds = (await Order.find({ $or: [{ customerId: id }, { providerId: id }] }).select('_id').limit(500).lean()).map((o) => o._id);
      const [p, po] = await Promise.all([
        Payment.find({ orderId: { $in: orderIds }, refundStatus: { $in: ['failed', 'reconciliation_required', 'pending'] } }).select('orderId status refundStatus updatedAt').lean(),
        Payout.find({ orderId: { $in: orderIds }, status: { $in: ['failed', 'reconciliation_required'] } }).select('orderId status failureCode updatedAt').lean(),
      ]);
      return [...p.map((x) => ({ kind: 'refund', orderId: x.orderId, status: x.refundStatus, at: x.updatedAt })), ...po.map((x) => ({ kind: 'payout', orderId: x.orderId, status: x.status, detail: x.failureCode, at: x.updatedAt }))];
    })(),
    ErrorLog.find({ userId: id }).sort({ createdAt: -1 }).limit(20).select('referenceId errorCode message route statusCode severity createdAt').lean(),
    SupportTicket.find({ userId: id }).sort({ createdAt: -1 }).limit(20).select('subject status orderId createdAt').lean(),
    AdminActivity.find({ targetId: id }).sort({ createdAt: -1 }).limit(30).populate('adminId', 'name role').select('action description createdAt adminId metadata').lean(),
    AdminActivity.find({ targetId: id, action: 'role_change' }).sort({ createdAt: -1 }).populate('adminId', 'name').select('description createdAt adminId metadata').lean(),
    Dispute.find({ $or: [{ openedBy: id }, { openedAgainst: id }] }).sort({ createdAt: -1 }).limit(10).select('orderId status title openedAt').lean(),
  ]);

  const timeline = [
    { at: user.createdAt, title: 'Account created', source: 'account' },
    user.termsAcceptedAt && { at: user.termsAcceptedAt, title: `Accepted terms ${user.termsVersion || ''}`.trim(), source: 'account' },
    user.identityVerification?.verifiedAt && { at: user.identityVerification.verifiedAt, title: 'BankID verified', source: 'account' },
    user.deactivatedAt && { at: user.deactivatedAt, title: 'Deactivated', source: 'account' },
    user.deletedAt && { at: user.deletedAt, title: 'Deleted', source: 'account' },
    user.lastLogin && { at: user.lastLogin, title: 'Last login', source: 'auth' },
    ...auditOn.map((a) => ({ at: a.createdAt, title: a.description, source: 'audit', by: a.adminId?.name })),
    ...errors.map((e) => ({ at: e.createdAt, title: `${e.errorCode}: ${e.message}`, source: 'error' })),
    ...tickets.map((t) => ({ at: t.createdAt, title: `Support: ${t.subject}`, source: 'support' })),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  return sendSuccess(res, {
    user,
    auth: {
      lastLogin: user.lastLogin || null,
      activeSessions: sessions.filter((s) => !s.expiresAt || new Date(s.expiresAt) > new Date()).length,
      sessions,
      oauth: (user.oauthProviders || []).map((p) => p.provider),
      emailVerified: user.verified,
      mfa: null, // not implemented in Jobblo
      failedLogins: null, // not tracked per user
    },
    jobs: { asCustomer, asProvider },
    subscription,
    billingOps,
    paymentIssues,
    disputes,
    errors,
    tickets,
    roleChanges,
    timeline: timeline.slice(0, 100),
  });
});

module.exports = { searchUsers, getUserDiagnostics };
