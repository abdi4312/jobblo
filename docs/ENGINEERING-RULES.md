# Jobblo — engineering rules and checklist

Written before the Redis / queues / refactor work (2026-10-24) and followed for every task
after it. `AGENTS.md` (lazy-senior rules) still applies; this file adds the project rules
and the per-task checklist. The running log of what was done is in `docs/WORKLOG.md`.

## Rules

1. **Nothing is committed or pushed** unless the owner asks. The working tree also holds the
   owner's own work (`jobblo-app/`, `myApplicationsController.js`) — never touch it.
2. **No Docker.** Everything must run with plain `node` on Windows and on the VPS.
3. **Redis is optional at runtime.** With `REDIS_URL` set, queues, the rate-limit store, the
   cache and the socket.io adapter use Redis. Without it the app behaves exactly as before
   (jobs run in-process, in-memory limits and cache). A Redis outage must degrade, not crash.
4. **Money paths are never made "eventually consistent" by accident.** Stripe webhooks, payouts,
   refunds and escrow stay synchronous and idempotent; only side effects (email, push,
   notifications) move to queues.
5. **Every background job is idempotent and retried with backoff**, and a job that keeps failing
   ends in a visible failed state (developer console → Queues), never silently dropped.
6. **Refactors do not change behaviour.** Split a file only with tests green before and after;
   move code verbatim first, improve second.
7. **Smallest working diff, reuse first, no new dependency without a reason written down.**
8. **Secrets never in code, logs, job payloads or test fixtures.**
9. **Every change leaves one runnable check** (unit, integration or e2e test) that fails if it
   breaks.
10. **Log the work.** Each finished task gets a dated entry in `docs/WORKLOG.md`: what changed,
    why, how it was verified, what is left.

## Checklist — every task

- [ ] Read the code it touches end to end; note the current behaviour.
- [ ] Tests green **before** the change (`npm test` in backend; `npx tsc` baseline 234 errors
      and `npx vite build` in frontend).
- [ ] Make the change (rules above).
- [ ] **Unit** tests for new pure logic.
- [ ] **Integration** tests for new endpoints / workers (supertest, real Redis where relevant).
- [ ] **End-to-end** test of the user-visible flow (Playwright, `frontend/e2e`).
- [ ] **Break it:** invalid input, missing auth, wrong role, huge payloads, Redis down, Mongo
      slow, duplicate / concurrent requests, restart in the middle of a job.
- [ ] **Load:** many simultaneous users against the changed paths (`backend/scripts/load-test.js`);
      no errors, p95 within budget, no memory growth.
- [ ] Tests green **after**; type-check not worse than the baseline; production build passes.
- [ ] Clean up test data.
- [ ] Entry in `docs/WORKLOG.md`.

## Budgets (local dev box, single instance)

| Path | p95 under 50 concurrent users | Errors |
|---|---|---|
| Public reads (`/api/services`, `/api/categories`, filters) | < 300 ms | 0 % |
| Authenticated reads | < 400 ms | 0 % |
| Writes | < 800 ms | 0 % (429s from rate limits are expected, not errors) |
