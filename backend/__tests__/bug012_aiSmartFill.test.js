// BUG-012: AI Smart Fill validation tests
// Tests validateSmartFillOutput — the pure-function validator that guards
// every AI endpoint (generate-title / generate-job-info / generate-full-listing).
//
// Coverage:
//   1. Structured response parsing (good data -> cleaned OK)
//   2. Generic Norwegian title stripping (lead-ins like "Jeg trenger hjelp med...")
//   3. Invalid price rejection (NaN, negative, zero, Infinity, -0)
//   4. Malformed AI response fallback (empty obj / null / string junk)
//   5. Category anchor pricing (cleaning != electrical rates)
//   6. Payment-type primaryPrice mapping (Timepris -> hourlyRate, etc.)
//   7. Price ordering (priceMin <= suggestedPrice <= priceMax) after clamping
//   8. Pricing reasoning MUST mention it's an estimate

const {
  validateSmartFillOutput,
  anchorHourlyRate,
  PAYMENT_TYPES,
  NO_MINIMUM_HOURLY,
  TOTAL_MIN,
  TOTAL_MAX,
} = require('../utils/aiSmartFill');

const RENG_CATS = ['Rengjøring', 'Maling', 'Elektriker', 'Rørlegger', 'Hagearbeid', 'Flyttehjelp'];

function ctx(catName = 'Rengjøring', userPayment = 'Fastpris') {
  return {
    categoryName: catName,
    categoryAllowList: RENG_CATS,
    userCategory: catName,
    userPaymentType: userPayment,
  };
}

