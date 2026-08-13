const { OpenAI } = require('openai');
const Category = require('../models/Category');
const {
  validateSmartFillOutput,
  anchorHourlyRate,
  anchorDuration,
  PAYMENT_TYPES,
} = require('../utils/aiSmartFill');

// ──────────────────────────────────────────────────────────────────────────────
// OpenAI client
// ──────────────────────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return { names, chosen: names.includes(chosen) ? chosen : chosen };
}

function _respondWithAiError(res, err, prefix = 'AI generation failed') {
  console.error(`[${prefix}]`, err && err.message ? err.message : err);
  if (
    err &&
    (err.status === 429 || err.code === 'insufficient_quota' || String(err.message).includes('429'))
  ) {
    return res.status(429).json({
      success: false,
      error: 'AI-kvote overskredet',
      message: 'Du har nådd grensen for AI-forespørsler. Prøv igjen senere.',
    });
  }
  return res.status(500).json({
    success: false,
    error: err && err.message ? err.message : prefix,
  });
}

// Given user-provided field name + existing value, produce a short string to
// tell the prompt what the USER already typed (so AI doesn't overwrite it in
// the suggestion — the backend still guards afterwards, this helps the prompt).
function _ifPresent(label, value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  return `\n- ${label}: ${s}`;
}

