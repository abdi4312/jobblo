const crypto = require('crypto');

/**
 * API contract monitoring.
 *
 * A sampler wraps res.json on user-facing API routes and records the SHAPE of a share of
 * responses (field paths + JSON types, never values). Every distinct shape per endpoint and
 * status class is a "variant". When a new variant appears it is compared with everything
 * seen before on that endpoint:
 *   removed       a field present in ≥ 90 % of earlier responses is missing   → breaking
 *   type_changed  a field arrives with a type it never had (null excepted)    → breaking
 *   added         a field never seen before                                  → additive
 * Optional fields (present < 90 %) never count as removed, so normal variation is quiet.
 * Each change is stamped with the running release, so it lines up with Deployment Impact.
 *
 * Also: Swagger-documented paths vs. routes that actually receive traffic.
 */

const MAX_PATHS = 300;
const MAX_DEPTH = 6;
const MAX_VARIANTS = 30;
const MIN_PRIOR_SAMPLES = 20;
const REQUIRED_SHARE = 0.9;
const EXCLUDED = /^\/api\/(developer|mobile\/telemetry|docs)(\/|$)/;
// Keys that are data, not schema (ids, emails, dates, numbers) collapse to "*".
const DYNAMIC_KEY = /^[0-9a-f]{24}$|@|^\d|^\d{4}-\d{2}|^[0-9a-f-]{36}$/i;

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : v instanceof Date ? 'string' : v && v._bsontype === 'ObjectId' ? 'string' : typeof v);

/** Pure: { path → type } for a JSON value. Arrays use "[]"; only the first 5 items are walked. Unit-tested. */
function shapeOf(value) {
  const out = new Map();
  const walk = (v, path, depth) => {
    if (out.size >= MAX_PATHS) return;
    if (v && typeof v.toJSON === 'function' && !(v instanceof Date)) v = v.toJSON();
    const t = typeOf(v);
    if (path) {
      const prev = out.get(path);
      out.set(path, prev && prev !== t ? (prev === 'null' ? t : t === 'null' ? prev : 'mixed') : t);
    }
    if (depth >= MAX_DEPTH) return;
    if (t === 'array') {
      for (const item of v.slice(0, 5)) walk(item, `${path}[]`, depth + 1);
    } else if (t === 'object') {
      const keys = Object.keys(v);
      // A map keyed by data (ids, dates, emails) collapses to "*"; a normal object keeps its
      // field names and only an odd data-like key becomes "*".
      const dynamicKeys = keys.filter((k) => DYNAMIC_KEY.test(k)).length;
      const isMap = keys.length > 50 || (keys.length >= 2 && dynamicKeys / keys.length > 0.5);
      for (const k of isMap ? keys.slice(0, 5) : keys) {
        const name = isMap || DYNAMIC_KEY.test(k) ? '*' : k;
        walk(v[k], path ? `${path}.${name}` : name, depth + 1);
      }
    }
  };
  walk(value, '', 0);
  return out;
}

const toPairs = (map) => [...map].sort((a, b) => a[0].localeCompare(b[0]));
const signature = (pairs) => crypto.createHash('sha1').update(pairs.map((p) => p.join(':')).join('|')).digest('hex').slice(0, 16);

/** Pure: changes a new shape makes relative to earlier variants. Unit-tested. */
function classify(prior, fields) {
  const total = prior.reduce((a, v) => a + v.count, 0);
  if (total < MIN_PRIOR_SAMPLES) return [];
  const presence = new Map();
  const types = new Map();
  for (const v of prior) {
    for (const [p, t] of v.fields) {
      presence.set(p, (presence.get(p) || 0) + v.count);
      if (!types.has(p)) types.set(p, new Set());
      types.get(p).add(t);
    }
  }
  const now = new Map(fields);
  const changes = [];
  // A field cannot be "removed" when an ancestor array is empty now (no items to inspect)
  // or an ancestor object is null now (a nullable parent).
  const keys = [...now.keys()];
  const underEmpty = (p) => {
    for (let i = p.indexOf('[]'); i !== -1; i = p.indexOf('[]', i + 2)) {
      const prefix = p.slice(0, i + 2);
      if (now.get(p.slice(0, i)) === 'array' && !keys.some((k) => k.startsWith(prefix))) return true;
    }
    return false;
  };
  const underNull = (p) => [...now].some(([k, t]) => t === 'null' && (p.startsWith(`${k}.`) || p.startsWith(`${k}[]`)));
  for (const [p, n] of presence) {
    if (n / total >= REQUIRED_SHARE && !now.has(p) && !underEmpty(p) && !underNull(p)) changes.push({ kind: 'removed', breaking: true, path: p, detail: `present in ${Math.round((n / total) * 100)}% of ${total} earlier responses` });
  }
  for (const [p, t] of now) {
    if (!presence.has(p)) changes.push({ kind: 'added', breaking: false, path: p, detail: `new ${t} field` });
    else if (t !== 'null' && t !== 'mixed' && !types.get(p).has(t) && !(types.get(p).size === 1 && types.get(p).has('null'))) {
      changes.push({ kind: 'type_changed', breaking: true, path: p, detail: `${[...types.get(p)].join('/')} → ${t}` });
    }
  }
  // A removed parent implies its children; report the parent only.
  const removed = new Set(changes.filter((c) => c.kind === 'removed').map((c) => c.path));
  return changes.filter((c) => !(c.kind === 'removed' && [...removed].some((r) => r !== c.path && (c.path.startsWith(`${r}.`) || c.path.startsWith(`${r}[]`)))));
}

