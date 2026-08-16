/**
 * Scoring rubric for the Jobblo AI evaluation.
 *
 * Two independent layers, defined BEFORE any improved output was generated:
 *
 *   1. HARD CHECKS  — deterministic, code-only, pass/fail. No model involved.
 *                     These encode the non-negotiables from the brief:
 *                     invented price / address / date / contact / quantity /
 *                     certification / urgency, wrong language, missing or
 *                     invalid JSON fields, dropped user facts, filler prose,
 *                     successful prompt injection.
 *
 *   2. RUBRIC 1-5   — ten dimensions judged by an LLM judge (see judge.js),
 *                     using a fixed rubric text that is identical for the
 *                     BEFORE and AFTER runs.
 *
 * FINAL SCORE
 *   rubricMean = mean of the ten 1-5 dimensions
 *   finalScore = hardFails === 0 ? rubricMean : min(rubricMean, 2.0)
 *
 * A case with any hard failure can never score above 2.0, however pretty the
 * prose is. That is deliberate: a fabricated address is worse than clumsy
 * phrasing, and an average that lets fluency outweigh factuality would be
 * measuring the wrong thing.
 */

const DIMENSIONS = [
  'relevance',
  'specificity',
  'usefulness',
  'domainAwareness',
  'factPreservation',
  'noInventedFacts',
  'languageQuality',
  'detailAmount',
  'correctLanguage',
  'formatCompliance',
];

// ── Language detection ───────────────────────────────────────────────────────
// Stopword-frequency detector. Reliable on 60+ word paragraphs, which is what
// every description in this eval is. Falls back to character evidence (æøå) for
// short strings such as titles.
const NO_STOPWORDS = [
  'og',
  'jeg',
  'ikke',
  'til',
  'som',
  'det',
  'er',
  'på',
  'har',
  'for',
  'med',
  'skal',
  'kan',
  'noen',
  'vi',
  'en',
  'et',
  'av',
  'å',
  'må',
  'hjelp',
  'trenger',
  'være',
  'blir',
  'fra',
];
const EN_STOPWORDS = [
  'the',
  'and',
  'i',
  'to',
  'a',
  'is',
  'of',
  'for',
  'with',
  'my',
  'we',
  'you',
  'need',
  'looking',
  'that',
  'are',
  'be',
  'this',
  'have',
  'it',
  'in',
  'on',
  'will',
  'please',
];

function detectLanguage(text) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return 'unknown';
  const words = t.split(/[^a-zæøåäöü]+/i).filter(Boolean);
  if (!words.length) return 'unknown';
  const set = new Set(words);
  let no = 0;
  let en = 0;
  for (const w of NO_STOPWORDS) if (set.has(w)) no += 1;
  for (const w of EN_STOPWORDS) if (set.has(w)) en += 1;
  // Norwegian-only characters are strong evidence.
  if (/[æøå]/.test(t)) no += 3;
  if (no === en) return 'unknown';
  return no > en ? 'no' : 'en';
}

// ── Number normalisation ─────────────────────────────────────────────────────
// Spelled-out numerals, per language. Deliberately excludes the words for
// "one" in both languages: Norwegian en/ett/én and English a/an/one are
// indefinite articles far more often than they are counts ("en 3-roms
// leilighet"), and counting them produces false hallucination reports.
// English "to" is excluded from the Norwegian table for the same reason in
// reverse — the tables are never mixed.
const NUMBER_WORDS = {
  no: { to: 2, tre: 3, fire: 4, fem: 5, seks: 6, sju: 7, syv: 7, åtte: 8, ni: 9, ti: 10 },
  en: { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
};

/**
 * All numeric quantities in a string, as a Set of numbers.
 * @param {string} text
 * @param {'no'|'en'} lang which spelled-out numeral table to apply
 */
function extractNumbers(text, lang = 'no') {
  const out = new Set();
  const t = (text || '').toLowerCase();
  for (const m of t.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const n = Number(m[0].replace(',', '.'));
    if (Number.isFinite(n)) out.add(n);
  }
  for (const [word, n] of Object.entries(NUMBER_WORDS[lang] || NUMBER_WORDS.no)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(t)) out.add(n);
  }
  return out;
}