// Build a single SHARED system / user prompt for title generation +
// description generation + full-listing generation. The schema output is the
// SAME for every endpoint so frontend parsing is simpler.
function _buildPrompt(context) {
  // context: { task, categoryAllowList, categoryName, title, description,
  //            paymentType, userDuration, userCity, userCounty,
  //            userCompletionNote, urgency, equipment }
  const catList = (context.categoryAllowList || []).join(', ');
  const anchorHr = anchorHourlyRate(context.categoryName);
  const anchorDur = anchorDuration(context.categoryName);
  const durHintHours = (context.userDuration && context.userDuration.value) || anchorDur.value;
  const durHintUnit = (context.userDuration && context.userDuration.unit) || anchorDur.unit;
  const heuristicTotalHint = Math.round(
    anchorHr *
      (durHintUnit === 'hours'
        ? durHintHours
        : durHintUnit === 'days'
          ? durHintHours * 8
          : durHintHours / 60)
  );

  // Explicitly enumerate allowed payment-type mappings: what primary value
  // the AI should treat as "the user-facing price".
  const payHint =
    context.paymentType === 'Timepris'
      ? `Betalingsmåte: Timepris. Sett suggestedPrice ≈ hourlyRate * ${durHintHours ?? 2} timer (estimat), men den viktigste prisfeltet er hourlyRate (ca. ${anchorHr} kr/t).`
      : context.paymentType === 'Anbud'
        ? `Betalingsmåte: Anbud. suggestedPrice er et ANSLÅTT BUDSJETT som vises til arbeidstakere før de byder. Gi en rimelig totalpris for omfanget (ca. ${heuristicTotalHint} kr +/-), men merk det som et estimat.`
        : `Betalingsmåte: Fastpris. suggestedPrice ER den totale jobbstyringsverdien brukeren vil se. Forutsatt ca. ${durHintHours} ${durHintUnit === 'days' ? 'dager' : durHintUnit === 'minutes' ? 'minutter' : 'timer'} arbeid. Heuristisk anslag: ~${heuristicTotalHint} kr.`;

  const userContext = [
    context.task && `- Kort beskrivelse fra bruker: "${context.task}"`,
    _ifPresent('Tittel allerede skrevet av bruker', context.title),
    _ifPresent('Beskrivelse allerede skrevet av bruker', context.description),
    _ifPresent('Valgt kategori', context.categoryName),
    _ifPresent('By/sted', context.userCity),
    _ifPresent('Fylke', context.userCounty),
    _ifPresent('Utstyr bruker har nevnt', context.equipment),
    context.urgency && `- Haster: ja`,
  ]
    .filter(Boolean)
    .join('\n');

  // ── The PROMPT (user message). System prompt is short; instructions here.
  return `
Du hjelper en norsk oppdragsgiver med å fylle ut et jobbannonseskjema på Jobblo.
Oppdragsgiveren skriver norsk, og ALLE tekstfelt FRA DEG MÅ VÆRE PÅ NORSK BOKMÅL.
Ikke bytt språk. Ikke bruk engelske ord der norsk finnes.

=== KONTEKST FRA BRUKER ===
${userContext || '- (ingen felt er fylt ennå — bruk bare den korte beskrivelsen nedenfor)'}

=== LOVLIGE KATEGORIER (velg kun ÉN FRA DENNE LISTEN, ellers la feltet stå tomt) ===
[${catList}]

=== PRIS-HEURISTIKK DU SKAL BRUKE SOM REFERANSE (ikke oppgi som faktum, bruk som ramme) ===
- Heuristisk timepris for denne kategorien i Norge (2025): omtrent ${anchorHr} kr/time
- Tillatt intervall timepris: ${Math.round(anchorHr * 0.8)}–${Math.round(anchorHr * 1.35)} kr/time
- Forventet varighet: ca. ${durHintHours} ${durHintUnit === 'days' ? 'dager' : durHintUnit === 'minutes' ? 'minutter' : 'timer'} → total ca. ${heuristicTotalHint} kr
${payHint}

=== HVA DU SKAL RETURNERE ===
Returnere NØYAKTIG ett JSON-objekt. Ingen forklarende tekst utenfor JSON. Ingen markdown.

Schema:
{
  "title": "KORT, KONKRET NORSK TITTEL (4–70 tegn). MØNSTER: Aktivitet/hovedhandling + «av» + objekt/område/rom/type som NEVNES i beskrivelsen. EKSEMPELSTIL (ikke gjenbruk): «Montering av IKEA-garderobe», «Flyttevask av 3-roms leilighet», «Maling av stue og gang», «Snømåking av gårdsplass». IKKE BRUK: «Hjelp ønskes», «Jobb tilgjengelig», «Oppdrag», «Tjeneste», «Jeg trenger hjelp med…», «Leter etter…», «Noen som kan…». IKKE start med pronomen eller hjelpeønske. IKKE halluciner detaljer (romnavn, antall, type) som IKKE står i beskrivelsen. Bare trekk ut det som faktisk er nevnt.",
  "description": "Klar, engasjerende norsk jobb-beskrivelse (80–180 ord), skriv SOM OPPDRAGSGIVER: «Jeg trenger hjelp til...», «Jeg leter etter noen som kan...». Ikke bruk faguttrykk der vanlig norsk holder. Ikke oppgis tjenester som ikke nevnes i beskrivelsen.",
  "category": "Én verdi fra LOVLIGE KATEGORIER ovenfor (eller tom streng hvis du er usikker). IKKE oppfinn nye kategorier.",
  "skills": ["3–5 konkrete, relevante ferdigheter på norsk, maks 30 tegn hver"],
  "paymentType": "${PAYMENT_TYPES.join(' / ')} — bruk akkurat dette ordet, hvis bruker har oppgitt en type, behold den.",
  "hourlyRate": ${anchorHr},
  "suggestedPrice": ${heuristicTotalHint},
  "priceMin": ${Math.round(heuristicTotalHint * 0.85)},
  "priceMax": ${Math.round(heuristicTotalHint * 1.15)},
  "duration": { "value": ${durHintHours}, "unit": "${durHintUnit}" },
  "locationRelevance": "on-site (hvis jobben må gjøres der) ELLER remote (hvis den kan gjøres hjemmefra — for det meste on-site for tjenesteyrker)",
  "pricingReasoning": "Kort norsk begrunnelse (én setning, maks 350 tegn). SI KLARTE AT ALLE PRISER ER ESTIMATER – IKKE autoriserte markedssatser – basert på kategori, omfang og anslått varighet i Norge 2025, og at det ikke finnes et offisielt markedssats datasett i systemet. Eksempelstil: «Estimat basert på timepris for rengjøring (ca X kr/t) × anslått varighet». Merk om det er Timepris/Fastpris/Anbud."
}

=== TITTEL-REGLER — OVERTRED IKKE ===
1. Tittelen MÅ beskrive HVA som skal gjøres, ikke at oppdragsgiver ønsker hjelp.
2. Hvis beskrivelsen sier noe om ANTALL (rom, timer, kvm, personer), TYPE (IKEA, utvendig/innvendig, leilighet/hus), STED (gårdsplass, kjeller, bod) → TA DET MED i tittelen hvis det gir mening og rom er innen 70 tegn.
3. IKKE lag til ting som ikke nevnes i konteksten.
4. IKKE avslutt med punktum, utropstegn eller spørsmålstegn.
5. IKKE bruk anførselstegn rundt noe.
6. Hvis det er svært lite info og du er usikker, velg det MEST spesifikke du kan hente ut, ikke en generisk frasering.

=== PRIS-REGLER — OVERTRED IKKE ===
1. ALLE priser må være positive heltall (ingen desimaler, ingen 0, ingen negative).
2. IKKE gi sifre langt utenfor intervallene nevnt ovenfor — validator vil fange det opp, men prøv å være innenfor.
3. IKKE si at disse prisene er autoriserte/korrekte markedssatser — de er ESTIMATER.
4. Timepris: hourlyRate er HOVEDPRIS feltet, suggestedPrice er kun et anslag for totalt.
5. Fastpris: suggestedPrice ER den totale jobbstyringsverdien brukeren ser.
6. Anbud: suggestedPrice er et ANSLÅTT BUDSJETT (referanse), ikke et endelig krav.

=== ANDRE REGLER ===
1. IKKE halluciner romnavn, stedsnavn eller arbeid som ikke nevnes i kontekst.
2. IKKE bytt språk til engelsk i noen tekstfelt.
3. IKKE gjenbruk eksemplene som gitt (de er bare stil-eksempler).

Gi nå JSON-en, INGEN annet.
`.trim();
}

