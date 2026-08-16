const { OpenAI } = require('openai');
const Category = require('../models/Category');
const { validateSmartFillOutput, PAYMENT_TYPES } = require('../utils/aiSmartFill');
const { buildRequest, supportsStrictSchema, SUPPORTED_LANGS } = require('../services/ai/jobListingPrompt');

// ──────────────────────────────────────────────────────────────────────────────
// OpenAI client
//
// Bounded on purpose: an unbounded client defaults to a 10-minute timeout, so a
// stalled upstream call would hold an Express handler open far longer than any
// user waits. 25s covers the p99 for this prompt (measured ~2.6s mean), and one
// retry absorbs a transient 5xx without turning a rate-limit into a retry storm.
// ──────────────────────────────────────────────────────────────────────────────
// Constructed lazily. The client used to be built at module scope, which meant
// requiring this controller threw when OPENAI_API_KEY was unset — so app.js
// could not boot without a key, and the per-handler "AI-tjeneste ikke
// konfigurert" guards below were unreachable. Building it on first use makes
// those guards work and lets the rest of the app run without an AI key.
let _client = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25_000,
      maxRetries: 1,
    });
  }
  return _client;
}

// gpt-4o-mini is the floor for this feature: it is the cheapest model that can
// enforce a strict JSON schema. On gpt-3.5-turbo the same prompt produces
// equally good prose but structurally invalid data — it translates enum values
// ("hours" -> "timer") and returns booleans for string fields. See
// evals/results/after-gpt35.json.
const DEFAULT_MODEL = 'gpt-4o-mini';
const MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;

