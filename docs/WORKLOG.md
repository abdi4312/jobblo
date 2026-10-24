# Work log

Newest first. Rules and checklist: `docs/ENGINEERING-RULES.md`. Nothing here is committed
or pushed — the owner reviews and commits.

## 2026-10-24 — Redis, queues & background jobs, backend restructure, testing

### 0. Starting point (survey)

- `server.js` (113 lines) and `app.js` (388 lines) do everything inline: env, DB, CORS,
  sessions, 45 route mounts, error handling, socket.io, 13 background starters.
- Found while reading:
  - `server.js` mounts `/api/test` and Swagger **after** `app.js`'s 404 handler, so both are
    unreachable dead code (and the Swagger mount ignored the production gate).
  - The database connection and `.env` are loaded twice (`app.js` and `server.js`).
  - socket.io CORS uses `FRONTEND_URL || 'http://localhost:5173' || …` (the second `||` can never
    apply) instead of the HTTP allowlist.
  - No graceful shutdown: a deploy kills in-flight requests and running scheduler jobs.
- Largest backend files: `SafePayCheckoutController.js` 1748 lines, `v2WebhookProcessor.js`
  1549, `userController.js` 1167, `serviceController.js` 1053, `v2Management.js` 1000,
  `developer/developerController.js` 991.
- No Redis and no Docker on the dev machine. Redis is used only for local testing from a
  portable Windows build outside the repository (Redis 8.10.2, msys2 build, `127.0.0.1:6379`,
  no persistence).
- Coordination: another Claude session (`jobblo-89`) worked in the same tree at the same time
  (backend dead-code removal, frontend TanStack migration). Files were split between us by
  message; both sets of edits are intact.

### 1. Backend restructure (behaviour unchanged)

| Before | After |
|---|---|
| `server.js`, 113 lines | `server.js`, 8 lines: `require('./bootstrap').start()` |
| `app.js`, 388 lines | `app.js`, ~75 lines: middleware in order, `mountRoutes(app)`, error handlers |
| — | `bootstrap/index.js`: env, Mongo, HTTP server, socket.io (+ Redis adapter), listen, background, shutdown |
| — | `bootstrap/socket.js`: socket.io with the **same origin allowlist** as HTTP CORS |
| — | `bootstrap/background.js`: the 14 background starters, each isolated (one failing never stops the rest) |
| — | `bootstrap/shutdown.js`: graceful SIGTERM/SIGINT; HTTP, socket.io, queue workers, Redis and Mongo close in order, with a 10 s deadline |
| — | `config/env.js` (`.env` loaded once), `config/cors.js`, `config/session.js` |
| — | `routes/api.js`: one ordered route table (45 mounts) |
| — | `middleware/errorHandlers.js`: 404, upload/payload errors, global error handler |

- **Removed dead code:** the `/api/test` and Swagger mounts after the 404 handler, which could never run; the double DB connect; the double `.env` load.
- **Busy port:** a port already in use now fails with a clear message.
- **Tests:** the two source-level wiring tests (CSRF guard order, session store collection) now point at the new files and still check the same security properties.

### 2. Redis, queues and background jobs

All optional: without `REDIS_URL` everything behaves as before.

- **`config/redis.js`:** a lazy shared client that fails commands fast so callers can fall back, separate BullMQ connections, `pingRedis`, `closeRedis`, and logs throttled to one line per 30 s per connection.
- **`services/queue`:**
  - Queues `email` (5 attempts, exponential 30 s), `push` (3 attempts, 10 s) and `scheduler`.
  - Failed jobs are kept 14 days as dead letters.
  - `enqueue()` never fails a request: without Redis, or if Redis does not answer within 3 s, the job runs in-process.
  - Workers start on every instance (`ENABLE_WORKERS=false` makes an instance producer-only).
