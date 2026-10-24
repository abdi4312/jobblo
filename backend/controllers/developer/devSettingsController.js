const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const User = require('../../models/User');
const Session = require('../../models/Session');
const AdminActivity = require('../../models/AdminActivity');

/** Developer console — developer access and settings overview. */

// ── 27. Developer access & settings ─────────────────────────────────────────
const INTEGRATIONS = [
  { key: 'stripe', label: 'Stripe', env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  { key: 'stripe_test', label: 'Stripe (test mode)', env: ['STRIPE_TEST_SECRET_KEY', 'STRIPE_TEST_WEBHOOK_SECRET'] },
  { key: 'smtp', label: 'Email (SMTP)', env: ['SMTP_USER', 'SMTP_PASS'] },
  { key: 'firebase', label: 'Push (Firebase)', env: ['FIREBASE_SERVICE_ACCOUNT'] },
  { key: 'azure', label: 'Azure Blob Storage', env: ['AZURE_STORAGE_CONNECTION_STRING'] },
  { key: 'google', label: 'Google OAuth', env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  { key: 'openai', label: 'OpenAI', env: ['OPENAI_API_KEY'] },
  { key: 'github', label: 'GitHub Actions', env: ['GITHUB_TOKEN'] },
  { key: 'slack', label: 'Slack alerts', env: ['SLACK_WEBHOOK_URL'] },
  { key: 'alert_email', label: 'Alert email', env: ['DEV_ALERT_EMAIL'] },
];

const getSettings = asyncHandler(async (req, res) => {
  const { getThresholds, DEFAULT_THRESHOLDS } = require('../../services/monitoring/alerts');
  const devs = await User.find({ role: { $in: ['developer', 'superAdmin'] }, isDeleted: { $ne: true } }).select('name email role developerAccess lastLogin createdAt accountStatus').lean();
  const sessions = await Session.aggregate([
    { $match: { userId: { $in: devs.map((d) => d._id) }, expiresAt: { $gt: new Date() } } },
    { $group: { _id: '$userId', n: { $sum: 1 }, last: { $max: '$lastUsed' } } },
  ]);
  const S = Object.fromEntries(sessions.map((s) => [String(s._id), s]));
  const access = await AdminActivity.find({ $or: [{ action: 'role_change' }, { 'metadata.type': 'developer_access' }] }).sort({ createdAt: -1 }).limit(30).populate('adminId', 'name').select('description createdAt adminId').lean();
  return sendSuccess(res, {
    me: { role: req.user.role, access: req.user.role === 'superAdmin' ? 'superAdmin' : req.user.developerAccess || 'readonly' },
    developers: devs.map((d) => ({ ...d, access: d.role === 'superAdmin' ? 'superAdmin' : d.developerAccess || 'readonly', activeSessions: S[String(d._id)]?.n || 0, lastActive: S[String(d._id)]?.last || null })),
    thresholds: await getThresholds(),
    defaultThresholds: DEFAULT_THRESHOLDS,
    retention: [
      { data: 'API metrics', days: 30 },
      { data: 'Scheduler runs', days: 30 },
      { data: 'Security events', days: 30 },
      { data: 'Email / push delivery', days: 30 },
      { data: 'Error logs, audit log, incidents', days: null },
    ],
    integrations: INTEGRATIONS.map((i) => ({ key: i.key, label: i.label, secrets: i.env.map((name) => ({ name, present: Boolean(process.env[name]) })), configured: i.env.every((n) => Boolean(process.env[n])) })),
    policies: [
      { action: 'Refund / capture / payout', rule: 'Not possible from the developer dashboard' },
      { action: 'IP block / unblock', rule: 'Operations developers and Super Admins, directly, after a step-up OTP; audited' },
      { action: 'Feature flags, alert thresholds, developer access', rule: 'Step-up OTP; Operations developers request, a different Super Admin approves; audited' },
      { action: 'Environment variables / secrets', rule: 'Not editable from the dashboard — set in the server .env (presence is shown in Developer Tools)' },
      { action: 'User account changes', rule: 'Not possible from the developer dashboard' },
      { action: 'Database writes / terminal', rule: 'Not possible from the developer dashboard' },
      { action: 'MFA enforcement', rule: 'Not available — Jobblo has no MFA yet' },
    ],
    accessAudit: access,
  });
});

module.exports = { INTEGRATIONS, getSettings };
