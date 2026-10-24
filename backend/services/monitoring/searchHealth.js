
/**
 * Search & geolocation health: can listings be found (coordinates, region codes, real
 * categories), do searches return anything, how fast, and is the geo index there.
 */

const DAY = 86_400_000;
// Mainland Norway + Svalbard, generous. ponytail: a box, not the coastline — catches wrong
// countries and swapped lat/lng, not a pin dropped in the sea next to Norway.
const NORWAY = { lat: [57.8, 81.1], lng: [4.0, 31.5] };
const inNorway = (lng, lat) => lat >= NORWAY.lat[0] && lat <= NORWAY.lat[1] && lng >= NORWAY.lng[0] && lng <= NORWAY.lng[1];
const PUBLIC = ['open', 'active'];
const SEARCH_ROUTES = ['GET /api/services/', 'GET /api/services/nearby', 'GET /api/filter/options', 'GET /api/location-filter/tree'];

/** Fire-and-forget: never slows down or breaks a search. */
function recordSearch(entry) {
  const text = typeof entry.text === 'string' ? entry.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60) || null : null;
  // Raw insert: a Mongoose document per search was measurable CPU on the busiest endpoint.
  require('../../models/SearchLog')
    .collection.insertOne({ kind: entry.kind, text, categories: entry.categories?.length ? entry.categories.map(String).slice(0, 10) : undefined, regions: entry.regions || 0, radiusKm: entry.radiusKm ?? null, results: Number(entry.results) || 0, ms: Number(entry.ms) || 0, at: new Date() })
    .catch(() => undefined);
}

/** Pure: what is wrong with a listing's location, or null. Unit-tested. */
function geoIssue(service) {
  const c = service.location?.coordinates;
  if (!Array.isArray(c) || c.length !== 2 || c.some((x) => typeof x !== 'number' || Number.isNaN(x))) return 'missing';
  const [lng, lat] = c;
  if (lng === 0 && lat === 0) return 'zero';
  if (inNorway(lng, lat)) return null;
  // Swap test against the mainland only: a swapped Svalbard box would claim half of Asia.
  if (lng >= 57.8 && lng <= 71.3 && lat >= 4.0 && lat <= 31.5) return 'swapped';
  return 'outside_norway';
}

const ISSUE = {
  missing: { title: 'No coordinates', why: 'Invisible on the map and in every radius / "near me" search.' },
  zero: { title: 'Coordinates are 0,0', why: 'A failed geocode saved as a point in the Atlantic — never matches a Norwegian radius search.' },
  swapped: { title: 'Latitude and longitude swapped', why: 'Stored as [lat, lng]; GeoJSON needs [lng, lat], so the job sits in the wrong place.' },
  outside_norway: { title: 'Located outside Norway', why: 'Test data or a wrong geocode; radius searches in Norway never find it.' },
  no_county: { title: 'No county code', why: 'Not matched by the county / municipality filters.' },
  unknown_category: { title: 'Category that does not exist', why: 'Not reachable from the category filter or category pages.' },
};

/** Pure: per-listing findings. Unit-tested. */
function listingFindings(services, categoryNames) {
  const known = new Set(categoryNames);
  const out = [];
  for (const s of services) {
    const g = geoIssue(s);
    if (g) out.push({ issue: g, id: String(s._id), title: s.title, city: s.location?.city || null, coordinates: s.location?.coordinates || null });
    if (!s.countyCode) out.push({ issue: 'no_county', id: String(s._id), title: s.title, city: s.location?.city || null });
    const bad = (s.categories || []).filter((c) => !known.has(c));
    if (bad.length) out.push({ issue: 'unknown_category', id: String(s._id), title: s.title, detail: bad.join(', ') });
  }
  return out;
}

const BANDS = [[10, '≤ 10 km'], [25, '≤ 25 km'], [50, '≤ 50 km'], [Infinity, '> 50 km']];
const radiusBands = (logs) => BANDS.map(([max, k], i) => ({ k, n: logs.filter((l) => l.radiusKm && l.radiusKm <= max && (i === 0 || l.radiusKm > BANDS[i - 1][0])).length })).filter((b) => b.n);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const p = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null);