- **What moved onto the queues:**
  - Login, forgot-password and change-password OTP emails (`sendOtpEmail` now queues; `deliverOtpEmail` sends).
    - The code travels **sealed** (AES-GCM, `utils/secretBox`, purpose `queued-otp`).
    - Developer step-up stays synchronous, because it must know whether the email went out.
  - Developer alert emails.
  - Push notifications (`sendPushToUser` queues; `deliverPush` throws on a total failure so it is retried — before, a failed FCM call was only logged).
  - **Scheduler:** with Redis, BullMQ job schedulers on the `scheduler` queue, so each run is executed by exactly one worker fleet-wide. A schedule is only re-created when missing or when its interval changed; re-creating on every boot would restart a 24 h job's timer on each deploy.
- **Security fix, forgot-password timing leak:**
  - An existing address used to wait for SMTP (seconds); an unknown one answered in ms.
  - Now both queue or do the same DB round trip.
  - Measured, 20 warm requests each: **15.0 ms vs 14.5 ms** median.
- **Rate limits:** every limiter goes through `makeLimiter(name, …)`.
  - With Redis, counts are shared by all instances (one prefix per limiter) and fail open if Redis is down.
  - Fixed the 2FA limiter's IPv6 key generation (`ipKeyGenerator`).
- **Cache:** `utils/cache.js` (Redis, or a bounded in-memory map) with a `cacheJson(ns, ttl)` route middleware (`X-Cache: HIT/MISS`).
  - Categories: 5 min, cleared by Category model hooks on any write.
  - Filter options: 30 s.
  - Location tree: 1 h.
- **Location tree:** `buildLocationTree` groups once instead of O(n·m) re-filtering, and the three queries run in parallel with lean. Output proven identical on real data (13 counties, 258 municipalities, 33 areas).
- **Developer console → Queues:**
  - Redis status, counts per queue, the scheduled jobs, and failed jobs with their error and redacted data (emails masked, sealed values hidden).
  - **Retry**, **Remove** and **Retry all failed** (operations access, audited).
  - Long lists collapse to 5.
- **`utils/secretBox.js`:** AES-256-GCM shared by 2FA secrets and queued codes, with one key per purpose. The 2FA code now uses it, and values encrypted before are proven to still open.
- **New dependencies (backend):** `bullmq`, `ioredis`, `rate-limit-redis`, `@socket.io/redis-adapter`.

### 3. Optimisation (measured)

**Load tests,** `scripts/load-test.js`: 50 / 150 / 200 virtual users, each with its own IP.

| Run | req/s | p50 | p95 | errors |
|---|---|---|---|---|
| 50 users, before | 212 | 39 ms | 187 ms | 0 |
| 50 users, after job-detail fix + indexes | 233 | 25 ms | 115 ms | 0 |
| 150 users, profiled, before | 381 | 209 ms | 410 ms | 0 |
| 150 users, profiled, after lean + UA fix | **503** | 116 ms | **221 ms** | 0 |
| 150 users, Redis mode | **545** | 89 ms | **177 ms** | 0 |
| 200 users, nodemon dev server, before fixes | 204 | 757 ms | 1777 ms | 0 (saturated, but nothing failed) |

**What the CPU profile showed (150 users), and what changed:**
- **Mongoose hydration was half the CPU** on the job list.
  - `.lean()` on the list and nearby queries, plus `utils/lean.withDefaults`, which puts back schema defaults and populated-user virtuals.
  - Output proven deep-equal to the hydrated JSON for all 23 listings.
  - About 2× faster per query.
- **`express-useragent` parsed every request** (~7 % CPU). It is now parsed only in `createSession`, the one reader.
- **Job detail awaited a view-counter write**, so every reader of a popular job queued on one document. The write no longer blocks the response.
- **New `Service` indexes:**
  - `{status, createdAt}`, `{status, price, createdAt}`, `{categories, status, createdAt}`, `{userId, createdAt}`.
  - The public list used to walk every listing through the `createdAt` index. Now it examines only what it returns: 8 of 8 instead of 24.
