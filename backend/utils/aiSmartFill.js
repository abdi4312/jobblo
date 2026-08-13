// ── Norwegian service-pricing heuristics (AI guardrails) ─────────────────────
// Real market reference: ~2025 Norwegian hourly service rates.
// No authoritative dataset exists in the project, so these are conservative
// heuristic anchors. AI is then asked to reason WITHIN [min, max] per category
// and to pick a sensible value based on scope. Ceiling/floor validation also
// runs AFTER model output, so even a hallucinated extreme gets rejected.
//
// ponytail: If a real pricing dataset is added later, replace this file with a
// database/table lookup and keep the same function signatures so callers don't
// change. The AI prompt can then reference "use DB rates +-20%" instead.

const NO_MINIMUM_HOURLY = 200; // ~lowest legal/service floor Norway (kr/time)
const NO_CAP_HOURLY = 900; // ~highest AI is allowed to suggest (kr/time)
const TOTAL_MIN = 100; // Lowest reasonable Fastpris/Anbud (kr)
const TOTAL_MAX = 250000; // Hard sanity cap — any total above is wrong

// Baseline heuristic hourly rate by category name (case-insensitive match).
// Order matters: first sub-string match wins, so put more specific words first.
const CATEGORY_HOURLY_ANCHORS = [
  { needle: 'rørlegger', kr: 620, note: 'fagutdannet, timelønn Norge 2025' },
  { needle: 'elektriker', kr: 600, note: 'fagutdannet el-installatør' },
  { needle: 'varmepumpe', kr: 580, note: 'tekniker installasjon' },
  { needle: 'maling', kr: 420, note: 'maler' },
  { needle: 'male', kr: 420, note: 'maler' },
  { needle: 'tapet', kr: 430, note: 'tapetsering' },
  { needle: 'oppussing', kr: 440, note: 'tømrer/oppusser' },
  { needle: 'tømrer', kr: 450, note: 'tømrer' },
  { needle: 'rengjøring', kr: 360, note: 'rengjører' },
  { needle: 'flytting', kr: 400, note: 'flyttehjelp, to personer vanlig' },
  { needle: 'flyttehjelp', kr: 400, note: 'flyttehjelp' },
  { needle: 'transport', kr: 430, note: 'sjåfør + varebil' },
  { needle: 'hagearbeid', kr: 360, note: 'hagearbeider' },
  { needle: 'hage', kr: 360, note: 'hagearbeider' },
  { needle: 'småjobber', kr: 390, note: 'manuell, varierende' },
  { needle: 'mont', kr: 390, note: 'møbelmontering' },
  { needle: 'montering', kr: 390, note: 'møbelmontering' },
  { needle: 'møbel', kr: 390, note: 'møbelmontering' },
  { needle: 'vask', kr: 360, note: 'rengjøring' },
  { needle: 'flyttevask', kr: 380, note: 'intensiv rengjøring etter flytting' },
  { needle: 'snø', kr: 410, note: 'snømåking' },
  { needle: 'snømåking', kr: 410, note: 'snømåking' },
  { needle: 'plen', kr: 360, note: 'hagearbeid' },
  { needle: 'gress', kr: 360, note: 'hagearbeid' },
];

// Smart duration heuristics by category — only used when user didn't send one.
// { value, unit }
const CATEGORY_DURATION_ANCHORS = [
  { needle: 'rengjøring', value: 3, unit: 'hours' },
  { needle: 'flytting', value: 4, unit: 'hours' },
  { needle: 'flyttehjelp', value: 4, unit: 'hours' },
  { needle: 'maling', value: 6, unit: 'hours' },
  { needle: 'male', value: 6, unit: 'hours' },
  { needle: 'hagearbeid', value: 4, unit: 'hours' },
  { needle: 'hage', value: 4, unit: 'hours' },
  { needle: 'oppussing', value: 8, unit: 'hours' },
  { needle: 'rørlegger', value: 3, unit: 'hours' },
  { needle: 'småjobber', value: 2, unit: 'hours' },
  { needle: 'transport', value: 4, unit: 'hours' },
  { needle: 'montering', value: 3, unit: 'hours' },
  { needle: 'møbel', value: 3, unit: 'hours' },
  { needle: 'mont', value: 3, unit: 'hours' },
  { needle: 'snø', value: 2, unit: 'hours' },
  { needle: 'snømåking', value: 2, unit: 'hours' },
  { needle: 'flyttevask', value: 4, unit: 'hours' },
  { needle: 'vask', value: 3, unit: 'hours' },
  { needle: 'tømrer', value: 6, unit: 'hours' },
  { needle: 'tapet', value: 5, unit: 'hours' },
];

