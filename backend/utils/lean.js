/**
 * `.lean()` skips Mongoose document hydration — on the public job list that was half of the
 * API's CPU under load. But a hydrated document's JSON also carries schema defaults for
 * fields missing in the stored document, and the virtuals of populated users. withDefaults
 * puts exactly those back, so a lean response is the same JSON as before.
 *
 *   const rows = withDefaults(Service, await Service.find(q).populate('userId', '…').lean());
 */

/** Pure: top-level paths with a static default (function defaults like Date.now are skipped). */
function staticDefaults(schema) {
  const out = [];
  schema.eachPath((path, type) => {
    if (path.includes('.') || path === '_id' || path === '__v') return;
    const d = type.defaultValue;
    if (d === undefined || typeof d === 'function') return;
    out.push([path, d]);
  });
  return out;
}

const cache = new WeakMap();
const defaultsOf = (schema) => {
  if (!cache.has(schema)) cache.set(schema, staticDefaults(schema));
  return cache.get(schema);
};
const clone = (v) => (Array.isArray(v) ? [...v] : v && typeof v === 'object' && !(v instanceof Date) ? { ...v } : v);

/** A populated user as toJSON({ virtuals: true }) renders it: `id` and `totalEarned`. */
function userVirtuals(u) {
  if (!u || typeof u !== 'object' || !u._id) return u;
  return { ...u, totalEarned: u.earnings || 0, id: String(u._id) };
}

function withDefaults(Model, docs, { populatedUsers = ['userId'] } = {}) {
  if (!Model?.schema) return docs; // a test double without a schema
  const defs = defaultsOf(Model.schema);
  const one = (doc) => {
    if (!doc) return doc;
    const out = { ...doc };
    for (const [path, d] of defs) if (out[path] === undefined) out[path] = clone(d);
    for (const p of populatedUsers) if (out[p] && typeof out[p] === 'object' && out[p]._id) out[p] = userVirtuals(out[p]);
    return out;
  };
  return Array.isArray(docs) ? docs.map(one) : one(docs);
}

module.exports = { withDefaults, staticDefaults };