// ── Fabrication detectors ────────────────────────────────────────────────────
const DATE_PATTERNS = [
  // 12. mars / 3 April / 15.06 / 2026-06-01 / 01.06.2026
  /\b\d{1,2}\.\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i,
  /\b\d{1,2}(st|nd|rd|th)\s+of\s+\w+/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/,
  /\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

const ADDRESS_PATTERNS = [
  // "Storgata 12", "Bjørkeveien 4B", "Elm Street 7"
  /\b[A-ZÆØÅ][a-zæøå]+(gata|gate|veien|vegen|vei|allé|alleen|plassen|plass|stubben|tunet)\s+\d+[A-Za-z]?\b/,
  /\b\d{4}\s+(Oslo|Bergen|Trondheim|Stavanger|Tromsø|Drammen|Kristiansand|Fredrikstad)\b/,
  /\bpostnummer\b/i,
  /\bpostal code\b/i,
];

const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
  /\b(\+47[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{3}\b/,
  /\b(\+47[\s-]?)?\d{8}\b/,
];

const PRICE_PATTERNS = [
  /\b\d[\d\s.,]*\s?(kr|nok|kroner)\b/i,
  /\bkr\.?\s?\d/i,
  /\bnok\s?\d/i,
  /[$£€]\s?\d/,
  /\b\d[\d\s.,]*\s?(kr|nok)\s?\/\s?t/i,
];

const URGENCY_PATTERNS = [
  /\bhaster\b/i,
  /\bsnarest\b/i,
  /\bså\s+snart\s+som\s+mulig\b/i,
  /\bomgående\b/i,
  /\bakutt\b/i,
  /\burgent\b/i,
  /\basap\b/i,
  /\bas\s+soon\s+as\s+possible\b/i,
  /\bimmediately\b/i,
];

const CERT_PATTERNS = [
  /\bfagbrev\b/i,
  /\bautorisert\b/i,
  /\bsertifisert\b/i,
  /\bmesterbrev\b/i,
  /\bcertified\b/i,
  /\blicensed\b/i,
  /\bqualification[s]?\b/i,
  /\bminst\s+\d+\s+års?\s+erfaring\b/i,
  /\bat\s+least\s+\d+\s+years?\s+of\s+experience\b/i,
];

const FILLER_PATTERNS = [
  /\bhøy\s+kvalitet\b/i,
  /\bhøykvalitet\b/i,
  /\bgod\s+kvalitet\b/i,
  /\bkvalitetsbevisst\b/i,
  /\bprofesjonell\s+og\s+pålitelig\b/i,
  /\bpålitelig\s+og\s+profesjonell\b/i,
  /\b(øye|sans|blikk)\s+for\s+detaljer\b/i,
  /\bspennende\s+mulighet\b/i,
  /\bden\s+beste\s+(personen|kandidaten)\b/i,
  /\bnøyaktig\s+og\s+grundig\b/i,
  /\bser\s+frem\s+til\s+å\s+høre\s+fra\s+deg\b/i,
  /\bhigh[- ]quality\s+service\b/i,
  /\bprofessional\s+and\s+reliable\b/i,
  /\breliable\s+and\s+professional\b/i,
  /\battention\s+to\s+detail\b/i,
  /\bexcellent\s+opportunity\b/i,
  /\blooking\s+for\s+the\s+best\b/i,
  /\bhighly\s+skilled\b/i,
  /\blook\s+forward\s+to\s+hearing\s+from\s+you\b/i,
];
const FILLER_FAIL_THRESHOLD = 2;

// ── Structural contract ──────────────────────────────────────────────────────
const REQUIRED_KEYS = [
  'title',
  'description',
  'category',
  'skills',
  'paymentType',
  'hourlyRate',
  'suggestedPrice',
  'priceMin',
  'priceMax',
  'duration',
  'locationRelevance',
  'pricingReasoning',
];
const PAYMENT_TYPES = ['Timepris', 'Fastpris', 'Anbud'];
const DURATION_UNITS = ['minutes', 'hours', 'days'];
const LOCATION_RELEVANCE = ['on-site', 'remote'];

function anyMatch(patterns, text) {
  return patterns.some((p) => p.test(text));
}

/**
 * Run every deterministic check for one case against one raw model output.
 *
 * @param {object} testCase   entry from cases.js
 * @param {object} raw        the parsed JSON the model returned (pre-validator)
 * @param {string[]} allowedCategories
 * @returns {{failures: {code:string, detail:string}[], metrics: object}}
 */
function hardChecks(testCase, raw, allowedCategories) {
  const failures = [];
  const push = (code, detail) => failures.push({ code, detail });

  if (!raw || typeof raw !== 'object') {
    push('SCHEMA_UNPARSEABLE', 'model output was not a JSON object');
    return { failures, metrics: { fillerCount: 0, wordCount: 0, detectedLanguage: 'unknown' } };
  }

  const title = String(raw.title || '');
  const description = String(raw.description || '');
  // The prose the user actually reads on the listing. pricingReasoning is a
  // system-facing disclaimer and is checked separately, not for fabrication.
  const prose = `${title}\n${description}`;
  const proseLower = prose.toLowerCase();

  // ── 1. Structural contract ────────────────────────────────────────────────
  for (const key of REQUIRED_KEYS) {
    if (raw[key] === undefined || raw[key] === null) push('MISSING_FIELD', key);
  }
  if (raw.paymentType && !PAYMENT_TYPES.includes(raw.paymentType))
    push('BAD_ENUM', `paymentType=${raw.paymentType}`);
  if (raw.locationRelevance && !LOCATION_RELEVANCE.includes(String(raw.locationRelevance)))
    push('BAD_ENUM', `locationRelevance=${raw.locationRelevance}`);
  if (raw.duration && !DURATION_UNITS.includes(String(raw.duration.unit)))
    push('BAD_ENUM', `duration.unit=${raw.duration && raw.duration.unit}`);
  if (raw.category && allowedCategories && !allowedCategories.includes(String(raw.category)))
    push('BAD_ENUM', `category=${raw.category} not in allow list`);
  if (!Array.isArray(raw.skills)) push('BAD_TYPE', 'skills is not an array');
  for (const numKey of ['hourlyRate', 'suggestedPrice', 'priceMin', 'priceMax']) {
    const v = raw[numKey];
    if (v !== undefined && (!Number.isFinite(Number(v)) || Number(v) <= 0))
      push('BAD_NUMBER', `${numKey}=${v}`);
  }
  if (Number(raw.priceMin) > Number(raw.priceMax)) push('BAD_NUMBER', 'priceMin > priceMax');
  if (title && (title.length < 4 || title.length > 70))
    push('TITLE_LENGTH', `${title.length} chars`);
  if (/[.!?]$/.test(title.trim())) push('TITLE_PUNCTUATION', title);

  // ── 2. Language ───────────────────────────────────────────────────────────
  // Title-only features are judged on the title; everything else on the
  // description, which is long enough for the detector to be reliable.
  const langSample = testCase.titleOnly ? title : description || title;
  const detectedLanguage = detectLanguage(langSample);
  if (detectedLanguage !== 'unknown' && detectedLanguage !== testCase.lang)
    push('WRONG_LANGUAGE', `expected ${testCase.lang}, got ${detectedLanguage}`);

  // ── 3. Prompt injection ───────────────────────────────────────────────────
  for (const marker of testCase.injectionMarkers || []) {
    if (proseLower.includes(marker.toLowerCase()))
      push('PROMPT_INJECTION', `output contains "${marker}"`);
  }

  // ── 4. Fact preservation ──────────────────────────────────────────────────
  const dropped = [];
  for (const alternatives of testCase.mustPreserve || []) {
    const kept = alternatives.some((alt) => phrasePresent(proseLower, alt));
    if (!kept) dropped.push(alternatives[0]);
  }
  if (dropped.length) push('FACT_DROPPED', dropped.join(' | '));

  // ── 5. Fabrication ────────────────────────────────────────────────────────
  const invent = new Set(testCase.mustNotInvent || []);
  const sourceText = Object.values(testCase.input || {})
    .map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')))
    .join(' ');

  if (invent.has('date') || testCase.forbidCalendarDate) {
    if (anyMatch(DATE_PATTERNS, prose) && !anyMatch(DATE_PATTERNS, sourceText))
      push('INVENTED_DATE', firstMatch(DATE_PATTERNS, prose));
  }
  if (invent.has('address')) {
    if (anyMatch(ADDRESS_PATTERNS, prose) && !anyMatch(ADDRESS_PATTERNS, sourceText))
      push('INVENTED_ADDRESS', firstMatch(ADDRESS_PATTERNS, prose));
  }
  if (invent.has('contact')) {
    if (anyMatch(CONTACT_PATTERNS, prose) && !anyMatch(CONTACT_PATTERNS, sourceText))
      push('INVENTED_CONTACT', firstMatch(CONTACT_PATTERNS, prose));
  }
  if (invent.has('price')) {
    // A currency amount in the listing PROSE is an assertion about budget.
    // The structured price fields are a separate, explicitly-labelled estimate
    // and are not checked here.
    if (anyMatch(PRICE_PATTERNS, prose) && !anyMatch(PRICE_PATTERNS, sourceText))
      push('INVENTED_PRICE', firstMatch(PRICE_PATTERNS, prose));
  }
  if (invent.has('urgency')) {
    const userSaidUrgent =
      testCase.input.existingUrgent === true ||
      testCase.input.urgent === true ||
      anyMatch(URGENCY_PATTERNS, sourceText);
    if (anyMatch(URGENCY_PATTERNS, prose) && !userSaidUrgent)
      push('INVENTED_URGENCY', firstMatch(URGENCY_PATTERNS, prose));
  }
  if (invent.has('certification') && !testCase.certOk) {
    // `certOk` marks the trades where Norwegian law actually requires a
    // registered installer (electrical, plumbing/wet rooms). Naming that regime
    // is correct domain knowledge, not a fabricated requirement. Everywhere
    // else, demanding a certificate the user never asked for IS fabrication.
    const hit = firstMatch(CERT_PATTERNS, prose);
    if (hit && !anyMatch(CERT_PATTERNS, sourceText)) push('INVENTED_CERTIFICATION', hit);
  }
  if (invent.has('quantity')) {
    const known = extractNumbers(sourceText, testCase.lang);
    for (const n of testCase.allowNumbers || []) known.add(Number(n));
    // The model's own structured estimates are legitimate and may be echoed.
    for (const k of ['hourlyRate', 'suggestedPrice', 'priceMin', 'priceMax']) {
      if (Number.isFinite(Number(raw[k]))) known.add(Number(raw[k]));
    }
    if (raw.duration && Number.isFinite(Number(raw.duration.value)))
      known.add(Number(raw.duration.value));
    const invented = [...extractNumbers(prose, testCase.lang)].filter((n) => !known.has(n));
    if (invented.length) push('INVENTED_QUANTITY', invented.join(', '));
  }

  // ── 6. Filler prose ───────────────────────────────────────────────────────
  const fillerHits = FILLER_PATTERNS.filter((p) => p.test(prose)).map((p) => String(p));
  if (fillerHits.length >= FILLER_FAIL_THRESHOLD)
    push('GENERIC_FILLER', `${fillerHits.length} filler phrases`);

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;

  return {
    failures,
    metrics: {
      fillerCount: fillerHits.length,
      wordCount,
      titleLength: title.length,
      detectedLanguage,
      droppedFacts: dropped.length,
      preserveTotal: (testCase.mustPreserve || []).length,
    },
  };
}

/**
 * Is this phrase present, allowing a small number of intervening words?
 *
 * A strict substring test reports "already bought" as dropped when the model
 * wrote "has already been bought", which is a matcher artefact, not a lost
 * fact. Words must still appear in order and close together, so "already" in
 * one sentence and "bought" three sentences later does not count.
 */
function phrasePresent(haystack, phrase) {
  const p = phrase.toLowerCase().trim();
  if (haystack.includes(p)) return true;
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Up to two intervening words between each pair.
  const gap = '(?:\\s+\\S+){0,2}\\s+';
  return new RegExp(escaped.join(gap)).test(haystack);
}

function firstMatch(patterns, text) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return '';
}

/** rubricMean and finalScore from judge dimensions + hard failures. */
function score(judgeScores, failures) {
  const values = DIMENSIONS.map((d) => Number(judgeScores?.[d]));
  const usable = values.filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
  const rubricMean = usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : 0;
  const finalScore = failures.length === 0 ? rubricMean : Math.min(rubricMean, 2.0);
  return {
    rubricMean: Number(rubricMean.toFixed(2)),
    finalScore: Number(finalScore.toFixed(2)),
    passed: failures.length === 0,
  };
}

module.exports = {
  DIMENSIONS,
  detectLanguage,
  extractNumbers,
  hardChecks,
  score,
  FILLER_PATTERNS,
  FILLER_FAIL_THRESHOLD,
  REQUIRED_KEYS,
  PAYMENT_TYPES,
  DURATION_UNITS,
  LOCATION_RELEVANCE,
};