- **Search log:** a raw insert instead of a Mongoose document per search.

**Break-it run** (`--scenario abuse`, 1,749 requests): zero 5xx.
- Bad id → 400; unknown id → 404.
- Operator injection is ignored; a regex bomb is escaped; a huge limit is capped.
- 13 MB body → 413; forged token → 401; path traversal → 404; anonymous developer API → 401.

**Scaling path (not built, YAGNI):**
- Redis now makes several API processes safe: shared limits, socket adapter, queue-distributed scheduler.
- Socket.io long-polling needs sticky sessions, so scale out behind nginx with `ip_hash` (or sticky cookies) rather than Node's cluster module.

### 4. Large files split (behaviour unchanged)

Big controllers are now folders of small files. The old path is a barrel that re-exports the same names, so routes, services and tests import exactly what they did before.

| Was | Lines | Now |
|---|---|---|
| `controllers/developer/developerController.js` | 991 | barrel → overview, apiMonitoring, errors, infra, tools controllers + `services/monitoring/{system,summaries}.js` |
| `controllers/developer/diagnosticsController.js` | 873 | barrel → money, job, subscription, reconciliation, user, investigate controllers + `services/monitoring/orderHealth.js` |
| `controllers/developer/platformController.js` | 684 | barrel → queues, tickets, deployments, incidents, reports, devSettings controllers + `services/monitoring/{workQueues,github}.js` |
| `controllers/userController.js` | 1,167 | `controllers/users/` → userHelpers, profile, search, portfolio, blocking |
| `controllers/serviceController.js` | 1,062 | `controllers/services/` → serviceHelpers, browse, manage, location, progress |
| `controllers/authController.js` | 815 | `controllers/auth/` → authHelpers, login, account, password |

- **Shared helpers:** `utils/devQuery.js` holds the time ranges, `?range` parsing, bucket expressions, safe regex, id checks, pagination, count helpers and the audit helper. The developer controllers used to carry their own copies.
- **How the splits were checked:**
  - **Exports:** every original export resolves from the barrel.
  - **Requires:** every relative `require()` resolves from its new folder.
  - **ESLint `no-undef` / `no-unused-vars`:** run over each new file.
  - **Tests:** full jest suite, including the real-Mongo suites.
  - **Live check:** each endpoint called on :5001.
- **Splitter bugs found by those checks** (fixed before the split was kept):
  1. `require()` calls inside function bodies were not rewritten for the new folder. The real-Mongo password-reset test hit `Cannot find module '../utils/azureUpload'`.
  2. A name used only as a spread (`...CLEAR_RESET_STATE`) was not imported. ESLint `no-undef` caught it.
- **Tests that read controller source** now read the split folder:
  - `listingCapabilities.test.js`
  - `oauthAccountLinking.test.js`
  - `transactionOwnership.test.js`
- **Test isolation fix:** the two real-Mongo suites shared one database and each dropped it, so they failed when jest ran them in parallel. Each suite now uses its own `dbName`.
- **Not split on purpose (money paths, ENGINEERING-RULES):**
  - `SafePayCheckoutController.js` (1,748)
  - `subscriptions/v2WebhookProcessor.js` (1,549)
  - `v2Management.js` (1,000)
  - `v2RecoveryPolicy.js` (877)
  - `safepayController.js`, `safepayFinanceController.js`, `payout/releasePayoutToProvider.js`

  Next step for these: extract pure helpers one at a time, each behind its existing tests, never a bulk move.

### 5. Frontend end-to-end tests (Playwright)

Run with `cd frontend && npm run test:e2e`. It starts the isolated backend on :5017 against the local TEST database and Vite on :5176.

- **`e2e/developer-console.spec.js`** (new, mocked API):
  - The authenticator gate blocks `/developer`:
    - letters are dropped from the code;
    - a wrong code shows the error;
    - no developer API call happens before the code is verified.
  - First sign-in shows the QR set-up.
  - A normal user is redirected to `/profile`.
  - Queues page: retrying and removing a dead-letter job send the right requests and update the list.
  - Read-only developers see no action buttons.