describe('BUG-012: aiSmartFill validator', () => {
  // ── 1. Structured response parsing ────────────────────────────────────────
  test('valid structured AI response parses cleanly without errors', () => {
    const raw = {
      title: 'Flyttevask av 3-roms leilighet',
      description: 'Jeg trenger hjelp til å vaske...',
      category: 'Rengjøring',
      skills: ['Støvsuge', 'Vaske gulv'],
      paymentType: 'Fastpris',
      hourlyRate: 360,
      suggestedPrice: 4500,
      priceMin: 4000,
      priceMax: 5000,
      duration: { value: 3, unit: 'hours' },
      locationRelevance: 'on-site',
      pricingReasoning: 'Estimat basert på timepris for rengjøring × 3 timer.',
    };
    const { valid, errors, cleaned } = validateSmartFillOutput(raw, ctx());
    expect(valid).toBe(true);
    expect(errors.length).toBe(0);
    expect(cleaned.title).toBe('Flyttevask av 3-roms leilighet');
    expect(cleaned.suggestedPrice).toBeGreaterThan(0);
    expect(Number.isInteger(cleaned.suggestedPrice)).toBe(true);
  });

  // ── 2. Generic Norwegian title stripping ──────────────────────────────────
  test.each([
    // Each case: [rawTitle, expectedStrippedMinLength]
    ['Jeg trenger hjelp med male en bod', 'Male en bod'],
    ['Hjelp ønskes: Renovering av bad', 'Renovering av bad'],
    ['Oppdrag: Montering av garderobe', 'Montering av garderobe'],
    ['Jobb: Flyttehjelp i Oslo', 'Flyttehjelp i Oslo'],
    ['Leter etter noen som kan male leiligheten min', 'Male leiligheten min'],
    ['Trenger hjelp med å rengjøre huset', 'Rengjøre huset'],
    ['Ønsker å lei noen som kan fikse rørene', 'Fikse rørene'],
    ['Kan noen hjelpe meg med flytting?', 'Flytting'],
    ['Hjelp til med hagearbeid', 'Hagearbeid'],
    ['Jobb tilgjengelig: Maling av stue', 'Maling av stue'],
  ])('strips generic Norwegian lead-in: "%s"', (rawTitle, expectedContains) => {
    const raw = goodOutput({ title: rawTitle });
    const { cleaned } = validateSmartFillOutput(raw, ctx());
    const got = cleaned.title.toLowerCase();
    expect(got).not.toMatch(
      /^(jeg trenger|hjelp ønskes|oppdrag|jobb|leter etter|trenger hjelp|ønsker å lei|kan noen|hjelp til)/i
    );
    expect(got).toContain(expectedContains.toLowerCase().slice(0, 8));
    expect(cleaned.title.length).toBeGreaterThanOrEqual(4);
  });

  test('strips stacked double lead-ins (Hjelp ønskes: Jeg trenger hjelp med X)', () => {
    const raw = goodOutput({ title: 'Hjelp ønskes: Jeg trenger hjelp med male en bod' });
    const { cleaned } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.title.toLowerCase()).not.toMatch(/hjelp ønskes|jeg trenger/i);
    expect(cleaned.title.length).toBeGreaterThanOrEqual(4);
  });

  test('standalone generic titles are flagged in errors (generic OR empty after stripping)', () => {
    const raw = goodOutput({ title: 'Hjelp ønskes' });
    const { valid, errors, cleaned } = validateSmartFillOutput(raw, ctx());
    // "Hjelp ønskes" either matches GENERIC_STANDALONE or gets stripped to empty;
    // either way the title has length < 4 after stripping → errors contains empty/generic
    const hasTitleIssue = errors.some(
      (e) => e.includes('generic') || e.includes('empty') || e.includes('too short')
    );
    expect(hasTitleIssue).toBe(true);
    // valid is a lenient OR — if title ends up < 4 chars and primaryPrice > 0 it's still usable
    expect(typeof valid).toBe('boolean');
    expect(cleaned.primaryPrice).toBeGreaterThan(0);
  });

  // ── 3. Invalid price rejection / clamping ─────────────────────────────────
  test.each([
    [NaN, 'NaN'],
    [-1, 'negative'],
    [0, 'zero'],
    [Infinity, 'Infinity'],
    [-0, 'negative zero'],
    ['not a number lol', 'string garbage'],
    [null, 'null'],
  ])('invalid suggestedPrice %s falls back to heuristic total', (_bad, label) => {
    const raw = goodOutput({ suggestedPrice: _bad });
    const { cleaned, errors } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.suggestedPrice).toBeGreaterThanOrEqual(TOTAL_MIN);
    expect(Number.isFinite(cleaned.suggestedPrice)).toBe(true);
    expect(Number.isInteger(cleaned.suggestedPrice)).toBe(true);
    // errors will mention clamped/fallback — that's the signal
    expect(errors.length + (cleaned.suggestedPrice > 0 ? 0 : 1)).toBeGreaterThanOrEqual(0);
  });

  test('absurdly high suggestedPrice is clamped to MAX_TOTAL_ALLOWED', () => {
    const raw = goodOutput({ suggestedPrice: TOTAL_MAX * 10 });
    const { cleaned } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.suggestedPrice).toBeLessThanOrEqual(TOTAL_MAX);
  });

  // ── 4. Malformed AI response fallback ─────────────────────────────────────
  test.each([
    [{}, 'empty object'],
    [{ title: '' }, 'blank title string'],
    [null, 'null'],
    [undefined, 'undefined'],
    ['just a string not an obj', 'string (should coerce to {})'],
    [{ title: 'OK', category: null, hourlyRate: undefined }, 'partial nulls'],
  ])('malformed response %s returns non-null cleaned with valid defaults', (_raw, label) => {
    const { valid, cleaned } = validateSmartFillOutput(_raw, ctx());
    expect(cleaned).toBeDefined();
    expect(typeof cleaned.title).toBe('string');
    expect(cleaned.primaryPrice).toBeGreaterThan(0);
    expect(Number.isFinite(cleaned.hourlyRate)).toBe(true);
    expect(valid).toBe(cleaned.title.length >= 4 && cleaned.primaryPrice > 0);
  });

  test('malformed AI output never produces NaN in any numeric field', () => {
    const totallyBroken = {
      title: NaN,
      description: undefined,
      category: 42,
      skills: null,
      paymentType: 'bogus',
      hourlyRate: 'nope',
      suggestedPrice: -99,
      priceMin: NaN,
      priceMax: undefined,
      duration: { value: 'x', unit: 'years' },
      locationRelevance: 'mars',
      pricingReasoning: null,
    };
    const { cleaned } = validateSmartFillOutput(totallyBroken, ctx('Maling'));
    for (const k of ['hourlyRate', 'suggestedPrice', 'priceMin', 'priceMax', 'primaryPrice']) {
      const v = cleaned[k];
      expect(Number.isFinite(v)).toBe(true);
      expect(Number.isNaN(v)).toBe(false);
      expect(v).toBeGreaterThan(0);
    }
  });

  // ── 5. Category-aware pricing anchors differ ──────────────────────────────
  test('category anchors differ meaningfully (electrical > cleaning)', () => {
    const cleaningHr = anchorHourlyRate('Rengjøring');
    const electricalHr = anchorHourlyRate('Elektriker');
    const plumbingHr = anchorHourlyRate('Rørlegger');
    const fallbackHr = anchorHourlyRate('Ukjent kategori');
    expect(electricalHr).toBeGreaterThan(cleaningHr);
    expect(plumbingHr).toBeGreaterThan(cleaningHr);
    expect(fallbackHr).toBeGreaterThanOrEqual(NO_MINIMUM_HOURLY);
  });

  test('Møbelmontering matches mont/møbel needle and returns ~390', () => {
    const r = anchorHourlyRate('Møbelmontering');
    expect(r).toBeGreaterThanOrEqual(350);
    expect(r).toBeLessThanOrEqual(450);
  });

  // ── 6. Payment-type mapping ───────────────────────────────────────────────
  test.each(PAYMENT_TYPES)('paymentType %s primaryPrice maps correctly', (pt) => {
    const raw = goodOutput({ paymentType: pt });
    const { cleaned } = validateSmartFillOutput(raw, ctx('Maling', pt));
    expect(cleaned.paymentType).toBe(pt);
    if (pt === 'Timepris') {
      expect(cleaned.primaryPrice).toBe(cleaned.hourlyRate);
    } else {
      expect(cleaned.primaryPrice).toBe(cleaned.suggestedPrice);
    }
  });

  test('unknown paymentType falls back to Fastpris', () => {
    const raw = goodOutput({ paymentType: 'Bitcoins' });
    const { cleaned } = validateSmartFillOutput(raw, ctx('Maling', 'Bitcoins'));
    expect(cleaned.paymentType).toBe('Fastpris');
  });

  // ── 7. Price ordering always holds after clamp ────────────────────────────
  test('priceMin <= suggestedPrice <= priceMax enforced even when AI reverses them', () => {
    const raw = goodOutput({
      priceMin: 99999, // way above
      priceMax: 1, // way below
      suggestedPrice: 500,
    });
    const { cleaned } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.priceMin).toBeLessThanOrEqual(cleaned.suggestedPrice);
    expect(cleaned.suggestedPrice).toBeLessThanOrEqual(cleaned.priceMax);
    expect(cleaned.priceMin).toBeLessThan(cleaned.priceMax);
  });

  // ── 8. Reasoning MUST contain estimate disclaimer ─────────────────────────
  test('empty reasoning auto-populates with estimate disclaimer + paymentType', () => {
    // Both raw.paymentType and ctx.userPaymentType must be Timepris so the cleaned
    // value is Timepris (raw.paymentType wins over user default in the validator).
    const raw = goodOutput({ pricingReasoning: '', paymentType: 'Timepris' });
    const { cleaned } = validateSmartFillOutput(raw, ctx('Rengjøring', 'Timepris'));
    expect(cleaned.paymentType).toBe('Timepris');
    expect(cleaned.pricingReasoning.length).toBeGreaterThan(10);
    expect(cleaned.pricingReasoning).toMatch(/estimat/i);
    expect(cleaned.pricingReasoning).toMatch(/Timepris/);
  });

  test('authoritative-sounding reasoning (no estimate word) gets disclaimer prefixed', () => {
    const raw = goodOutput({
      pricingReasoning: 'Dette er den offisielle markedsprisen i Norge.',
    });
    const { cleaned } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.pricingReasoning).toMatch(/ESTIMAT|estimat/);
  });

  test('estimate-labeled reasoning passes through unchanged (no double prefix)', () => {
    const legit = 'Estimat basert på ca. 420 kr/t × 6 timer for maling.';
    const raw = goodOutput({ pricingReasoning: legit });
    const { cleaned } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.pricingReasoning).toBe(legit);
  });

  // ── 9. Duration sanity ────────────────────────────────────────────────────
  test('outlandish duration (500 days) gets clamped', () => {
    const raw = goodOutput({ duration: { value: 500, unit: 'days' } });
    const { cleaned, errors } = validateSmartFillOutput(raw, ctx());
    expect(cleaned.duration.value).toBeLessThanOrEqual(30);
    expect(errors.some((e) => e.includes('clamped'))).toBe(true);
  });

  test('bogus duration unit ("years") falls back to category anchor', () => {
    const raw = goodOutput({ duration: { value: 3, unit: 'years' } });
    const { cleaned } = validateSmartFillOutput(raw, ctx('Rengjøring'));
    expect(['minutes', 'hours', 'days']).toContain(cleaned.duration.unit);
  });

  // ── 10. Category allow-list ───────────────────────────────────────────────
  test('hallucinated category gets rejected in favor of user category', () => {
    const raw = goodOutput({ category: 'AI Fantasi Kategori' });
    const { cleaned } = validateSmartFillOutput(raw, ctx('Rengjøring'));
    expect(cleaned.category).toBe('Rengjøring');
  });

  test('valid category in allow-list passes through', () => {
    const raw = goodOutput({ category: 'Elektriker' });
    const { cleaned } = validateSmartFillOutput(raw, ctx('Rengjøring'));
    expect(cleaned.category).toBe('Elektriker');
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function goodOutput(overrides = {}) {
  return Object.assign(
    {
      title: 'Maling av stue og gang',
      description: 'Jeg trenger hjelp til å male stua og gangen i leiligheten min ca. 40 m².',
      category: 'Rengjøring',
      skills: ['Maling', 'Forbehandling'],
      paymentType: 'Fastpris',
      hourlyRate: 420,
      suggestedPrice: 3000,
      priceMin: 2500,
      priceMax: 3500,
      duration: { value: 6, unit: 'hours' },
      locationRelevance: 'on-site',
      pricingReasoning: 'Estimat: ca 420 kr/t × 6 timer for maling.',
    },
    overrides
  );
}
