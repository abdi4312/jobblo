/* eslint-disable no-console */
/**
 * Eval runner.
 *
 *   node evals/run.js --variant v1 --model gpt-3.5-turbo --tag before
 *   node evals/run.js --variant v2 --model gpt-4o-mini   --tag after
 *
 * --variant v1  frozen production prompt (evals/variants/v1_before.js)
 * --variant v2  improved prompt (backend/services/ai/jobListingPrompt.js)
 * --no-judge    skip the LLM judge, run deterministic checks only (free)
 * --only ID     run a single case
 *
 * Writes evals/results/<tag>.json. Never touches the database: the category
 * allow list is the fixed list from evals/cases.js, so a run is reproducible
 * on any machine.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { cases, CATEGORIES } = require('./cases');
const { hardChecks, score } = require('./rubric');
const { judge, JUDGE_MODEL } = require('./judge');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const VARIANT = arg('variant', 'v1');
const MODEL = arg('model', 'gpt-3.5-turbo');
const TAG = arg('tag', `${VARIANT}-${MODEL}`);
const ONLY = arg('only', null);
const USE_JUDGE = !flag('no-judge');
const CONCURRENCY = Number(arg('concurrency', 4));

// Approximate published USD per 1M tokens. Used for the cost column only.
const PRICING = {
  'gpt-3.5-turbo': { in: 0.5, out: 1.5 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'gpt-4.1-nano': { in: 0.1, out: 0.4 },
  'gpt-4.1': { in: 2.0, out: 8.0 },
  'gpt-4o': { in: 2.5, out: 10.0 },
};
const costOf = (model, usage) => {
  const p = PRICING[model];
  if (!p || !usage) return null;
  return (usage.prompt_tokens * p.in + usage.completion_tokens * p.out) / 1e6;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 2 });

/**
 * Map a test case onto the context object the controller builds for that
 * endpoint. Mirrors aiController.generateFullJobListing / generateTitle /
 * generateJobInfo exactly, so the eval exercises the real request shape.
 */
function buildContext(testCase) {
  const i = testCase.input;
  const common = {
    categoryAllowList: CATEGORIES,
    lang: testCase.lang,
    feature: testCase.feature,
  };
  if (testCase.feature === 'full-listing') {
    return {
      ...common,
      task: i.prompt,
      title: i.existingTitle,
      description: i.existingDescription,
      categoryName: i.existingCategory,
      paymentType: i.existingPaymentType,
      userDuration: i.existingDuration,
      userCity: i.existingCity,
      userCounty: i.existingCounty,
      equipment: i.existingEquipment,
      urgency: !!i.existingUrgent,
    };
  }
  if (testCase.feature === 'title') {
    return {
      ...common,
      task: i.description,
      description: i.description,
      categoryName: i.category,
      paymentType: i.paymentType,
      userDuration: i.duration,
      userCity: i.city,
      userCounty: i.countyCode,
      equipment: i.equipment,
      urgency: !!i.urgent,
    };
  }
  // job-info
  return {
    ...common,
    task: i.title,
    title: i.title,
    description: i.existingDescription,
    categoryName: i.category,
    paymentType: i.paymentType,
    userDuration: i.duration,
    userCity: i.city,
    userCounty: i.countyCode,
    equipment: i.equipment,
    urgency: !!i.urgent,
  };
}

function buildRequest(context) {
  if (VARIANT === 'v1') {
    const { buildRequestV1 } = require('./variants/v1_before');
    return buildRequestV1(context, MODEL);
  }
  const { buildRequest: buildRequestV2 } = require('../services/ai/jobListingPrompt');
  return buildRequestV2(context, MODEL);
}

