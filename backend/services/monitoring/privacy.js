const mongoose = require('mongoose');

/**
 * Privacy & data lifecycle: what personal data we keep and for how long (checked against
 * the real TTL indexes and the age of what is stored), whether deleted accounts really
 * lost their personal data, open deletion requests against the GDPR one-month deadline,
 * terms consent, and a subject-access export (Art. 15/20).
 */

const DAY = 86_400_000;
const db = () => mongoose.connection.db;

/**
 * Declared retention policy. retentionDays = null means "kept while the account exists"
 * (removed or anonymised on deletion); legal = required by law (bokføringsloven: 5 years).
 * timeField = the date used to age a record.
 */
const POLICY = [
  { collection: 'users', personal: 'name, email, phone, address, birth date, photos, BankID claims', purpose: 'The account', retentionDays: null, timeField: 'createdAt' },
  { collection: 'sessions', personal: 'IP, user agent, device', purpose: 'Signed-in devices', retentionDays: 30, timeField: 'createdAt' },
  { collection: 'securityevents', personal: 'IP, email hash, user agent', purpose: 'Abuse detection', retentionDays: 30, timeField: 'at' },
  { collection: 'deliverylogs', personal: 'Recipient address', purpose: 'Email/push delivery debugging', retentionDays: 30, timeField: 'at' },
  { collection: 'mobileevents', personal: 'User id, device, install id', purpose: 'App crash reports', retentionDays: 30, timeField: 'at' },
  { collection: 'rumevents', personal: 'None (anonymous per-tab id)', purpose: 'Web performance', retentionDays: 30, timeField: 'at' },
  { collection: 'searchlogs', personal: 'Search words (anonymous)', purpose: 'Search quality monitoring', retentionDays: 30, timeField: 'at' },
  { collection: 'apimetricminutes', personal: 'Client IPs per route', purpose: 'API monitoring', retentionDays: 30, timeField: 'minute' },
  { collection: 'errorlogs', personal: 'User id, route, request metadata', purpose: 'Debugging errors', retentionDays: 180, timeField: 'createdAt' },
  { collection: 'adminactivities', personal: 'Staff id, IP, user agent', purpose: 'Audit trail', retentionDays: 730, timeField: 'createdAt' },
  { collection: 'notifications', personal: 'Message text, user id', purpose: 'In-app notifications', retentionDays: 365, timeField: 'createdAt' },
  { collection: 'pushtokens', personal: 'Device push token', purpose: 'Push notifications', retentionDays: 270, timeField: 'lastSeenAt' },
  { collection: 'supporttickets', personal: 'Email, message text', purpose: 'Customer support', retentionDays: 1095, timeField: 'createdAt' },
  { collection: 'fraudcases', personal: 'Risk signals, notes', purpose: 'Fraud prevention', retentionDays: 730, timeField: 'createdAt' },
  { collection: 'chats', personal: 'Messages between users', purpose: 'Job conversations (kept for the other party)', retentionDays: null, timeField: 'createdAt' },
  { collection: 'orders', personal: 'Parties, prices, addresses', purpose: 'Contracts and accounting', retentionDays: 1825, legal: true, timeField: 'createdAt' },
  { collection: 'payments', personal: 'Amounts, Stripe references', purpose: 'Accounting (bokføringsloven)', retentionDays: 1825, legal: true, timeField: 'createdAt' },
  { collection: 'payouts', personal: 'Provider payouts', purpose: 'Accounting (bokføringsloven)', retentionDays: 1825, legal: true, timeField: 'createdAt' },
  { collection: 'transactions', personal: 'Purchases', purpose: 'Accounting (bokføringsloven)', retentionDays: 1825, legal: true, timeField: 'createdAt' },
  { collection: 'newsletters', personal: 'Email', purpose: 'Newsletter (consent)', retentionDays: null, timeField: 'createdAt' },
];

/** Pure: verdict for one collection. Unit-tested. */
function retentionStatus(policy, { ttlDays, overdue, count }) {
  if (!count) return { state: 'pass', note: 'Empty.' };
  if (policy.retentionDays === null) return { state: 'pass', note: 'Kept while the account exists; cleaned on deletion.' };
  if (ttlDays === 0) return { state: 'pass', note: 'Each record is removed at its own expiry date (TTL index).' };
  if (ttlDays !== null && ttlDays !== undefined && ttlDays <= policy.retentionDays) return { state: 'pass', note: `Expired automatically after ${ttlDays} d (TTL index).` };
  if (!overdue) return { state: policy.legal ? 'pass' : 'warn', note: policy.legal ? 'Legal retention; nothing past it yet.' : 'No TTL index — nothing past the limit yet, but nothing will delete it either.' };
  return { state: policy.legal ? 'warn' : 'fail', note: `${overdue} record(s) older than ${policy.retentionDays} d${ttlDays ? ` (TTL is ${ttlDays} d)` : ' and no TTL index'}.` };
}

