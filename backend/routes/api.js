/**
 * Every HTTP route, in mount order. Order matters where prefixes overlap:
 * - the social-crawler preview router must come before everything (it serves `/`),
 * - the modular admin router before the legacy one (it takes priority on /api/admin),
 * - `/api` (reviews) after the more specific `/api/*` prefixes above it.
 * Stripe webhooks are NOT here: they need the raw body and are mounted in app.js before
 * any body parser.
 */
const ROUTES = [
  ['/', './preview'],
  ['/', './index'],
  ['/api/auth', './auth'],
  ['/api/auth/web', './webOAuth'],
  ['/api/auth/mobile', './mobileOAuth'],
  ['/api/users', './users'],
  ['/api/services', './service'],
  ['/api/favorites', './favorites'],
  ['/api/messages', './messages'],
  ['/api/upload', './upload'],
  ['/api/config', './globalConfig'],
  ['/api/campaigns', './campaign'],
  ['/api/orders', './order'],
  ['/api/notifications', './notifications'],
  ['/api/push-tokens', './pushTokens'],
  ['/api/admin', './admin/index'], // modular admin router — first, takes priority
  ['/api/admin', './admin'], // legacy admin router (hero, system history)
  ['/api/developer', './developer'],
  ['/api/mobile', './mobile'],
  ['/api/rum', './rum'],
  ['/api/quality', './quality'],
  ['/api', './review'],
  ['/api/categories', './category'],
  ['/api/plans', './subscriptionPlan'],
  ['/api/filter', './filter'],
  ['/api/hero', './hero'],
  ['/api/chats', './chat'],
  ['/api/stripe', './stripe'],
  ['/api/coupons', './coupon'],
  ['/api/transactions', './transaction'],
  ['/api/jobbloShop', './shop'],
  ['/api/lists', './lists'],
  ['/api/ai', './ai'],
  ['/api/explore', './explore'],
  ['/api/applicants', './applicant'],
  ['/api/safepay', './safepay'],
  ['/api/safepay-checkout', './safePayCheckout'],
  ['/api/connect', './connect'],
  ['/api/my-applications', './myApplications'],
  ['/api/upcomingFeatures', './upcomingFeature'],
  ['/api/location-filter', './locationFilter'],
  ['/api/errors', './errors'],
  ['/api/support', './support'],
];

function mountRoutes(app) {
  for (const [path, file] of ROUTES) app.use(path, require(file));
}

module.exports = { ROUTES, mountRoutes };