async function runCase(testCase) {
  const context = buildContext(testCase);
  const request = buildRequest(context);
  const started = Date.now();
  let raw = null;
  let usage = null;
  let apiError = null;
  let rawText = '';

  try {
    const res = await openai.chat.completions.create(request);
    usage = res.usage;
    rawText = (res.choices[0]?.message?.content || '').trim();
    try {
      raw = JSON.parse(rawText);
    } catch (e) {
      raw = null;
    }
  } catch (err) {
    apiError = `${err.status || ''} ${err.message}`.trim();
  }
  const latencyMs = Date.now() - started;

  const { failures, metrics } = raw
    ? hardChecks(testCase, raw, CATEGORIES)
    : {
        failures: [
          { code: apiError ? 'API_ERROR' : 'JSON_PARSE_FAILED', detail: apiError || rawText.slice(0, 200) },
        ],
        metrics: {},
      };

  let judgeScores = null;
  let judgeUsage = null;
  if (USE_JUDGE && raw) {
    try {
      const j = await judge(openai, testCase, raw);
      judgeScores = j.scores;
      judgeUsage = j.usage;
    } catch (err) {
      console.error(`  judge failed for ${testCase.id}: ${err.message}`);
    }
  }

  const scored = score(judgeScores, failures);

  return {
    id: testCase.id,
    feature: testCase.feature,
    bucket: testCase.bucket,
    lang: testCase.lang,
    notes: testCase.notes,
    input: testCase.input,
    promptSent: request.messages,
    output: raw,
    rawText: raw ? undefined : rawText,
    apiError,
    failures,
    metrics,
    judge: judgeScores,
    ...scored,
    latencyMs,
    usage,
    judgeUsage,
    costUsd: costOf(MODEL, usage),
    judgeCostUsd: costOf(JUDGE_MODEL, judgeUsage),
  };
}

async function pool(items, size, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

(async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Aborting.');
    process.exit(1);
  }
  const selected = ONLY ? cases.filter((c) => c.id === ONLY) : cases;
  console.log(
    `Running ${selected.length} cases | variant=${VARIANT} model=${MODEL} judge=${USE_JUDGE ? JUDGE_MODEL : 'off'} tag=${TAG}`
  );

  const results = await pool(selected, CONCURRENCY, async (c) => {
    const r = await runCase(c);
    const mark = r.passed ? 'PASS' : 'FAIL';
    console.log(
      `  [${mark}] ${r.id.padEnd(32)} score=${r.finalScore.toFixed(2)} ${r.failures.map((f) => f.code).join(',')}`
    );
    return r;
  });

  const passed = results.filter((r) => r.passed).length;
  const avg = results.reduce((a, r) => a + r.finalScore, 0) / results.length;
  const avgRubric = results.reduce((a, r) => a + r.rubricMean, 0) / results.length;
  const totalCost = results.reduce((a, r) => a + (r.costUsd || 0), 0);
  const totalJudgeCost = results.reduce((a, r) => a + (r.judgeCostUsd || 0), 0);
  const avgLatency = results.reduce((a, r) => a + r.latencyMs, 0) / results.length;
  const avgPromptTokens =
    results.reduce((a, r) => a + (r.usage?.prompt_tokens || 0), 0) / results.length;
  const avgCompletionTokens =
    results.reduce((a, r) => a + (r.usage?.completion_tokens || 0), 0) / results.length;

  const summary = {
    tag: TAG,
    variant: VARIANT,
    model: MODEL,
    judgeModel: USE_JUDGE ? JUDGE_MODEL : null,
    runAt: new Date().toISOString(),
    caseCount: results.length,
    passed,
    failed: results.length - passed,
    avgFinalScore: Number(avg.toFixed(3)),
    avgRubricMean: Number(avgRubric.toFixed(3)),
    avgLatencyMs: Math.round(avgLatency),
    avgPromptTokens: Math.round(avgPromptTokens),
    avgCompletionTokens: Math.round(avgCompletionTokens),
    totalCostUsd: Number(totalCost.toFixed(5)),
    totalJudgeCostUsd: Number(totalJudgeCost.toFixed(5)),
  };

  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${TAG}.json`), JSON.stringify({ summary, results }, null, 2));

  console.log('\n' + JSON.stringify(summary, null, 2));
  console.log(`\nWrote evals/results/${TAG}.json`);
})();