async function retention() {
  const names = new Set((await db().listCollections().toArray()).map((c) => c.name));
  return Promise.all(
    POLICY.map(async (p) => {
      if (!names.has(p.collection)) return { ...p, count: 0, ttlDays: null, overdue: 0, oldest: null, state: 'pass', note: 'Collection not created.' };
      const coll = db().collection(p.collection);
      const [count, indexes, oldestDoc] = await Promise.all([coll.estimatedDocumentCount(), coll.indexes(), coll.find({ [p.timeField]: { $type: 'date' } }).sort({ [p.timeField]: 1 }).limit(1).project({ [p.timeField]: 1 }).next()]);
      const ttl = indexes.find((i) => i.expireAfterSeconds !== undefined);
      const ttlDays = ttl ? Math.round(ttl.expireAfterSeconds / 86400) : null;
      const overdue = p.retentionDays ? await coll.countDocuments({ [p.timeField]: { $lt: new Date(Date.now() - p.retentionDays * DAY) } }) : 0;
      return { ...p, count, ttlDays, overdue, oldest: oldestDoc?.[p.timeField] || null, ...retentionStatus(p, { ttlDays, overdue, count }) };
    })
  );
}

/** Pure: personal data still on a deleted user document. Unit-tested. */
function userLeftovers(u) {
  const out = [];
  if (u.email && !/@jobblo\.invalid$/i.test(u.email)) out.push('email');
  if (u.name && u.name !== 'Slettet bruker') out.push('name');
  for (const f of ['lastName', 'phone', 'avatarUrl', 'bannerUrl', 'address', 'postNumber', 'birthDate', 'bio', 'about', 'website']) if (u[f]) out.push(f);
  for (const f of ['portfolio', 'certifications', 'experience', 'locations', 'addresses', 'oauthProviders']) if (Array.isArray(u[f]) && u[f].length) out.push(f);
  if (u.identityVerification && Object.keys(u.identityVerification).length) out.push('identityVerification');
  return out;
}

/** Deleted accounts and what personal data is still around for them. */
async function deletions({ limit = 200 } = {}) {
  const users = await db()
    .collection('users')
    .find({ isDeleted: true })
    .sort({ deletedAt: -1 })
    .limit(limit)
    .project({ name: 1, lastName: 1, email: 1, phone: 1, avatarUrl: 1, bannerUrl: 1, address: 1, postNumber: 1, birthDate: 1, bio: 1, about: 1, website: 1, portfolio: 1, certifications: 1, experience: 1, locations: 1, addresses: 1, oauthProviders: 1, identityVerification: 1, deletedAt: 1, role: 1 })
    .toArray();
  const ids = users.map((u) => u._id);
  const count = async (coll, filter) => {
    const rows = await db().collection(coll).aggregate([{ $match: filter }, { $group: { _id: filter.userId ? '$userId' : filter.user ? '$user' : '$userId', n: { $sum: 1 } } }]).toArray();
    return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
  };
  const [sessions, tokens, favorites, openJobs, pendingApps] = await Promise.all([
    count('sessions', { userId: { $in: ids } }),
    count('pushtokens', { userId: { $in: ids }, active: true }),
    count('favorites', { user: { $in: ids } }),
    db().collection('services').aggregate([{ $match: { userId: { $in: ids }, status: 'open' } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]).toArray().then((r) => Object.fromEntries(r.map((x) => [String(x._id), x.n]))),
    db().collection('jobrequests').aggregate([{ $match: { providerId: { $in: ids }, status: 'pending' } }, { $group: { _id: '$providerId', n: { $sum: 1 } } }]).toArray().then((r) => Object.fromEntries(r.map((x) => [String(x._id), x.n]))),
  ]);
  return users.map((u) => {
    const id = String(u._id);
    const linked = [];
    if (sessions[id]) linked.push(`${sessions[id]} session(s)`);
    if (tokens[id]) linked.push(`${tokens[id]} push token(s)`);
    if (favorites[id]) linked.push(`${favorites[id]} favourite(s)`);
    if (openJobs[id]) linked.push(`${openJobs[id]} open job listing(s)`);
    if (pendingApps[id]) linked.push(`${pendingApps[id]} pending application(s)`);
    const fields = userLeftovers(u);
    return { id, deletedAt: u.deletedAt, role: u.role, method: /@jobblo\.invalid$/i.test(u.email || '') ? 'anonymised' : 'soft-deleted', fields, linked, clean: !fields.length && !linked.length };
  });
}

const REQUEST_RX = /slett|sletting|delete|deletion|gdpr|personvern|privacy|innsyn|eksport|export my data|mine data/i;

/** Pure: support tickets that look like a data-subject request, with the 30-day deadline. Unit-tested. */
function subjectRequests(tickets, now = Date.now()) {
  return tickets
    .filter((t) => REQUEST_RX.test(`${t.subject} ${t.message}`))
    .map((t) => {
      const due = +new Date(t.createdAt) + 30 * DAY;
      const open = !['resolved', 'closed'].includes(t.status);
      return { id: String(t._id), subject: t.subject, status: t.status, createdAt: t.createdAt, userId: t.userId ? String(t.userId) : null, kind: /innsyn|eksport|export|mine data/i.test(`${t.subject} ${t.message}`) ? 'access/export' : 'deletion', dueAt: new Date(due), daysLeft: open ? Math.ceil((due - now) / DAY) : null, overdue: open && now > due };
    })
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}

async function consent() {
  const current = require('../../controllers/authController').CURRENT_TERMS_VERSION;
  const [byVersion, newsletter] = await Promise.all([
    db().collection('users').aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: '$termsVersion', n: { $sum: 1 }, lastActive: { $max: '$lastLogin' } } }, { $sort: { n: -1 } }]).toArray(),
    db().collection('newsletters').estimatedDocumentCount().catch(() => 0),
  ]);
  const active = byVersion.reduce((a, r) => a + r.n, 0);
  const onCurrent = byVersion.find((r) => r._id === current)?.n || 0;
  return {
    currentVersion: current,
    active,
    onCurrent,
    versions: byVersion.map((r) => ({ version: r._id || null, users: r.n, current: r._id === current, lastActive: r.lastActive || null })),
    newsletterSubscribers: newsletter,
    cookieConsent: 'Stored only in the visitor’s browser (localStorage); ads load only after "accept". No server-side record of consent.',
  };
}