async function overview({ days = 7 } = {}) {
  const from = new Date(Date.now() - days * DAY);
  const Service = require('../../models/Service');
  const [services, categories, logs, indexes, routes] = await Promise.all([
    Service.find({ status: { $in: PUBLIC } }).select('title location countyCode municipalityCode categories').lean(),
    require('../../models/Category').distinct('name', { isActive: true }),
    require('../../models/SearchLog').find({ at: { $gte: from } }).select('at kind text categories regions radiusKm results ms').lean(),
    Service.collection.indexes(),
    require('../../models/ApiMetricMinute').aggregate([
      { $match: { minute: { $gte: from } } },
      { $project: { key: { $concat: ['$method', ' ', '$route'] }, count: 1, c5xx: 1, p95: 1, slow: { $ifNull: ['$slow', 0] } } },
      { $match: { key: { $in: SEARCH_ROUTES } } },
      { $group: { _id: '$key', requests: { $sum: '$count' }, c5xx: { $sum: '$c5xx' }, slow: { $sum: '$slow' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } },
    ]),
  ]);

  const findings = listingFindings(services, categories);
  const issues = Object.entries(ISSUE).map(([key, meta]) => {
    const rows = findings.filter((f) => f.issue === key);
    return { key, ...meta, count: rows.length, samples: rows.slice(0, 15) };
  });

  // Search analytics.
  const bucket = days <= 1 ? 3_600_000 : DAY;
  const series = new Map();
  for (const l of logs) {
    const t = new Date(Math.floor(+l.at / bucket) * bucket).toISOString();
    const s = series.get(t) || { t, searches: 0, zero: 0 };
    s.searches += 1;
    if (!l.results) s.zero += 1;
    series.set(t, s);
  }
  const zero = logs.filter((l) => !l.results);
  const zeroTerms = {};
  for (const l of zero) {
    const k = [l.text && `"${l.text}"`, l.categories?.length && l.categories.join('/'), l.radiusKm && `${l.radiusKm} km`, l.regions && `${l.regions} region(s)`].filter(Boolean).join(' · ') || '(no filters)';
    zeroTerms[k] = (zeroTerms[k] || 0) + 1;
  }
  const ms = logs.map((l) => l.ms).sort((a, b) => a - b);
  const kindStats = (kind) => {
    const k = logs.filter((l) => l.kind === kind);
    return { searches: k.length, zeroRate: pct(k.filter((l) => !l.results).length, k.length) };
  };
  const geoIndex = indexes.find((i) => Object.values(i.key || {}).includes('2dsphere'));

  return {
    days,
    bucketMs: bucket,
    listings: { public: services.length, findable: services.length - new Set(findings.filter((f) => ['missing', 'zero', 'swapped', 'outside_norway'].includes(f.issue)).map((f) => f.id)).size },
    issues,
    geoIndex: geoIndex ? { name: geoIndex.name, key: Object.keys(geoIndex.key).join(', ') } : null,
    search: {
      total: logs.length,
      zeroResults: zero.length,
      zeroRate: pct(zero.length, logs.length),
      p50: p(ms, 0.5),
      p95: p(ms, 0.95),
      withText: logs.filter((l) => l.text).length,
      withRadius: logs.filter((l) => l.radiusKm).length,
      withRegion: logs.filter((l) => l.regions).length,
      byKind: { list: kindStats('list'), nearby: kindStats('nearby') },
      topZero: Object.entries(zeroTerms)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([query, n]) => ({ query, n })),
      radius: radiusBands(logs),
      series: [...series.values()].sort((a, b) => a.t.localeCompare(b.t)),
    },
    endpoints: routes.map((r) => ({ route: r._id, requests: r.requests, c5xx: r.c5xx, slowShare: pct(r.slow, r.requests), p95: r.requests ? Math.round(r.p95w / r.requests) : null })).sort((a, b) => b.requests - a.requests),
  };
}

module.exports = { recordSearch, geoIssue, listingFindings, overview, inNorway };