const PAYMENT_TYPES = ['Timepris', 'Fastpris', 'Anbud'];
const DURATION_UNITS = ['minutes', 'hours', 'days'];

function _match(list, categoryName) {
  if (!categoryName) return null;
  const c = String(categoryName).toLowerCase();
  return list.find((r) => c.includes(r.needle));
}

function anchorHourlyRate(categoryName) {
  const hit = _match(CATEGORY_HOURLY_ANCHORS, categoryName);
  return hit ? hit.kr : 390; // fallback = Småjobber
}

function anchorDuration(categoryName) {
  const hit = _match(CATEGORY_DURATION_ANCHORS, categoryName);
  return hit ? { value: hit.value, unit: hit.unit } : { value: 2, unit: 'hours' };
}

// Convert any duration { value, unit } to hours — used for totals.
function durationToHours(duration) {
  if (!duration) return NaN;
  const v = Number(duration.value);
  if (!isFinite(v) || v <= 0) return NaN;
  switch ((duration.unit || 'hours').toLowerCase()) {
    case 'minutes':
      return v / 60;
    case 'hours':
      return v;
    case 'days':
      return v * 8;
    default:
      return NaN;
  }
}

// Strict validator for AI smart-fill output. Runs AFTER model returns so even
// a malformed or extreme answer can't touch the form. Validator does NOT trust
// the model — it treats AI output as "untrusted input".
//
// input: { title, hourlyRate, suggestedPrice, priceMin, priceMax, duration,
//          description, skills, category, paymentType, pricingReasoning }
//
// ctx:   { existingUserFields, categoryName (from db), userPaymentType }
//
// Returns: { valid: true, cleaned }  OR  { valid: false, errors: [..], fallback? }
function validateSmartFillOutput(raw, ctx = {}) {
  const errors = [];
  const cleaned = {};

  // 1. Title — non-empty, length bounded by UI max (70 from current form).
  let title = ((raw && raw.title) || '').toString().trim();
  // Strip leading/trailing generic phrases the model tends to emit.
  // Multi-pass so stacked prefixes like "Hjelp ønskes: Jeg trenger..." get stripped.
  for (let pass = 0; pass < 3; pass++) {
    const before = title;
    title = title
      // Leading generic prefixes (Norwegian + English)
      .replace(/^(Jeg\s+trenger\s+(hjelp|noen)\s+(med|til)\s*[:\-\s]*)/i, '')
      .replace(/^(Leter\s+etter\s+(noen|en)\s+(som\s+)?(kan\s+)?)/i, '')
      .replace(/^(Hjelp\s+ønskes\s*[:\-\s]*)/i, '')
      .replace(/^(Oppdrag\s*[:\-\s]+)/i, '')
      .replace(/^(Jobb\s*[:\-\s]+)/i, '')
      .replace(/^(Tjeneste\s*[:\-\s]+)/i, '')
      .replace(/^(Trenger\s+hjelp\s+(med|til)\s*[:\-\s]*)/i, '')
      .replace(/^(Ønsker\s+(hjelp|å\s+lei[e]?)\s+(noen|en)\s*(som\s*)?)/i, '')
      .replace(/^(Nødt\s+til\s+hjelp\s+(med|til)\s*)/i, '')
      .replace(/^(Kan\s+noen\s+hjelpe\s+(meg\s*)?(med|til)?\s*[:\-\s]*)/i, '')
      .replace(/^(Jobb\s+tilgjengelig\s*[:\-\s]*)/i, '')
      .replace(/^(Hjelp\s+til\s+)/i, '')
      // Also strip leading colon/dash if prefix removal left one
      .replace(/^[:\-\s]+/, '')
      // Trailing punctuation (never in a job title)
      .replace(/[.!?]+$/g, '')
      .trim();
    if (title === before) break;
  }
  // Strip standalone generic titles that are still too weak after prefix removal.
  const GENERIC_STANDALONE = new Set([
    'hjelp',
    'hjelp ønskes',
    'jobb',
    'oppdrag',
    'tjeneste',
    'jobb tilgjengelig',
    'trenger hjelp',
    'leter etter noen',
    'kan noen hjelpe',
    'småjobber',
    'hjelp til',
    'diverse arbeid',
    'forskjellig arbeid',
    'manuel hjelp',
  ]);
  if (GENERIC_STANDALONE.has(title.toLowerCase())) {
    // Replace with empty so caller can decide fallback — we'll keep the raw
    // stripped version but flag it; validator can still pass if length OK but
    // it's better to let caller know.
    errors.push('title: standalone generic phrase stripped');
    // Leave as-is for now — frontend shows what AI said, but we flag it in errors.
  }
  if (!title) errors.push('title: empty');
  if (title.length > 70) title = title.slice(0, 69).trimEnd() + '…';
  if (title.length < 4) errors.push('title: too short');
  cleaned.title = title;

  // 2. Payment type — only 3 allowed (same as frontend).
  let paymentType = ((raw && raw.paymentType) || ctx.userPaymentType || 'Fastpris').toString();
  if (!PAYMENT_TYPES.includes(paymentType)) paymentType = 'Fastpris';
  cleaned.paymentType = paymentType;

  // 3. Hourly rate — numeric, bounded.
  let hourlyRate = Number(raw && raw.hourlyRate);
  const anchor = anchorHourlyRate(ctx.categoryName);
  if (!isFinite(hourlyRate) || hourlyRate <= 0) hourlyRate = anchor;
  // Clamp to global floor/ceiling, plus a soft band around the category anchor.
  const softMin = Math.max(NO_MINIMUM_HOURLY, Math.round(anchor * 0.8));
  const softMax = Math.min(NO_CAP_HOURLY, Math.round(anchor * 1.35));
  if (hourlyRate < softMin) {
    hourlyRate = softMin;
    errors.push('hourlyRate: clamped below heuristic');
  }
  if (hourlyRate > softMax) {
    hourlyRate = softMax;
    errors.push('hourlyRate: clamped above heuristic');
  }
  cleaned.hourlyRate = Math.round(hourlyRate);

  // 4. Duration — parse, bounded, sensible unit.
  let duration = (raw && raw.duration) || anchorDuration(ctx.categoryName);
  const dv = Number(duration.value);
  let du = (duration.unit || 'hours').toString().toLowerCase();
  if (!DURATION_UNITS.includes(du)) du = 'hours';
  if (!isFinite(dv) || dv <= 0) {
    const a = anchorDuration(ctx.categoryName);
    cleaned.duration = a;
    errors.push('duration: invalid, fallback to anchor');
  } else {
    // Cap raw durations to avoid absurd totals.
    let value = dv;
    if (du === 'days' && value > 30) {
      value = 30;
      errors.push('duration: clamped to 30 days');
    } else if (du === 'hours' && value > 240) {
      value = 240;
      errors.push('duration: clamped to 240 hours');
    } else if (du === 'minutes' && value > 14400) {
      value = 14400;
      errors.push('duration: clamped');
    }
    cleaned.duration = { value, unit: du };
  }
  const hours = durationToHours(cleaned.duration);

  // 5. priceMin / suggestedPrice / priceMax — numeric, positive, internally ordered,
  // bounded by heuristic total (anchor * duration * [0.7, 1.5]).
  const heuristicTotal = isFinite(hours) ? Math.round(cleaned.hourlyRate * hours) : anchor;
  const MIN_TOTAL_ALLOWED = Math.max(TOTAL_MIN, Math.round(heuristicTotal * 0.5));
  const MAX_TOTAL_ALLOWED = Math.min(TOTAL_MAX, Math.round(heuristicTotal * 2.5));

  const parsePrice = (v, fallback) => {
    let n = Number(v);
    // Defensive: strip -0, NaN, Infinity
    if (!isFinite(n)) n = NaN;
    if (Object.is(n, -0)) n = 0;
    if (!isFinite(n) || n <= 0 || isNaN(n))
      return Math.max(MIN_TOTAL_ALLOWED, Math.round(fallback));
    n = Math.round(n);
    if (n < MIN_TOTAL_ALLOWED) return MIN_TOTAL_ALLOWED;
    if (n > MAX_TOTAL_ALLOWED) return MAX_TOTAL_ALLOWED;
    return n;
  };

  const safeHeuristicTotal = Math.max(MIN_TOTAL_ALLOWED, Math.round(heuristicTotal || TOTAL_MIN));

  let suggested = parsePrice(raw && raw.suggestedPrice, safeHeuristicTotal);
  let minP = parsePrice(
    raw && raw.priceMin,
    Math.max(MIN_TOTAL_ALLOWED, Math.round(suggested * 0.85))
  );
  let maxP = parsePrice(
    raw && raw.priceMax,
    Math.min(MAX_TOTAL_ALLOWED, Math.round(suggested * 1.15))
  );
  if (minP > suggested) minP = suggested;
  if (maxP < suggested) maxP = suggested;
  if (minP > maxP) maxP = Math.min(MAX_TOTAL_ALLOWED, minP + 1);
  // Final defensive numeric sanitation
  cleaned.suggestedPrice = Math.max(
    MIN_TOTAL_ALLOWED,
    Math.round(Number(suggested) || safeHeuristicTotal)
  );
  cleaned.priceMin = Math.max(MIN_TOTAL_ALLOWED, Math.round(Number(minP) || safeHeuristicTotal));
  cleaned.priceMax = Math.max(
    cleaned.priceMin + 1,
    Math.min(MAX_TOTAL_ALLOWED, Math.round(Number(maxP) || cleaned.priceMin + 1))
  );
  cleaned.heuristicTotal = safeHeuristicTotal; // written but returned separately — UI doesn't show it

  // Payment-type remapping. For Timepris we still return a total (for UX),
  // but the primary value is hourlyRate. For Anbud we return the suggested as
  // the reference budget the user asked AI to estimate.
  cleaned.primaryPrice = Math.max(
    NO_MINIMUM_HOURLY,
    Math.round(
      Number(paymentType === 'Timepris' ? cleaned.hourlyRate : cleaned.suggestedPrice) ||
        NO_MINIMUM_HOURLY
    )
  );

  // 6. Description — bounded length. Keep if provided, else empty.
  let desc = ((raw && raw.description) || '').toString().trim();
  if (desc.length > 2000) desc = desc.slice(0, 1997) + '…';
  cleaned.description = desc;

  // 7. Skills — deduped, bounded to 5.
  let skills = Array.isArray(raw && raw.skills) ? raw.skills.slice() : [];
  skills = Array.from(
    new Set(skills.map((s) => (s || '').toString().trim()).filter(Boolean))
  ).slice(0, 5);
  cleaned.skills = skills;

  // 8. Category — if AI suggested one that is in the allowed list keep it,
  // else fall back to user's existing (don't let AI move jobs to unknown cats).
  const catAllowed = Array.isArray(ctx.categoryAllowList)
    ? new Set(ctx.categoryAllowList.map((c) => (typeof c === 'string' ? c : c.name)))
    : null;
  let cat = ((raw && raw.category) || '').toString().trim();
  if (catAllowed) {
    if (!catAllowed.has(cat)) {
      if (ctx.userCategory && catAllowed.has(ctx.userCategory)) cat = ctx.userCategory;
      else cat = '';
    }
  }
  cleaned.category = cat;

  // 9. Reasoning — short, bounded, NOT trusted to be factual.
  // CRITICAL GUARDRAIL: if AI's reasoning claims to be authoritative market
  // data (doesn't look like an estimate), we prefix/suffix with an explicit
  // "this is an estimate" disclaimer so the UI never accidentally presents
  // heuristic numbers as official Norwegian market rates.
  let reasoning = ((raw && raw.pricingReasoning) || (raw && raw.reason) || '').toString().trim();
  const looksLikeEstimate =
    /(estimat|omtrent|ca\.?|cirka|tilnærmet|heuristisk|ikke\s+offisiell|ikke\s+autorisert|anbefalt\s+prisforslag)/i.test(
      reasoning
    );
  if (!reasoning) {
    const ptText =
      cleaned.paymentType === 'Timepris'
        ? 'Timepris'
        : cleaned.paymentType === 'Anbud'
          ? 'Anbud (budsjettreferanse)'
          : 'Fastpris';
    reasoning = `Estimat (${ptText}) – ikke offisiell markedssats. Heuristisk anslag basert på kategori (${cleaned.category || 'småjobber'}) og anslått varighet i Norge 2025.`;
  } else if (!looksLikeEstimate) {
    // AI forgot to label as estimate — we inject the mandatory disclaimer
    reasoning = `[ESTIMAT – ikke markedssats] ${reasoning}`;
  }
  if (reasoning.length > 400) reasoning = reasoning.slice(0, 397) + '…';
  cleaned.pricingReasoning = reasoning;

  // 10. locationRelevance — only on-site or remote, default on-site.
  let loc = ((raw && raw.locationRelevance) || 'on-site').toString().toLowerCase();
  if (!['on-site', 'remote'].includes(loc)) loc = 'on-site';
  cleaned.locationRelevance = loc;

  // FINAL SANITY ASSERT: all numeric price fields must be strictly positive
  // finite integers. If anything is borked we silently rewrite from anchor
  // rather than let malformed numbers touch the user's form.
  const _assertPositiveFiniteInt = (n, fallback) => {
    const x = Number(n);
    return isFinite(x) && x > 0 && Math.floor(x) === x ? x : Math.round(fallback);
  };
  cleaned.hourlyRate = _assertPositiveFiniteInt(
    cleaned.hourlyRate,
    anchorHourlyRate(ctx.categoryName)
  );
  cleaned.suggestedPrice = _assertPositiveFiniteInt(cleaned.suggestedPrice, cleaned.heuristicTotal);
  cleaned.priceMin = _assertPositiveFiniteInt(
    cleaned.priceMin,
    Math.max(TOTAL_MIN, Math.round(cleaned.suggestedPrice * 0.85))
  );
  cleaned.priceMax = _assertPositiveFiniteInt(
    cleaned.priceMax,
    Math.min(TOTAL_MAX, Math.round(cleaned.suggestedPrice * 1.15))
  );
  cleaned.primaryPrice = _assertPositiveFiniteInt(cleaned.primaryPrice, cleaned.hourlyRate);
  if (cleaned.priceMin > cleaned.suggestedPrice) cleaned.priceMin = cleaned.suggestedPrice;
  if (cleaned.priceMax < cleaned.suggestedPrice) cleaned.priceMax = cleaned.suggestedPrice;
  if (cleaned.priceMin >= cleaned.priceMax)
    cleaned.priceMax = Math.min(TOTAL_MAX, cleaned.priceMin + 1);

  return {
    valid: errors.length === 0 || (cleaned.title.length >= 4 && cleaned.primaryPrice > 0),
    errors,
    cleaned,
  };
}

module.exports = {
  PAYMENT_TYPES,
  DURATION_UNITS,
  NO_MINIMUM_HOURLY,
  NO_CAP_HOURLY,
  TOTAL_MIN,
  TOTAL_MAX,
  anchorHourlyRate,
  anchorDuration,
  durationToHours,
  validateSmartFillOutput,
};