- **`e2e/public-browse.spec.js`** (new, real backend, no mocks):
  - A visitor opens `/search`, clicks a real job and lands on its detail page.
  - An unknown job shows "Oppdraget finnes ikke".
  - Break-it checks: bad id → 400, anonymous developer API → 401, anonymous create → 401, `limit=100000` capped at 100.
- **Real bug found by the real-backend spec:**
  - The isolated e2e backend never allowed the Playwright origin `http://127.0.0.1:5176` in CORS. Every real browser call returned "Network Error", which went unnoticed only because every earlier spec mocked the API.
  - Fixed in `backend/scripts/start-isolated-test.js`, which now sets `ALLOWED_ORIGINS` for the isolated server only.
- **`membership.spec.js` fixed:** three tests failed because the RUM beacon (`POST /api/rum`) was not mocked.
- **Flakiness:** with 4 workers, the first visit to `/developer` can take more than 5 s while the Vite dev server compiles the lazy developer chunk. That spec now waits up to 20 s. The new specs passed 64 of 64 runs (`--repeat-each 8 --workers 4`).

### 6. Final verification (after everything above)

| Check | Result |
|---|---|
| Backend jest, full suite including real-Mongo suites | 1,629 / 1,629 passed |
| Real-Redis queue suites (worker, retry/backoff, dead letter, scheduler sync, shared rate limit, cache) | 11 / 11 passed |
| Playwright e2e | 33 / 33 passed |
| Load, 50 users × 15 s, browse (:5001, nodemon dev) | 267 req/s, p95 24 ms, 0 errors |
| Load, 150 users × 20 s, browse (:5001, nodemon dev, morgan on) | 432 req/s, p95 301 ms, 0 errors |
| Load, 150 users × 20 s, browse (:5097, Redis mode) | 470 req/s, p95 247 ms, 0 errors |
| Break-it, 30 users × 10 s, abuse | 1,193 requests, 0 5xx, every case a correct 4xx |

## 2026-10-24 — Redis management pages (developer console)

Twelve pages under a new **Redis** sidebar group, at `/developer/redis/<section>`:

| # | Page | What it shows / does |
|---|---|---|
| 1 | Redis Overview | Version, uptime, ping latency, ops/s, hit rate, memory, health checks, and this instance's Redis connections |
| 2 | Memory | Used / peak / RSS, the maxmemory limit, fragmentation, evicted and expired keys, memory per key group (sampled) |
| 3 | Cache Manager | Every `cacheJson` namespace: TTL, hits and misses, cached keys with TTL and size; invalidate a namespace or delete one key |
| 4 | Key Explorer | Keys under Jobblo's own prefixes only (cache, rate limits, BullMQ, socket.io). Uses SCAN, never KEYS. Shows type, TTL and size; values are never shown |
| 5 | Queue Manager | The existing Queues page (BullMQ counts, dead letters, retry / remove) |
| 6 | Workers | Workers per queue on every instance, concurrency, completed / failed per minute (BullMQ metrics), job duration |
| 7 | Realtime Chat | socket.io adapter type, sockets on all instances, online users, rooms, Pub/Sub channels and their subscribers |
| 8 | Rate Limits | Every limiter with its limit and window, live counters (clients over the limit first), 429s by route and IP; **reset** for a locked-out client |
| 9 | Performance | Commands/s, ping latency, connections, keyspace hit rate, slowlog (command and key only), commands by total time |
| 10 | Alerts | Four Redis rules wired into the existing alert engine: Redis down, memory ≥ 85 %, evictions, queue backlog ≥ 500 |
| 11 | Configuration | Connection details from REDIS_URL (password never shown), approved settings via CONFIG GET (never `requirepass`), and checks against what Jobblo needs |
| 12 | Audit Log | Cache invalidations, rate-limit resets and queue retries: who, what, when |