let _warnedAboutModel = false;
function warnIfWeakModel() {
  if (_warnedAboutModel || supportsStrictSchema(MODEL)) return;
  _warnedAboutModel = true;
  console.warn(
    `[ai] OPENAI_MODEL="${MODEL}" cannot enforce a strict JSON schema. ` +
      `Falling back to loose JSON mode, which measured 4/28 structurally valid ` +
      `responses in evals. Set OPENAI_MODEL=${DEFAULT_MODEL} or better.`
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers shared across all 3 endpoints
// ──────────────────────────────────────────────────────────────────────────────
async function _loadCategoryContext(categoryFromUser) {
  const all = await Category.find({ isActive: true }).select('name');
  const names = all.map((c) => c.name);
  const chosen =
    (categoryFromUser &&
      (typeof categoryFromUser === 'string'
        ? categoryFromUser
        : Array.isArray(categoryFromUser)
          ? categoryFromUser[0]
          : categoryFromUser.name)) ||
    '';
  // Previously `names.includes(chosen) ? chosen : chosen` — both branches
  // returned the same value, so a category that is not in the active list was
  // passed to the prompt as though it were valid, and the pricing anchor was
  // looked up against a name the marketplace does not have.
  return { names, chosen: names.includes(chosen) ? chosen : '' };
}

/** Remove anything key-shaped before a message is written to a log. */
function _redact(text) {
  return String(text == null ? '' : text).replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-***REDACTED***');
}

/**
 * Map an upstream failure onto a safe response.
 *
 * The previous version returned `err.message` straight to the client. OpenAI's
 * 401 body embeds the key that was rejected ("Incorrect API key provided:
 * sk-proj-..."), so a misconfigured server would have handed its own credential
 * to every browser that pressed Smart Fill. Upstream text is now logged
 * (redacted) and never returned; the client gets a fixed message per class.
 */
function _respondWithAiError(res, err, prefix = 'AI generation failed') {
  const status = err && err.status;
  console.error(`[${prefix}]`, _redact(err && err.message ? err.message : err));

  if (err && (status === 429 || err.code === 'insufficient_quota' || /\b429\b/.test(String(err.message)))) {
    return res.status(429).json({
      success: false,
      error: 'AI-kvote overskredet',
      message: 'Du har nådd grensen for AI-forespørsler. Prøv igjen senere.',
    });
  }
  if (status === 401 || status === 403) {
    return res.status(500).json({
      success: false,
      error: 'AI-tjenesten er ikke riktig konfigurert',
      message: 'Kontakt support hvis dette fortsetter.',
    });
  }
  if (err && (err.name === 'APIConnectionTimeoutError' || /timeout|hang up|ECONNRESET/i.test(String(err.message)))) {
    return res.status(504).json({
      success: false,
      error: 'AI-tjenesten svarte ikke i tide',
      message: 'Prøv igjen, eller fyll ut feltene manuelt.',
    });
  }
  return res.status(500).json({
    success: false,
    error: 'Kunne ikke generere AI-innhold',
    message: 'Prøv igjen, eller fyll ut feltene manuelt.',
  });
}

// Resolve the caller's UI language. The frontend has a locale ('no' | 'en')
// from LanguageContext; when it sends one we honour it, otherwise the prompt
// module sniffs the free text. The old implementation hard-coded Norwegian
// bokmål, so an English-speaking user got a Norwegian listing back.
function _resolveLang(body) {
  const raw = ((body && (body.lang || body.locale || body.language)) || '')
    .toString()
    .toLowerCase();
  return SUPPORTED_LANGS.includes(raw) ? raw : undefined;
}

/**
 * Single entry point for all three endpoints.
 *
 * The prompt itself lives in services/ai/jobListingPrompt.js, which keeps the
 * stable instructions, the application context and the user's raw text in
 * separate, clearly-labelled parts. This function only performs the call.
 */
async function _callAi(context) {
  warnIfWeakModel();
  const request = buildRequest(context, MODEL);
  const completion = await getClient().chat.completions.create(request);
  const choice = completion.choices && completion.choices[0];

  // A strict-schema refusal is a distinct outcome from a bad answer: the model
  // declined rather than returned something malformed.
  if (choice && choice.message && choice.message.refusal) {
    throw new Error(`AI declined to answer: ${choice.message.refusal}`);
  }

  const rawText = ((choice && choice.message && choice.message.content) || '').toString().trim();
  if (!rawText) throw new Error('OpenAI returnerte tomt svar');

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    // Only reachable on models without strict-schema support. Never surface the
    // raw model text to the client — it is unvalidated and may echo user input.
    console.error('[ai] model returned unparseable JSON', { model: MODEL, length: rawText.length });
    throw new Error('AI returnerte et svar som ikke kunne tolkes');
  }
  return { parsed, usage: completion.usage };
}

/** Fields every endpoint returns, so the three responses stay consistent. */
function _sharedPayload(c) {
  return {
    skills: c.skills,
    openQuestions: c.openQuestions,
    hourlyRate: c.hourlyRate,
    suggestedPrice: c.suggestedPrice,
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    estimatedPrice: c.suggestedPrice, // backwards-compat key BasicInformation.tsx uses
    duration: c.duration,
    locationRelevance: c.locationRelevance,
    pricingReasoning: c.pricingReasoning,
    paymentType: c.paymentType,
    isEstimate: true, // UI shows "Dette er et estimat" label
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1) Generate job info (description + price) — called from BasicInformation
//    when user has ALREADY typed a title + picked a category.
// POST /api/ai/generate-job-info
// ──────────────────────────────────────────────────────────────────────────────
exports.generateJobInfo = async (req, res) => {
  try {
    const {
      title,
      category,
      paymentType,
      duration,
      city,
      countyCode,
      equipment,
      urgent,
      existingDescription,
    } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'AI-tjeneste ikke konfigurert (mangler API-nøkkel)' });
    }
    if (!title || title.trim().length < 5) {
      return res
        .status(400)
        .json({ error: 'Tittel må fylles ut (min. 5 tegn) før AI kan foreslå beskrivelse.' });
    }

    const { names: catNames, chosen: catChosen } = await _loadCategoryContext(category);
    const userPayment = PAYMENT_TYPES.includes(paymentType) ? paymentType : 'Fastpris';

    const { parsed } = await _callAi({
      feature: 'job-info',
      lang: _resolveLang(req.body),
      task: title,
      categoryAllowList: catNames,
      categoryName: catChosen,
      title,
      description: existingDescription,
      paymentType: userPayment,
      userDuration: duration,
      userCity: city,
      userCounty: countyCode,
      equipment,
      urgency: !!urgent,
    });

    const validated = validateSmartFillOutput(parsed, {
      userPaymentType: userPayment,
      categoryName: catChosen,
      categoryAllowList: catNames,
      userCategory: catChosen,
    });

    if (!validated.valid) {
      return res.status(500).json({
        success: false,
        error: 'AI returnerte ugyldige verdier. Prøv igjen.',
        fallback: validated.cleaned,
        validationErrors: validated.errors,
      });
    }

    // Endpoint is called "generate-job-info" — historically kept description /
    // hourlyRate / estimatedPrice / duration / skills / category shape so the
    // frontend BasicInformation.tsx does not need a rewrite.
    const c = validated.cleaned;
    return res.json({
      success: true,
      data: {
        description: c.description,
        category: c.category,
        ..._sharedPayload(c),
      },
    });
  } catch (err) {
    return _respondWithAiError(res, err, 'generate-job-info');
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 2) Generate title — called from BasicInformation when user writes a short
//    free-text blurb about the job.
// POST /api/ai/generate-title
// ──────────────────────────────────────────────────────────────────────────────
exports.generateTitle = async (req, res) => {
  try {
    const { description, category, paymentType, duration, city, countyCode, equipment, urgent } =
      req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'AI-tjeneste ikke konfigurert' });
    }
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ error: 'Beskrivelse for kort (min. 5 tegn).' });
    }

    const { names: catNames, chosen: catChosen } = await _loadCategoryContext(category);
    const userPayment = PAYMENT_TYPES.includes(paymentType) ? paymentType : 'Fastpris';

    const { parsed } = await _callAi({
      feature: 'title',
      lang: _resolveLang(req.body),
      task: description,
      categoryAllowList: catNames,
      categoryName: catChosen,
      description,
      paymentType: userPayment,
      userDuration: duration,
      userCity: city,
      userCounty: countyCode,
      equipment,
      urgency: !!urgent,
    });

    const validated = validateSmartFillOutput(parsed, {
      userPaymentType: userPayment,
      categoryName: catChosen,
      categoryAllowList: catNames,
      userCategory: catChosen,
    });

    if (!validated.valid) {
      return res.status(500).json({
        success: false,
        error: 'Kunne ikke generere tittel. Prøv igjen med litt mer detaljer.',
        validationErrors: validated.errors,
      });
    }

    const c = validated.cleaned;
    return res.json({
      success: true,
      data: {
        title: c.title,
        ..._sharedPayload(c),
      },
    });
  } catch (err) {
    return _respondWithAiError(res, err, 'generate-title');
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 3) Generate full listing — used by the top Smart Fill chip on /publish-job.
//    Accepts a full free-text prompt + any ALREADY-TYPED user fields so AI
//    does NOT clobber good manual input.
// POST /api/ai/generate-full-listing
// ──────────────────────────────────────────────────────────────────────────────
exports.generateFullJobListing = async (req, res) => {
  try {
    const {
      prompt,
      // Optional: fields the user has already typed manually. Backend writes
      // these into the prompt context ("don't overwrite") AND the validator
      // prefers them if AI's suggestion is clearly worse.
      existingTitle,
      existingDescription,
      existingCategory,
      existingPaymentType,
      existingDuration,
      existingCity,
      existingCounty,
      existingEquipment,
      existingUrgent,
    } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'AI-tjeneste ikke konfigurert' });
    }
    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'Vennligst beskriv jobben (min. 5 tegn).' });
    }

    const { names: catNames, chosen: catChosen } = await _loadCategoryContext(existingCategory);
    const userPayment = PAYMENT_TYPES.includes(existingPaymentType)
      ? existingPaymentType
      : 'Fastpris';

    const { parsed } = await _callAi({
      feature: 'full-listing',
      lang: _resolveLang(req.body),
      task: prompt,
      categoryAllowList: catNames,
      categoryName: catChosen,
      title: existingTitle,
      description: existingDescription,
      paymentType: userPayment,
      userDuration: existingDuration,
      userCity: existingCity,
      userCounty: existingCounty,
      equipment: existingEquipment,
      urgency: !!existingUrgent,
    });

    const validated = validateSmartFillOutput(parsed, {
      userPaymentType: userPayment,
      categoryName: catChosen,
      categoryAllowList: catNames,
      userCategory: catChosen,
    });

    if (!validated.valid) {
      return res.status(500).json({
        success: false,
        error: 'AI returnerte ugyldige data. Prøv igjen, eller fyll ut feltene manuelt.',
        validationErrors: validated.errors,
        fallback: validated.cleaned,
      });
    }

    const c = validated.cleaned;
    return res.json({
      success: true,
      data: {
        title: c.title,
        description: c.description,
        category: c.category,
        priceRange: { min: c.priceMin, max: c.priceMax },
        ..._sharedPayload(c),
      },
    });
  } catch (err) {
    return _respondWithAiError(res, err, 'generate-full-listing');
  }
};
