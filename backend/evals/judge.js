/**
 * LLM judge for the ten 1-5 rubric dimensions.
 *
 * Design constraints, all chosen before any AFTER output existed:
 *   - BLIND: the judge is never told whether it is looking at the old or the
 *     new implementation, and the rubric text is byte-identical for both runs.
 *   - FIXED MODEL: gpt-4.1 at temperature 0, a different family from the
 *     model under test, so the judge is not grading its own house style.
 *   - STRUCTURED: json_schema with strict:true, so a dimension can never come
 *     back missing or as prose.
 */
const { DIMENSIONS } = require('./rubric');

const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'gpt-4.1';

const RUBRIC_TEXT = `
You are grading the output of an AI assistant that helps users write job
postings on Jobblo, a Norwegian marketplace where private individuals and
small businesses post jobs/services ("oppdrag") and providers respond.

The reader of the output is a PROVIDER deciding whether to respond to the job.

Grade each dimension 1-5. 3 = acceptable, 5 = could not realistically be better,
1 = actively bad. Be strict: 5 must be earned. Generic, safe, padded prose is a 2
even when it is grammatically perfect.

1. relevance        Does the output address the actual task the user described?
2. specificity      Is it concrete about THIS job, or interchangeable with any
                    other job in the same category? Text that would fit any
                    painting job equally well scores 2 or below.
3. usefulness       Could a provider decide whether to respond, and roughly what
                    the work involves, from this alone? Does it add organisation
                    and actionable structure beyond the raw input, or is it just
                    the input restated more politely? Pure restatement = 2.
4. domainAwareness  Does it reflect how Norwegian home-service jobs actually
                    work (access, equipment, waste removal, licensing regimes,
                    seasonality, scope boundaries)? Irrelevant or wrong domain
                    detail scores low; absence of any domain sense scores 2-3.
5. factPreservation Are ALL facts the user supplied still present and correct?
                    Every dropped or altered user fact costs a point.
6. noInventedFacts  Judge the PROSE (title + description) only.
                    Does the prose avoid asserting anything the user did not
                    supply — dates, budget or any money amount, dimensions,
                    addresses, phone/email, materials, licences, urgency,
                    counts? Any single fabricated fact caps this at 2.
                    Judge ONLY the title and description strings. Ignore every
                    other field completely when scoring this dimension:
                      - hourlyRate / suggestedPrice / priceMin / priceMax /
                        duration are a deliberate, labelled price ESTIMATE.
                        This product is a price estimator. Filling them in is
                        the feature working, not fabrication.
                      - skills is a suggested list, not a claim about the user.
                      - openQuestions is BY DEFINITION about things the user did
                        NOT supply. Asking "how large are the rooms?" is the
                        correct alternative to inventing a room size. Never
                        treat the content of openQuestions as invention, however
                        specific the question is.
                    Within the title and description, DO penalise: a money
                    amount, a date, a measurement, a count, an address, or a
                    claim about what the user has, wants, has decided, or has
                    not decided, that they did not actually say. Inferred
                    consequences ("so access is easy", "so that part is done")
                    are fabrication too.
7. languageQuality  Does it read like a competent native speaker wrote it, or
                    like machine translation / template filler?
8. detailAmount     Is the length proportionate to how much the user actually
                    said? Padding a two-word input into 150 words scores 1-2.
                    Truncating a detailed input scores low too.
9. correctLanguage  Is it written in the same language the user wrote in?
10. formatCompliance Are the structured fields sensible and internally
                    consistent with the prose (category, skills, duration,
                    payment type, location relevance)? Grade whether the values
                    fit the job, not whether estimates exist at all.

Return only the JSON object.
`.trim();

const JUDGE_SCHEMA = {
  name: 'jobblo_rubric',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [...DIMENSIONS, 'rationale'],
    properties: {
      ...Object.fromEntries(
        DIMENSIONS.map((d) => [d, { type: 'integer', minimum: 1, maximum: 5 }])
      ),
      rationale: {
        type: 'string',
        description: 'One or two sentences naming the single biggest weakness.',
      },
    },
  },
};

async function judge(openai, testCase, raw) {
  const userInput = JSON.stringify(testCase.input, null, 2);
  const output = JSON.stringify(raw, null, 2);

  const res = await openai.chat.completions.create({
    model: JUDGE_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: RUBRIC_TEXT },
      {
        role: 'user',
        content: [
          `LANGUAGE THE USER WROTE IN: ${testCase.lang}`,
          `DIFFICULTY BUCKET: ${testCase.bucket}`,
          '',
          '=== WHAT THE USER SUPPLIED ===',
          userInput,
          '',
          '=== WHAT THE ASSISTANT PRODUCED ===',
          output,
        ].join('\n'),
      },
    ],
    response_format: { type: 'json_schema', json_schema: JUDGE_SCHEMA },
  });

  const parsed = JSON.parse(res.choices[0].message.content);
  return { scores: parsed, usage: res.usage };
}

module.exports = { judge, JUDGE_MODEL, RUBRIC_TEXT, JUDGE_SCHEMA };