async function overview() {
  const [ret, del, tickets, cons] = await Promise.all([retention(), deletions(), db().collection('supporttickets').find({ createdAt: { $gte: new Date(Date.now() - 365 * DAY) } }).project({ subject: 1, message: 1, status: 1, createdAt: 1, userId: 1 }).toArray(), consent()]);
  return { at: new Date(), retention: ret, deletions: del, requests: subjectRequests(tickets), consent: cons };
}

/** Subject-access export (Art. 15/20): the person's own data, without secrets or other people's messages. */
async function exportUser(userId) {
  const { OWN_USER_SELECT, sanitizeUserOwner } = require('../../utils/userProjections');
  const User = require('../../models/User');
  const user = await User.findById(userId).select(`${OWN_USER_SELECT} termsVersion termsAcceptedAt createdAt lastLogin isDeleted deletedAt`).lean();
  if (!user) return null;
  const id = new mongoose.Types.ObjectId(String(userId));
  const find = (coll, filter, projection = {}) => db().collection(coll).find(filter).project(projection).sort({ createdAt: -1 }).limit(5000).toArray();
  const [services, orders, payments, reviewsWritten, reviewsReceived, chats, notifications, sessions, tickets, applications, subscriptions, favorites] = await Promise.all([
    find('services', { userId: id }, { contactPhone: 0, contactEmail: 0 }),
    find('orders', { $or: [{ customerId: id }, { providerId: id }] }, { checkoutSuccessUrl: 0, checkoutCancelUrl: 0 }),
    db().collection('orders').distinct('_id', { $or: [{ customerId: id }, { providerId: id }] }).then((ids) => find('payments', { orderId: { $in: ids } })),
    find('reviews', { reviewerId: id }),
    find('reviews', { revieweeId: id }),
    // Only the messages this person wrote: the other party's messages are their personal data.
    db().collection('chats').aggregate([{ $match: { $or: [{ clientId: id }, { providerId: id }] } }, { $project: { serviceId: 1, createdAt: 1, messages: { $filter: { input: { $ifNull: ['$messages', []] }, cond: { $eq: ['$$this.senderId', id] } } } } }, { $limit: 2000 }]).toArray(),
    find('notifications', { userId: id }),
    find('sessions', { userId: id }, { refreshToken: 0, oldRefreshToken: 0, token: 0, tokenHash: 0 }),
    find('supporttickets', { userId: id }, { notes: 0, timeline: 0, assignee: 0 }),
    find('jobrequests', { providerId: id }),
    find('subscription_v2', { userId: id }),
    find('favorites', { user: id }),
  ]);
  return {
    generatedAt: new Date(),
    notice: 'Personal data held by Jobblo about this account. Passwords, tokens and bank details are never exported.',
    profile: sanitizeUserOwner(user),
    jobsPosted: services,
    applications,
    orders,
    payments,
    reviewsWritten,
    reviewsReceived,
    messagesSent: chats,
    notifications,
    sessions,
    supportTickets: tickets,
    subscriptions,
    favorites,
  };
}

module.exports = { POLICY, retentionStatus, userLeftovers, subjectRequests, overview, exportUser };