async function _callAi(system, user) {
  return openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // mini is faster/cheaper for structured JSON
    temperature: 0.3, // low — deterministic titles, not creative
    messages: [
      {
        role: 'system',
        content:
          system ||
          'Du er en konsis AI-assistent som skriver nøyaktig norsk bokmål for en jobbplattform. Du returnerer KUN gyldig JSON i det skjemaet som er bedt om — aldrig forklarende tekst, aldrig markdown.',
      },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  });
}

function _jsonFromChoice(choice) {
  const raw = ((choice && choice.message && choice.message.content) || '').toString().trim();
  if (!raw) throw new Error('OpenAI returnerte tomt svar');
  return JSON.parse(raw);
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

    const prompt = _buildPrompt({
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

    const choice = (await _callAi(null, prompt)).choices[0];
    const parsed = _jsonFromChoice(choice);
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
        skills: c.skills,
        hourlyRate: c.hourlyRate,
        suggestedPrice: c.suggestedPrice,
        priceMin: c.priceMin,
        priceMax: c.priceMax,
        estimatedPrice: c.suggestedPrice, // backwards-compat key BasicInformation.tsx uses
        duration: c.duration,
        category: c.category,
        locationRelevance: c.locationRelevance,
        pricingReasoning: c.pricingReasoning,
        paymentType: c.paymentType,
        isEstimate: true, // UI shows "Dette er et estimat" label
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

    const prompt = _buildPrompt({
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

    const choice = (await _callAi(null, prompt)).choices[0];
    const parsed = _jsonFromChoice(choice);
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
        skills: c.skills,
        hourlyRate: c.hourlyRate,
        suggestedPrice: c.suggestedPrice,
        priceMin: c.priceMin,
        priceMax: c.priceMax,
        estimatedPrice: c.suggestedPrice,
        duration: c.duration,
        locationRelevance: c.locationRelevance,
        pricingReasoning: c.pricingReasoning,
        paymentType: c.paymentType,
        isEstimate: true,
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

    const aiPrompt = _buildPrompt({
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

    const choice = (await _callAi(null, aiPrompt)).choices[0];
    const parsed = _jsonFromChoice(choice);
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
        skills: c.skills,
        hourlyRate: c.hourlyRate,
        suggestedPrice: c.suggestedPrice,
        priceRange: { min: c.priceMin, max: c.priceMax },
        priceMin: c.priceMin,
        priceMax: c.priceMax,
        estimatedPrice: c.suggestedPrice,
        duration: c.duration,
        locationRelevance: c.locationRelevance,
        pricingReasoning: c.pricingReasoning,
        paymentType: c.paymentType,
        isEstimate: true,
      },
    });
  } catch (err) {
    return _respondWithAiError(res, err, 'generate-full-listing');
  }
};
