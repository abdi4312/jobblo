/**
 * FROZEN BASELINE — verbatim snapshot of the production prompt as it existed at
 * commit 29d36d6 (backend/controllers/aiController.js, `_buildPrompt` + `_callAi`).
 *
 * DO NOT "improve" this file. Its only job is to let us re-run the BEFORE
 * evaluation after the production prompt has been rewritten. Any edit here
 * invalidates the baseline.
 *
 * Copied on 2026-08-16 before any Phase-5 change was made.
 */
const { anchorHourlyRate, anchorDuration, PAYMENT_TYPES } = require('../../utils/aiSmartFill');

function _ifPresent(label, value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  return `\n- ${label}: ${s}`;
}

function buildPromptV1(context) {
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

const SYSTEM_V1 =
  'Du er en konsis AI-assistent som skriver nøyaktig norsk bokmål for en jobbplattform. Du returnerer KUN gyldig JSON i det skjemaet som er bedt om — aldrig forklarende tekst, aldrig markdown.';

/**
 * Reproduces the exact request the production controller sent: one system
 * message, one user message carrying everything, json_object mode, temp 0.3.
 */
function buildRequestV1(context, model) {
  return {
    model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_V1 },
      { role: 'user', content: buildPromptV1(context) },
    ],
    response_format: { type: 'json_object' },
  };
}

module.exports = { buildPromptV1, buildRequestV1, SYSTEM_V1 };