### Backend

- **New files:**
  - `services/monitoring/redisInsights.js` holds all the logic.
  - `controllers/developer/redisController.js`.
  - 13 routes in `routes/developer.js`.
- **Small hooks in existing modules:**
  - `config/redis.js`: `connectionStates()`.
  - `utils/cache.js`: a namespace registry with hit/miss counts, plus `deleteKey`.
  - `middleware/rateLimiter.js`: a `LIMITERS` registry.
  - `sockets/chat.socket.js`: `onlineCount()`.
  - `services/queue`: BullMQ worker metrics turned on.
  - `alerts.js`: the Redis rules, and thresholds `redisMemoryPct` and `queueBacklog`, editable in Settings.
- **Who can do what:**
  - Reading the pages: any developer.
  - Cache invalidation: operations access; audited.
  - Rate-limit reset: the existing sensitive-action flow (`rate_limit_reset`), which needs a reason and a step-up code and is audited. It runs directly for operations developers, like IP unblock.
- **What is never possible:** running a Redis command, reading a value, `CONFIG SET`, or `FLUSH`.

### Bugs found by the tests (fixed)

- **Cache counters lost:** two routes sharing a cache namespace overwrote each other's hit/miss counters.
- **Worker metrics silently off:** `MetricsTime.ONE_DAY` does not exist in BullMQ 6, so the value was `undefined`. It is now `24 * 60`.
- **Running minute missing:** BullMQ only writes a data point when a minute closes, so the current minute is added from `meta.count − meta.prevCount`.

### Load: 50 developers polling all Redis pages, plus 20 public visitors, for 20 s

| | Before | After 2-second shared reads |
|---|---|---|
| Redis commands/s | 14,066 | **1,841** |
| Total throughput | 172 req/s | **303 req/s** |
| Developer pages p95 | ~800 ms | ~350 ms |
| Public `/api/services` p95 | 469 ms | **228 ms** |
| 5xx / errors | 0 | 0 |

How the fix works:
- Page reads are shared for 2 s.
- Simultaneous viewers trigger one computation.
- A failure is never kept.
- Every write clears the shared results.

### Break-it checks

| Attempt | Result |
|---|---|
| Unknown key group | 400 |
| Cursor injection (`0 MATCH *`) | 400 |
| `q=*` | Treated as literal text (escaped) |
| 300-character search | Cut to 100 characters |
| Delete a key outside a cache namespace (`../bull:email:1`) | 400 |
| Unknown cache namespace | 404 |
| Anonymous request / forged token | 401 |
| Rate-limit reset without a step-up code | 401 `STEP_UP_REQUIRED` |
| Read-only developer | No write buttons; the server answers 403 |

### Tests

- **Backend:** `__tests__/redisManagement.test.js`, 19 tests.
  - Unit tests always run.
  - The integration part runs against real Redis and is skipped when none is available.
  - Full suite: **1,648 / 1,648**.
- **Frontend:** `e2e/redis-console.spec.js`, 8 tests: all 12 pages open from the sidebar, the Redis-off state, config hides the password, cache invalidation with confirm and cancel, rate-limit reset with reason and step-up code, read-only view, and key search sent as plain text.
  - Full Playwright suite: **41 / 41**.

### Local Redis for development (no Docker)

- Installed in `C:\Users\GLB\redis`:
  - Redis 8.10.2 (portable Windows build).
  - `redis.conf`: `127.0.0.1` only, AOF + RDB persistence in `.\data`, `maxmemory 512mb`, `noeviction`.
  - `start-redis.cmd`.
- `backend/.env` now has `REDIS_URL=redis://127.0.0.1:6379` and `REDIS_PREFIX=jobblo`.
- Auto-start at Windows logon was **not** set up: it was blocked as a persistence change that needs the user's permission.
- If Redis is not running, the app keeps working in-process and the Redis pages say so.