const buffer = new Map(); // key → Map(sig → { pairs, count, at })
const seen = new Map(); // key → samples this process (for the sampling rate)

/** res.json wrapper. Samples every response until an endpoint has 100, then 5 %. */
function contractSampler(req, res, next) {
  if (!req.originalUrl.startsWith('/api/') || EXCLUDED.test(req.originalUrl)) return next();
  const original = res.json.bind(res);
  res.json = (body) => {
    try {
      const cls = res.statusCode >= 200 && res.statusCode < 300 ? '2xx' : res.statusCode >= 400 && res.statusCode < 500 ? '4xx' : null;
      if (cls && req.route) {
        const route = `${req.baseUrl || ''}${Array.isArray(req.route.path) ? req.route.path.join('|') : req.route.path}`;
        const key = `${req.method} ${route} ${cls}`;
        const n = seen.get(key) || 0;
        if (n < 100 || Math.random() < 0.05) {
          seen.set(key, n + 1);
          const pairs = toPairs(shapeOf(body));
          const sig = signature(pairs);
          if (!buffer.has(key)) buffer.set(key, new Map());
          const b = buffer.get(key);
          const cur = b.get(sig) || { pairs, count: 0, at: new Date() };
          cur.count += 1;
          b.set(sig, cur);
        }
      }
    } catch {
      /* sampling must never break a response */
    }
    return original(body);
  };
  return next();
}

async function flush() {
  if (!buffer.size) return;
  const ApiContract = require('../../models/ApiContract');
  const ContractEvent = require('../../models/ContractEvent');
  const { version, commit } = require('./deployments').identity();
  const batch = [...buffer];
  buffer.clear();
  for (const [key, sigs] of batch) {
    const [method, route, status] = key.split(' ');
    const doc = (await ApiContract.findOne({ method, route, status })) || new ApiContract({ method, route, status, firstSeen: new Date() });
    for (const [sig, s] of sigs) {
      const existing = doc.variants.find((v) => v.sig === sig);
      if (existing) {
        existing.count += s.count;
        existing.lastSeen = new Date();
      } else {
        const changes = classify(doc.variants, s.pairs);
        if (changes.length) await ContractEvent.insertMany(changes.map((c) => ({ ...c, at: s.at, method, route, status, version, commit })));
        doc.variants.push({ sig, count: s.count, firstSeen: s.at, lastSeen: new Date(), version, commit, fields: s.pairs });
        if (doc.variants.length > MAX_VARIANTS) {
          // ponytail: drop the least-seen variants beyond 30; their samples still count in `samples`.
          doc.variants.sort((a, b) => b.count - a.count);
          doc.variants.splice(MAX_VARIANTS);
        }
      }
      doc.samples += s.count;
    }
    doc.lastSeen = new Date();
    await doc.save().catch((e) => console.error('[contracts] save failed:', e.message));
  }
}

function startContracts() {
  if (process.env.NODE_ENV === 'test') return;
  setInterval(() => flush().catch((e) => console.error('[contracts] flush failed:', e.message)), 60_000).unref();
}

/** Pure: "/api/services/{id}" → "/api/services/:id". */
const fromSwagger = (p) => p.replace(/\{([^}]+)\}/g, ':$1').replace(/(.)\/+$/, '$1');
const normalize = (p) => p.replace(/:[^/]+/g, ':x').replace(/\/+$/, '').toLowerCase();

