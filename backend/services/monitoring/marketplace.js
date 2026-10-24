/**
 * Marketplace health: is there enough supply (providers applying) for the demand (jobs
 * posted), per category and per region, and does it turn into hires? Read-only aggregation
 * over Service (a posted job), JobRequest (a provider's application) and Order (a hire).
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const UNANSWERED_AFTER = 48 * HOUR;
const NOT_HIRED = ['cancelled'];
const OPEN = ['open', 'pending'];

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const share = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Pure: health label for one segment. Unit-tested. */
function verdict(s) {
  if (s.posted < 3) return 'thin';
  if (s.applicantRate < 50 || s.unanswered / s.posted > 0.3) return 'undersupplied';
  if (s.appsPerJob > 8 && s.hireRate < 20) return 'oversupplied';
  if (s.hireRate < 15) return 'low_conversion';
  return 'healthy';
}

/**
 * Pure: per-segment stats. `keysOf(job)` returns the segments a job belongs to (a job can
 * have several categories). Unit-tested.
 */
function segment(jobs, apps, orders, keysOf, now = Date.now()) {
  const appsBy = new Map();
  for (const a of apps) {
    const k = String(a.serviceId);
    if (!appsBy.has(k)) appsBy.set(k, []);
    appsBy.get(k).push(a);
  }
  const hired = new Set(orders.filter((o) => !NOT_HIRED.includes(o.status)).map((o) => String(o.serviceId)));
  const segs = new Map();
  for (const j of jobs) {
    const id = String(j._id);
    const ja = appsBy.get(id) || [];
    const first = ja.length ? Math.min(...ja.map((a) => +new Date(a.createdAt))) : null;
    for (const key of keysOf(j)) {
      const s = segs.get(key) || { key, posted: 0, withApplicant: 0, applications: 0, providers: new Set(), hires: 0, firstAppHours: [], prices: [], unanswered: 0 };
      s.posted += 1;
      s.applications += ja.length;
      for (const a of ja) s.providers.add(String(a.providerId));
      if (ja.length) s.withApplicant += 1;
      if (first !== null) s.firstAppHours.push((first - +new Date(j.createdAt)) / HOUR);
      if (hired.has(id)) s.hires += 1;
      if (Number.isFinite(j.price) && j.price > 0) s.prices.push(j.price);
      if (!ja.length && OPEN.includes(j.status) && now - +new Date(j.createdAt) > UNANSWERED_AFTER) s.unanswered += 1;
      segs.set(key, s);
    }
  }
  return [...segs.values()]
    .map((s) => {
      const out = {
        key: s.key,
        posted: s.posted,
        applications: s.applications,
        providers: s.providers.size,
        hires: s.hires,
        unanswered: s.unanswered,
        applicantRate: share(s.withApplicant, s.posted),
        appsPerJob: Math.round((s.applications / s.posted) * 10) / 10,
        hireRate: share(s.hires, s.posted),
        medianFirstAppHours: s.firstAppHours.length ? Math.round(median(s.firstAppHours) * 10) / 10 : null,
        medianPrice: median(s.prices),
      };
      return { ...out, verdict: verdict(out) };
    })
    .sort((a, b) => b.posted - a.posted);
}

async function overview({ days = 30 } = {}) {
  const Service = require('../../models/Service');
  const from = new Date(Date.now() - days * DAY);
  const [jobs, categories, counties] = await Promise.all([
    Service.find({ createdAt: { $gte: from }, status: { $ne: 'draft' } }).select('title categories countyCode location.city price status createdAt').lean(),
    require('../../models/Category').find({ isActive: true, parentId: null }).select('name').lean(),
    require('../../models/NorwayCounty').find().select('code name').lean(),
  ]);
  const ids = jobs.map((j) => j._id);
  const [apps, orders] = await Promise.all([
    require('../../models/JobRequest').find({ serviceId: { $in: ids } }).select('serviceId providerId status createdAt').lean(),
    require('../../models/Order').find({ serviceId: { $in: ids } }).select('serviceId providerId status createdAt').lean(),
  ]);
  const countyName = Object.fromEntries(counties.map((c) => [c.code, c.name]));
  const region = (j) => [countyName[j.countyCode] || j.location?.city || 'Unknown'];
  const byCategory = segment(jobs, apps, orders, (j) => (j.categories?.length ? j.categories : ['Uncategorised']));
  const [total] = segment(jobs, apps, orders, () => ['all']);

  // Active categories nobody posted in: demand gap (or a dead category in the menu).
  const seen = new Set(byCategory.map((c) => c.key));
  const emptyCategories = categories.map((c) => c.name).filter((n) => !seen.has(n));

  // Supply concentration: one provider doing most of the hires is a fragility.
  const hiresBy = {};
  for (const o of orders) if (!NOT_HIRED.includes(o.status) && o.providerId) hiresBy[String(o.providerId)] = (hiresBy[String(o.providerId)] || 0) + 1;
  const hireCounts = Object.values(hiresBy).sort((a, b) => b - a);
  const hireTotal = hireCounts.reduce((a, b) => a + b, 0);

  // Daily liquidity series.
  const bucket = days <= 7 ? 6 * HOUR : DAY;
  const at = (d) => new Date(Math.floor(+new Date(d) / bucket) * bucket).toISOString();
  const series = new Map();
  const bump = (d, k) => {
    const t = at(d);
    const row = series.get(t) || { t, posted: 0, applications: 0, hires: 0 };
    row[k] += 1;
    series.set(t, row);
  };
  for (const j of jobs) bump(j.createdAt, 'posted');
  for (const a of apps) if (new Date(a.createdAt) >= from) bump(a.createdAt, 'applications');
  for (const o of orders) if (!NOT_HIRED.includes(o.status)) bump(o.createdAt, 'hires');

  const appCount = new Map();
  for (const a of apps) appCount.set(String(a.serviceId), (appCount.get(String(a.serviceId)) || 0) + 1);
  const unanswered = jobs
    .filter((j) => OPEN.includes(j.status) && !appCount.get(String(j._id)) && Date.now() - +new Date(j.createdAt) > UNANSWERED_AFTER)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 25)
    .map((j) => ({ id: String(j._id), title: j.title, category: j.categories?.[0] || null, region: region(j)[0], price: j.price, createdAt: j.createdAt }));

  return {
    days,
    bucketMs: bucket,
    total: total || null,
    categories: byCategory,
    regions: segment(jobs, apps, orders, region),
    emptyCategories,
    concentration: { providersHired: hireCounts.length, topShare: share(hireCounts[0] || 0, hireTotal), top3Share: share(hireCounts.slice(0, 3).reduce((a, b) => a + b, 0), hireTotal) },
    series: [...series.values()].sort((a, b) => a.t.localeCompare(b.t)),
    unanswered,
  };
}

module.exports = { verdict, segment, overview, median };
