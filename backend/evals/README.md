# Jobblo AI evaluation harness

Measures the quality of the job-listing AI (`/api/ai/generate-title`,
`/generate-job-info`, `/generate-full-listing`) on a fixed set of synthetic
cases, so a prompt change can be shown to help rather than asserted to.

**Nothing here runs in CI.** These scripts call the OpenAI API, cost money and
are non-deterministic. The deterministic regression tests that _do_ run in CI
are `__tests__/aiJobListingPrompt.test.js` and
`__tests__/aiControllerFailures.test.js`; they make no network calls.

## Layout

| File | Purpose |
|---|---|
| `cases.js` | 28 synthetic cases. All invented — no real customer data. |
| `rubric.js` | Deterministic pass/fail checks + final-score maths. No model involved. |
| `judge.js` | LLM judge for the ten 1–5 dimensions. Fixed rubric, `gpt-4.1`, temp 0. |
| `variants/v1_before.js` | Frozen verbatim copy of the pre-improvement prompt. Do not edit. |
| `run.js` | Runs a variant against all cases, writes `results/<tag>.json`. |
| `rejudge.js` | Re-runs the judge over stored outputs when the rubric text changes. |
| `rescore.js` | Recomputes hard checks + scores offline. Free. |
| `report.js` | Builds the BEFORE vs AFTER markdown. |

## Running

```bash
# baseline (frozen prompt, whatever model production ran)
node evals/run.js --variant v1 --model gpt-3.5-turbo --tag before-gpt35

# current implementation
node evals/run.js --variant v2 --model gpt-4o-mini --tag after-4omini

# comparison
node evals/report.js before-gpt35 after-4omini > evals/results/report.md
```

Flags: `--only <CASE_ID>`, `--no-judge` (deterministic checks only, free),
`--concurrency N` (keep at 2 — the judge model sits on a 30k TPM org cap).

A full 28-case arm costs roughly **$0.01 for generation + $0.09 for judging**.

## Scoring

Two independent layers:

1. **Hard checks** (`rubric.js`) — deterministic, code-only. Wrong language,
   invented date/price/address/contact/quantity/certification/urgency, dropped
   user facts, missing or invalid schema fields, filler prose, successful prompt
   injection. Any hit fails the case.
2. **Rubric 1–5** (`judge.js`) — ten dimensions, judged blind. The judge is
   never told which variant it is looking at.

```
rubricMean = mean of the ten dimensions
finalScore = hardFails === 0 ? rubricMean : min(rubricMean, 2.0)
```

A case with any hard failure is capped at 2.0 however good the prose is. A
fabricated address is worse than clumsy phrasing, and an average that let
fluency outweigh factuality would measure the wrong thing.

## Interpreting a delta

The judge is not deterministic even at temperature 0. Re-judging identical
outputs moved individual cases by **mean 0.11, max 0.40**, while the run mean
moved by 0.011.

So: **per-case deltas below about ±0.4 are noise.** Only aggregate movement, and
per-case movement well above that band, should be read as real. Hard-check
pass/fail is fully deterministic and carries no such caveat.

## Changing the rubric

If the rubric text changes, re-judge **every** arm with `rejudge.js` before
comparing them. A file that is half-scored under an old rubric is not
comparable, and `rejudge.js` exits non-zero if any case failed to re-score.
Never re-generate one arm and re-judge the other — that mixes a rubric change
with fresh sampling.

## Adding cases

Keep them synthetic. Give each `mustPreserve` entry several acceptable surface
forms; the matcher tolerates up to two intervening words but does not do
synonyms. Set `certOk: true` only for trades where Norwegian law genuinely
requires a registered installer (electrical, plumbing, wet rooms) — elsewhere a
demanded certificate is a fabricated requirement.

Do not build few-shot examples in the production prompt out of inputs that
appear here. That is train/test contamination and it silently inflates the
score. The shipped examples deliberately use fence replacement, a job that
appears in no case.