/** Documented (Swagger) vs. routes with traffic in the last 30 days. */
async function docsCoverage() {
  let documented = [];
  try {
    const spec = require('../../swagger');
    documented = Object.entries(spec.paths || {}).flatMap(([p, ops]) => Object.keys(ops).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).map((m) => `${m.toUpperCase()} ${fromSwagger(p)}`));
  } catch {
    /* no spec */
  }
  const traffic = await require('../../models/ApiMetricMinute').aggregate([
    { $match: { minute: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, route: { $regex: '^/api/', $not: /\/\*$|^\/api\/(developer|mobile\/telemetry|docs)/ } } },
    { $group: { _id: { m: '$method', r: '$route' }, n: { $sum: '$count' } } },
  ]);
  const used = traffic.map((t) => ({ key: `${t._id.m} ${t._id.r}`, n: t.n }));
  const docNorm = new Set(documented.map((d) => { const [m, p] = d.split(' '); return `${m} ${normalize(p)}`; }));
  const usedNorm = new Set(used.map((u) => { const [m, p] = u.key.split(' '); return `${m} ${normalize(p)}`; }));
  return {
    documented: documented.length,
    used: used.length,
    undocumented: used.filter((u) => { const [m, p] = u.key.split(' '); return !docNorm.has(`${m} ${normalize(p)}`); }).sort((a, b) => b.n - a.n),
    unused: documented.filter((d) => { const [m, p] = d.split(' '); return !usedNorm.has(`${m} ${normalize(p)}`); }).sort(),
  };
}

async function getContracts() {
  const ApiContract = require('../../models/ApiContract');
  const ContractEvent = require('../../models/ContractEvent');
  const [contracts, events, docs] = await Promise.all([
    ApiContract.find().sort({ lastSeen: -1 }).select('method route status samples firstSeen lastSeen variants.sig variants.count variants.firstSeen variants.version').lean(),
    ContractEvent.find().sort({ at: -1 }).limit(200).populate('acknowledgedBy', 'name').lean(),
    docsCoverage(),
  ]);
  const breakingByRoute = {};
  for (const e of events) if (e.breaking && !e.acknowledgedAt) breakingByRoute[`${e.method} ${e.route} ${e.status}`] = (breakingByRoute[`${e.method} ${e.route} ${e.status}`] || 0) + 1;
  return {
    generatedAt: new Date(),
    endpoints: contracts.map((c) => ({ ...c, variants: c.variants.length, openBreaking: breakingByRoute[`${c.method} ${c.route} ${c.status}`] || 0, stable: c.variants.length > 0 ? Math.round((Math.max(...c.variants.map((v) => v.count)) / Math.max(1, c.samples)) * 100) : null })),
    events,
    docs,
    summary: {
      endpoints: contracts.length,
      samples: contracts.reduce((a, c) => a + c.samples, 0),
      openBreaking: events.filter((e) => e.breaking && !e.acknowledgedAt).length,
      additive7d: events.filter((e) => !e.breaking && Date.now() - new Date(e.at) < 7 * 24 * 60 * 60 * 1000).length,
      undocumented: docs.undocumented.length,
    },
  };
}

async function getContract(method, route, status) {
  const ApiContract = require('../../models/ApiContract');
  const c = await ApiContract.findOne({ method, route, status }).lean();
  if (!c) return null;
  const presence = new Map();
  const types = new Map();
  for (const v of c.variants) {
    for (const [p, t] of v.fields) {
      presence.set(p, (presence.get(p) || 0) + v.count);
      if (!types.has(p)) types.set(p, new Set());
      types.get(p).add(t);
    }
  }
  const total = c.variants.reduce((a, v) => a + v.count, 0) || 1;
  const events = await require('../../models/ContractEvent').find({ method, route, status }).sort({ at: -1 }).limit(50).populate('acknowledgedBy', 'name').lean();
  return {
    method,
    route,
    status,
    samples: c.samples,
    firstSeen: c.firstSeen,
    lastSeen: c.lastSeen,
    fields: [...presence].map(([path, n]) => ({ path, types: [...types.get(path)], presence: Math.round((n / total) * 1000) / 10, required: n / total >= REQUIRED_SHARE })).sort((a, b) => a.path.localeCompare(b.path)),
    variants: c.variants.map((v) => ({ sig: v.sig, count: v.count, firstSeen: v.firstSeen, lastSeen: v.lastSeen, version: v.version, commit: v.commit, fieldCount: v.fields.length })).sort((a, b) => b.count - a.count),
    events,
  };
}

module.exports = { shapeOf, signature, toPairs, classify, contractSampler, flush, startContracts, docsCoverage, getContracts, getContract, fromSwagger };
