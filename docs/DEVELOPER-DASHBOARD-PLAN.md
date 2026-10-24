# Developer Dashboard + `developer` Role — Plan

## Context
Jobblo needs a separate **Developer Dashboard**, used by a new `developer` role, for technical monitoring: APIs, errors, servers, MongoDB, the scheduler, Stripe, SafePay, security and deployments. The requirement lists 27 pages. The UI must:
- use only reusable **shadcn/ui** components (input, button, select, dialog/popover, and so on)
- have **small border radius**
- use a **light colour palette**
- look professional and consistent across all pages.

The codebase already has most of the base pieces, so the plan is to **reuse first and build only what is missing**:
- **shadcn is already set up:** `frontend/components.json` (style `radix-nova`, neutral, lucide), `cn()` in `frontend/src/lib/utils.ts`, and 20 components in `frontend/src/components/Ui/`.
- **Tooling:** recharts, @tanstack/react-query, zustand and react-router v7 are installed.
- **Roles:** the enum in `backend/models/User.js:28-32` is `['user','superAdmin','provider','company']`. The guard is `requireAdmin` in `backend/middleware/auth.js`.
- **Existing data sources:**
  - `ErrorLog` with `utils/errorLogger.js`
  - `AdminActivity` (the audit log)
  - `StripeEvent` and `StripeWebhookHealth`
  - `StripeFinancialOperation`, `StripePaymentIncident`, `SafePayHistory`
  - `SubscriptionV2` and `SubscriptionBillingOperationV2`
  - the scheduler: `services/scheduler/index.js` and `jobs.js`, 10 `setInterval` jobs
  - socket.io in `server.js`
  - `requestId.js`, which sets `X-Request-ID`
  - the admin `/system/health|metrics|errors|disk` endpoints in `controllers/admin/systemAdminController.js`.

**Things that do not exist today.** Their pages will show "Not configured" instead of fake data:
- a queue system (bull or agenda)
- PM2 data
- a GitHub Actions integration
- MFA
- an SMS provider
- a ticket system.

---

## Part 1 — Role and access (backend)
1. Add `'developer'` to the role enum in `backend/models/User.js`.
2. In `backend/middleware/auth.js`, turn the existing check into `requireRole(...roles)`. Then define `requireAdmin = requireRole('superAdmin')` (no behaviour change for current callers) and `requireDeveloper = requireRole('developer','superAdmin')`. That is one shared function, not one copy per role.
3. Create `backend/routes/developer/index.js` with `router.use(authenticate, requireDeveloper, adminLimiter)` and mount it in `app.js` at `/api/developer`.
4. Developer routes are **read-only by default**. Each sensitive action (retrying a job, reprocessing a webhook, toggling a flag, resolving an error) uses `POST` and is written to `AdminActivity` via `services/admin/activityService.js`, including the actor and a reason.
5. Hard security rules:
   - No terminal or exec endpoint.
   - No arbitrary Mongo query endpoint.
   - Env check returns `{ name, present: boolean }` only.
   - Every log or metadata response passes through one `redact()` helper that masks token, password, secret, authorization, card and email-local-part fields.
   - Money actions (capture, refund) stay superAdmin-only.
6. Assigning a role: superAdmin can set `role: 'developer'` from the existing admin users page. The current `role_change` audit entry already covers this.

## Part 2 — Telemetry the pages need (backend, minimal)
| New piece | Why | Design |
|---|---|---|
| `middleware/requestMetrics.js` | API monitoring, APM, overview RPS/latency | Uses `res.on('finish')` to record route template (`req.route.path`), method, status and duration. Keeps in-memory per-route buckets and flushes every 60s to an `ApiMetricMinute` collection (TTL 30 days). P50/P95/P99 are computed from a capped sample array per bucket. `ponytail:` per-process and approximate; move to Prometheus/OTel when running multiple instances |
| `ApiMetricMinute` model | API history charts | `{ minute, method, route, count, errors, statusCounts, durSum, samples[] }` |
| Scheduler instrumentation in `services/scheduler/index.js` | Cron page, Overview | Wrap each job run once in the shared runner and write `SchedulerRun { job, startedAt, durationMs, ok, error }` (TTL 30 days). Next run = last run + interval |
| `ErrorLog` fields (extend, not new model) | Error monitoring | Adds `fingerprint` (hash of message + top stack frame), `count`, `firstSeen`, `lastSeen`, `status` (new / investigating / resolved / reopened), `assignee`, `notes[]` and `severity`. `logApplicationError` upserts by fingerprint, so repeats are grouped. If a resolved error comes back, status becomes `reopened` |
| `utils/redact.js` | Logs, diagnostics | One function, used everywhere |
| Live counters via socket.io | Live activity page | A `developer` room. Every 5s the server emits `{ rps, activeRequests, sockets, errorsLastMin }`. Reuses `app.get('io')` |

Everything else is **aggregation over existing models**:
- Users, jobs/orders, payments and SafePay come from `User`, `Order`, `Payment` and `SafePayHistory`.
- Webhooks come from `StripeEvent`.
- Subscriptions come from `SubscriptionV2` and the billing operation models.
- Audit comes from `AdminActivity`.
- Server data comes from Node `os` / `process`, plus the existing `systemAdminController` disk and health logic.
- MongoDB data comes from `db.stats()`, `collStats`, `serverStatus` and `$indexStats`, all read-only.

## Part 3 — UI system (frontend)
**Theme, scoped so the admin UI is not affected:**
- `DeveloperLayout` adds a `.dev-theme` wrapper class. In `src/styles/index.css`, `.dev-theme` sets:
  - `--radius: 0.375rem`, so lg = 6px and sm ≈ 4px
  - a soft background `oklch(0.985 0.003 250)`
  - white cards with a `--border` hairline
  - a light slate/blue primary
  - light pastel `--chart-1..5`
  - soft status colours: success green-50/600, warn amber-50/600, danger red-50/600, info sky-50/600.
- No hard-coded hex values. Only tokens.

**shadcn components to add:** run `npx shadcn add` for sidebar, chart, tabs, badge, tooltip, separator, label, popover, switch, scroll-area, command, sonner, avatar, breadcrumb and hover-card.
- **Decision (implemented):** the stock shadcn components live in `frontend/src/components/developer/ui/`. The existing `components/Ui/` was **not** renamed. It holds the public site's customised kit (full-width, green, 14px-radius buttons), and `Ui/button` vs `Ui/Button` resolve to different files on Windows and Linux, so a rename would change public-site behaviour. That casing problem is still open and needs its own fix.

**Reusable dev building blocks.** All are thin wrappers over shadcn, in `frontend/src/components/developer/`:
- `DevPageHeader` (title, description, actions, time-range select)
- `StatCard` (value, delta, sparkline)
- `StatusBadge` (ok / warn / error / unknown)
- `ChartCard` (shadcn chart + recharts)
- `DataTable` (shadcn table, search, filters, pagination, CSV export)
- `TimeRangePicker` (24h / 7d / 30d / custom)
- `JsonViewer`
- `Timeline`
- `DetailSheet` (side sheet for row details)
- `EmptyNotConfigured`.

Check `components/admin/*` (AdminStatCard, AdminDataTable, AdminDateRangePicker) first. Where one already covers the need, reuse it with dev-theme styling instead of duplicating it.

**Shell:**
- `src/pages/DeveloperDashboard/DeveloperLayout.tsx` uses the shadcn `SidebarProvider` + `Sidebar`, collapsible, with grouped nav (A–F, matching the requirement).
- The top bar has a breadcrumb, an environment badge (prod/staging), a ⌘K command palette for jumping between pages and doing trace-ID lookup, and the user menu.
- `src/components/shared/DeveloperProtectedRoute.tsx` is a copy of the `AdminProtectedRoute` logic that allows `developer` and `superAdmin`.
- Add a `developer` route tree in `src/routing/Routes.tsx` with lazy pages via the existing `withSuspense()`.
- After login, a `developer` user goes to `/developer`.

**Data layer:**
- API calls go in `src/api/developer/*.ts` using the existing `mainLink` axios instance.
- React Query hooks go in `src/features/developer/hooks.ts`, using `refetchInterval` for auto-refresh with a toggle in the header.
- Live pages use the existing `src/socket` client.

## Part 4 — Pages and phases
Each page uses the same layout: header + time filter, then a row of stat cards, then charts, then a table, then a detail sheet.

**Phase 1 — foundation and pages backed by data that already exists**
1. Overview: health score, users, jobs, RPS/latency, errors, Mongo/Stripe status, scheduler, recent activity
2. API Monitoring
3. Error Monitoring
6. Server Monitoring
7. MongoDB Center (read-only)
9. Cron & Scheduler
13. Stripe Webhook Center
20. Audit Logs
21. Developer Tools (health pings, env presence, DNS/SSL check, trace lookup)

**Status:** Phase 1 and Phase 2 are implemented. One shared rule set, `orderIssues` in `backend/controllers/developer/diagnosticsController.js`, defines "stuck" and "inconsistent" for SafePay, Reconciliation and Job Diagnostics. It mirrors the scheduler's own thresholds.
Not built yet from Phase 2:
- Investigation notes, assignment and approval workflow on reconciliation issues. These need a new model.
- Scheduled daily reports. CSV export is available now.

**Security review follow-up (current model, replaces the "no permission levels" decision):**
- **Access:** `User.developerAccess` is `readonly` (the default) or `operations`. `superAdmin` sits above both. The guards are `requireAccess()` in `controllers/developer/approvalsController.js` and `requireStepUp` in `services/developer/stepUp.js`.
  - **Readonly** sees everything and changes nothing.
  - **Operations** triages errors, tickets and incidents, and requests sensitive changes.
  - **Super Admin** runs sensitive changes directly and approves other people's requests. The approver can never be the requester.
- **Sensitive actions** are all defined once in `services/developer/sensitiveActions.js`: `ip_block`, `ip_unblock`, `flag_set`, `thresholds_set`, `developer_access`.
  - Every one needs step-up: an emailed OTP that yields a 10-minute token bound to the user and session.
  - Operations developers create a `ChangeRequest`, which expires after 24h. Approving it runs the action.
  - The developer dashboard exposes no financial operations.
- **Environment variables:** managed only in the server `.env`. The dashboard environment vault (encrypted DB overrides, `ENV_VAULT_KEY`, the Environment page) was removed on request. Developer Tools and Access & Settings show which variables are set, never their values.
- **Proxy trust:** `trust proxy` now defaults to `loopback, linklocal, uniquelocal`, so `X-Forwarded-For` is honoured only when the connection comes from nginx or ingress. Developer Tools has a "Client IP detection" check.
- **Request telemetry is aggregated, not stored per request:**
  - API metrics are one row per route per minute, with the top 50 IPs each, kept for 30 days.
  - Security events are buffered and capped at 5000 per 10s, kept for 30 days.
  - Delivery logs are one row per send, kept for 30 days.
- **Payout refusals** that need reconciliation (`PAYOUT_MODE_UNKNOWN` and similar) are now written to ErrorLog by the shared `releasePayoutToProvider` wrapper.
- **Duplicate payments:** the root cause was commit ff7eaab8. `scripts/archive-orphan-duplicate-payments.js` does a dry run by default; with `--apply` it archives the rows and then builds the unique index.

**Earlier decision, superseded:** for a while every developer had full access.
- **IP Management page (`/developer/ips`):**
  - Lists every client IP (`ApiMetricMinute.ips` merged with `SecurityEvent`), with a risk verdict (`ipRisk`).
  - Blocks are enforced by an `IpBlock` model and `services/monitoring/ipBlocks.js` (`net.BlockList`, 30s refresh). Durations go up to "Always".
  - Stripe webhooks are never blocked, and ranges wider than /16 are refused.
- `SecurityEvent.emailHash` (an HMAC) lets the dashboard count distinct targeted accounts even though emails are masked.

**Phase 4 status:** implemented. All 27 sections are now live.
- **Queues:** shows the four DB-backed work queues that already exist: Stripe events, subscription webhooks, recovery emails and payouts.
- **Tickets:** `SupportTicket` gains priority, assignee, escalation, an internal history, links to an error or incident, and a computed SLA.
- **CI/CD:** GitHub Actions through `GITHUB_TOKEN` and `GITHUB_REPO`, release info from `APP_VERSION`, `GIT_COMMIT_SHA`, `GIT_BRANCH` and `DEPLOYED_AT`, and errors first seen after the deploy.
- **Incidents:** a new `Incident` model, opened by `services/monitoring/alerts.js`. Alerts are deduplicated by fingerprint, show recovery confirmation and MTTA/MTTR, and notify through `SLACK_WEBHOOK_URL` and `DEV_ALERT_EMAIL`.
- **Reports:** nine on-demand reports with CSV, JSON and print-to-PDF export.
- **Access levels:** `User.developerLevel` can be `readonly`, `developer`, `senior` or `devops`. Every write route is gated by `requireLevel`. Alert thresholds live in GlobalConfig under `devdash_alert_thresholds`.

Not built: scheduled report delivery, ticket attachments, rollback from the dashboard (that stays in ArgoCD), and MFA.

**Phase 3 status:** implemented. New telemetry:
- `SecurityEvent`: every 401, 403 and 429, plus OTP failures, classified in one place (`services/monitoring/securityEvents.js`), with emails masked.
- `DeliveryLog`: every email (`sendLogged`) and every push send.
- In-process APM (`services/monitoring/apm.js`): event-loop delay, GC, heap and CPU, MongoDB command latency (driver `monitorCommands`), slow queries with filter keys only, and Stripe API latency.

Live Activity polls every 5s instead of using a socket room.

Feature flags are `GlobalConfig` `feature_*`/`flag_*` keys. A toggle needs a reason. In production only a Super Admin can toggle.

Not available: rollout percentages, cohorts, scheduled flag changes, IP block list, SMS, bounce tracking, distributed tracing.

**Phase 2 — money and diagnostics**
10. Stripe Payments
11. SafePay (lifecycle timeline, stuck detection, DB vs Stripe state)
12. Subscriptions
14. Reconciliation (reads `StripeFinancialSyncState` / `reconcileMoneyState` results)
15. User Diagnostics (no passwords or tokens shown)
16. Job Diagnostics

**Phase 3 — operations**
4. Logs Explorer (built on ErrorLog + AdminActivity + SchedulerRun + StripeEvent as a unified, redacted stream)
5. Live Activity (socket)
19. Security Center (from auth failures and rate-limit hits; needs a small `SecurityEvent` log written by `rateLimiter.js` and the auth middleware)
22. Feature Flags (reuse the existing admin feature-flags API)
24. Performance/APM (event-loop delay via `perf_hooks.monitorEventLoopDelay`, heap, GC)
18. Notifications/Email (only once nodemailer and Firebase sends are logged)

**Phase 4 — needs new integrations or decisions**
- 8. Queue: no queue exists, so show scheduler jobs plus "No queue configured"
- 17. Tickets
- 23. CI/CD (needs `GITHUB_TOKEN` and the GitHub Actions API, plus a deploy SHA env var)
- 25. Incidents/Alerts
- 26. Reports (CSV/JSON first, PDF later)
- 27. Developer Settings and sub-roles (read-only / senior / devops). For now there is one `developer` role. Sub-roles become a `permissions[]` field later if they are really needed.

**Phase 5 — investigation and reliability (built one by one)**
1. ✅ **Investigate** (`/developer/investigate`, `GET /api/developer/investigate?q=`). `classifyQuery` reads the pasted value as one of: ObjectId, Stripe ref (`pi_ cs_ ch_ re_ evt_ sub_ cus_ tr_ acct_ in_ py_ po_`), IP, email, or error reference / request ID.
   - It resolves the value across User, Order, Service, Payment, Payout, Dispute, Incident, SupportTicket, ErrorLog, ChangeRequest, SubscriptionV2, StripeEvent, StripeTransferRecord, SecurityEvent and IpBlock.
   - Every order it touches (max 3) gets the same `orderIssues` and `buildTimeline` as Job Diagnostics.
   - ⌘K lookups go here.
   - Only the current database is searched. Stripe objects from another account do not show.
2. ✅ **Data Integrity** (`/developer/integrity`; `GET /api/developer/integrity` returns cached results, `POST /integrity/run` needs operations access and is audited). It is read-only and includes 22 checks:
   - **Duplicates:** Payment/Payout per order, a PaymentIntent reused, a Checkout session reused, the same email (case-insensitive), more than one live subscription.
   - **Dangling references:** money, SafePay, dispute, order, subscription, review and ticket records that point at a missing record. Each check scans the newest 50k documents per collection.
   - **Broken rules:** a Payment with no Stripe reference, a paid order with no reference, a payout marked `transferred` with no transfer, bad amounts.
   - **Index drift:** every Mongoose schema index compared with `collection.indexes()`. A declared unique index that is missing is critical. This catches the failed `payments.orderId` unique build the comment in `models/Payment.js` warns about.
   - Results are cached per process.
   - Sample IDs link to Investigate.
3. ✅ **Backup & DR** (`/developer/backups`).
   - `services/backup`: `mongodump` / `mongorestore`. It works against both a VPS database and Atlas.
   - The URI is passed in a temporary 0600 config file, never in argv.
   - Every backup records a SHA-256 and per-collection counts, and can copy itself offsite through `BACKUP_OFFSITE_CMD` (no shell).
   - Retention keeps at least the newest 3 backups.
   - A restore drill verifies the checksum, restores into `<db>_restore_drill`, compares counts and drops the scratch database. Its duration is the measured RTO.
   - Runs come from `scripts/backup.js` (host cron), the optional in-app scheduler (`BACKUP_SCHEDULE_HOURS`), or the dashboard. Starting a backup needs operations access. Starting a drill needs operations access plus step-up.
   - Alerts: `backup_missing`, `backup_stale` (RPO = `BACKUP_MAX_AGE_HOURS`) and `restore_drill_failed`.
   - Atlas cloud snapshots are listed through a read-only service account (`services/backup/atlas.js`).
   - Runbook: `docs/runbooks/disaster-recovery.md`.
4. ✅ **SafePay State Machine** (`/developer/safepay-machine`; `GET /api/developer/safepay/machine`, `/safepay/machine/:orderId`). Read-only.
   - **Path check:** every order's path is rebuilt from `order.history` (`data.from/to`, or the `ACTION_TO` map for named actions). Each step is checked against `ORDER_TRANSITIONS` from `services/order/orderState.js`.
   - **Findings:**
     - Illegal transitions.
     - Unrecorded transitions: the status changed with no history entry.
     - Statuses outside the machine.
     - Payment, SafePayHistory or Payout disagreeing with the order status (`COMPANIONS` table).
   - **Diagram:** an SVG of the machine with observed flow volumes.
   - **Per-order view:** a path stepper, an actual vs expected record-state table, findings and the timeline.
   - Scans the newest 2000 orders.
   - **Bug found and fixed at the root:**
     - **Cause:** payment confirmation upserts SafePayHistory as `payment_received`. `approveWork` only *created* the row when it was missing, and auto-release never touched it. So completed, paid-out jobs kept showing as still in escrow, and the customer's rating and comment were dropped.
     - **Fix:** both paths now move open rows (`SafePayHistory.OPEN_STATUSES`) to `completed`.
     - **Existing rows:** not backfilled. The inspector lists them. · then Synthetic, Mobile, Dependency Map, SLO, Deployment Impact, Fraud, Cost, Capacity, Config Drift, Staging Failure Simulator, API Contracts.
5. ✅ **Synthetic Monitoring** (`/developer/synthetic`). Probes run on a timer inside the API process (`services/monitoring/synthetic.js`, every `SYNTHETIC_INTERVAL_MIN`, default 5 min).
   - **Built-in probes:** API root, job listing, categories, socket.io handshake, web app shell, and an optional login → profile → logout journey with a dedicated account. The journey always logs out, so it leaves no sessions behind.
   - **Results:** stored in `SyntheticRun` (TTL 30 days). The page shows uptime for 24 h and 7 d, p50/p95, and a run strip.
   - **Custom HTTP checks** (`SyntheticCheck`):
     - Creating, editing or deleting one needs operations access and is audited.
     - Targets are limited to our own API/web hosts plus `SYNTHETIC_ALLOWED_HOSTS`. Redirects are not followed, URLs with credentials are refused, and only http(s) is allowed. This prevents SSRF.
   - **Alert:** `synthetic:<key>` (high) after 2 consecutive failures within 30 min.
   - ponytail: the probes run on the same host, so they cannot detect a full server outage. Pair them with an external uptime monitor.
6. ✅ **Mobile App Monitoring** (`/developer/mobile`).
   - **Reporter (in the app):** `jobblo-app/src/monitoring/reporter.ts`.
     - Records session starts, uncaught JS errors (`ErrorUtils`), Hermes unhandled rejections, render crashes (the Expo Router `ErrorBoundary` in `app/_layout.tsx`), and 5xx / network / >3 s API calls (an axios interceptor in `src/api/client.ts`).
     - Batches are sent every 30 s, when the app goes to the background, and immediately for crashes.
     - A fatal crash is persisted first, then sent again on the next launch under its original session.
     - Paths are templated in `paths.ts`, so ids and query strings never leave the device. Check: `node src/monitoring/paths.check.mjs`.
   - **Intake:** `POST /api/mobile/telemetry`.
     - Public, rate-limited to 120 requests per 5 min per IP, body capped at 256 KB, at most 50 events per batch.
     - Fields are whitelisted and length-capped. Errors are fingerprinted by message plus top frame, with ids and digits normalised.
     - Stored in `MobileEvent` (TTL 30 days).
   - **Page:** crash-free sessions, active devices, error groups with stack trace and occurrences, versions with per-version crash-free %, platforms, devices, API failures, and recent crashes.
   - **Alert:** `mobile_crashes` (threshold `mobileCrashes`, default 5 fatal crashes in 15 min).
   - **Sentry:** `@sentry/react-native` ~7.11 is installed. `src/monitoring/sentry.ts` stays inert unless both `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENABLED=true` are set. To use it, also add the `@sentry/react-native` config plugin (org/project) for source maps and rebuild.
7. ✅ **Dependency Map** (`/developer/dependencies`, `GET /api/developer/dependencies[?refresh=true]`). Read-only.
   - **Components (19):** clients, edge (nginx), platform (API, socket.io, scheduler), data (Mongo, Blob, backups) and external services (Stripe API and webhooks, SMTP, FCM, Idura, Vipps, Google, OpenAI, GitHub, Slack).
   - **Health** = live checks plus passive signals.
     - Live checks are cached 60 s with a 5 s timeout each: Mongo ping, Stripe `balance.retrieve`, SMTP `verify()`, blob `getProperties`, OIDC discovery, OpenAI models, GitHub repo. None of them writes or sends anything.
     - Passive signals: APM, DeliveryLog, StripeWebhookHealth, SchedulerRun, SyntheticRun, MobileEvent and BackupRun.
     - `verdict()` is unit-tested.
   - **Page:** an SVG graph (edges coloured by the health of the target), a component table, and a sheet per component with "if this fails", its signals, and what it depends on / is used by.
8. ✅ **SLOs & Error Budget** (`/developer/slo`; `services/monitoring/slo.js`).
   - **Eight SLOs, as good/valid events over a rolling 7/14/30-day window:**
9. ✅ **Deployment Impact** (`/developer/deployment-impact`; `GET /api/developer/deployments/impact[/:id]?hours=1|3|6|12|24`).
   - **API releases** are recorded on boot (`services/monitoring/deployments.js` → `Deployment`).
     - Identity: `APP_VERSION`/`GIT_COMMIT_SHA`, falling back to package.json and `git rev-parse`.
     - The first boot of a new identity is the release; `DEPLOYED_AT` overrides its time; later boots bump `boots`.
   - **Mobile releases** are the first session of each app version, judged on crash-free sessions.
   - **Analysis:** each API release is compared on equal windows before and after, cut short by the next release. It covers 5xx rate, weighted p95, slow-request share, synthetic failures, error types first seen after the release, and the routes that changed most.
   - **Verdict** (`judge()`, unit-tested): regression / check / no change / improved / not enough traffic (< 50 requests a side).
   - Deliberate 5xx responses (for example `SUBSCRIPTION_REBUILD_IN_PROGRESS`) count like any other 5xx.
10. ✅ **Cost Center** (`/developer/costs`; `GET /api/developer/costs?month=YYYY-MM`, `PUT /costs/config` with operations access, audited with before/after).
    - **Measured:** Stripe processing fees summed from balance transactions (cached 10 min). Test-mode fees are shown but not counted.
    - **Metered (usage × configurable price):**
      - OpenAI tokens: the new `UsageRecord` stores token counts only, written by `aiController` for each text and vision call.
      - BankID verifications (`IdentityClaim`), emails sent (`DeliveryLog`), and blob GB (container listing, cached 6 h).
    - **Fixed:** monthly items entered in Settings.
    - **Also shown:** month-end projection, budget, previous month, platform-fee income (`Payout.platformFee`), cost per completed order and per active user, and database size.
    - `validateConfig()` and `project()` are unit-tested. Prices are list-price defaults and should be checked against invoices.
11. ✅ **Capacity Planning** (`/developer/capacity`; `GET /api/developer/capacity[?refresh=true]`, cached 10 min).
    - **History sources:**
      - Hourly `CapacitySnapshot` (disk, RAM, load, Mongo storage, blob bytes), started from `server.js`, TTL 400 days.
      - Daily requests and busiest minute from `ApiMetricMinute`.
      - Per-collection document growth reconstructed from ObjectId timestamps (90 days, using the `_id` index), so MongoDB has history immediately.
    - **Forecast** (`linearFit()` / `forecast()`, unit-tested): growth per day, value in 30/90 days, days until the limit, and confidence from r² and the number of points.
    - **Limits:** disk at 90 % alarm, RAM at 90 %, `CAPACITY_MONGO_LIMIT_GB` (Atlas tier), `CAPACITY_MAX_RPS` (load-test ceiling).
    - A resource already over its limit shows "now".
    - Load average is n/a on Windows.
    - ponytail: linear model — replace with a seasonal one after a year of data.
12. ✅ **Config Drift** (`/developer/config-drift`; `GET /api/developer/config-drift[?refresh=true]`, `POST /config-drift/baseline` with operations access, audited).
    - **Fingerprints** (`services/monitoring/configDrift.js` → `ConfigSnapshot`), recorded on each boot whose digest changed:
      - env vars declared in `.env.example` (SHA-256 fingerprints, never values),
      - installed package versions, Node version, app release, and GlobalConfig entries (fingerprinted).
    - **Baseline:** an accepted snapshot. Everything that differs from it is drift (added / removed / changed / set / unset). Boot history shows the diff between consecutive boots.
    - **Policy rules**, some production-only: Stripe key/toggle mismatch, live key in production, webhook secret, JWT/session secret strength, HOST bound to localhost, Swagger off, explicit https CORS, `TRUST_PROXY` not "true", Mongo credentials, backups, alert channel, scheduler on.
    - **Dependencies:** `package.json` ranges vs installed versions (semver).
    - **Stripe webhooks:** event types the code handles (parsed from `webhookDispatcher.js`) vs the events enabled on Stripe endpoints, both "never arrive" and "ignored".
    - `diffStates()` and `policyChecks()` are unit-tested.
13. ✅ **Failure Simulator** (`/developer/failure-simulator`; `GET /api/developer/failures`, `POST /failures` and `POST /failures/:id|all/stop` with operations access, audited).
    - **Faults** (`services/monitoring/faults.js`, `FailureExperiment`):
      - API latency or 5xx on a route prefix (middleware after `requestMetrics`),
      - Stripe API outage (`getStripeForMode`), email outage (`sendLogged`), push outage (`sendPushToUser`),
      - Stripe webhooks rejected with 503 (`webhookGuard` on both webhook routes),
      - scheduler job failure (`runOnce`).
    - **Rails**, checked on every call:
      - never when `NODE_ENV=production`,
      - only with `ENABLE_FAILURE_SIMULATOR=true`,
      - never with a live Stripe key,
      - never on `/api/developer` or telemetry,
      - 60 min max, auto-expiry, stop / stop-all.
    - **Results per experiment:** whether an incident opened and the detection time; 5xx and p95 during vs an equal window before; failed sends, failed jobs and synthetic failures.
    - Verified end to end with supertest against the real app. `availability()`, `matches()` and `validate()` are unit-tested.
14. ✅ **Fraud & Abuse** (`/developer/fraud`; `GET /api/developer/fraud[?refresh=true]`, `GET /fraud/:userId`, `PATCH /fraud/:userId` with operations access, audited; a note is required to confirm or dismiss).
    - **11 explainable rules** (`services/monitoring/fraud.js`):
      - shared public IP across ≥ 3 accounts,
      - customer = provider (shared public IP or specific device on a paid order),
      - refund abuse, dispute-heavy accounts, card chargebacks,
      - off-platform payment or contact in chat (regex inside MongoDB; only counts and chat ids leave the DB),
      - listing spam, brand-new account velocity, reports from ≥ 2 users,
      - review manipulation (linked accounts, five-star reviews from day-old accounts),
      - abandoned-checkout churn (card testing).
    - **Scoring:** the strongest hit per rule, summed and capped at 100. High ≥ 60, medium ≥ 30.
    - **Review:** `FraudCase` stores review state. A dismissed or confirmed case reopens only when the score rises.
    - **Network rules** ignore private, loopback, CGNAT and link-local IPs.
    - **Alert:** `fraud:<userId>` for open high-risk cases. The scan is cached 10 min.
    - Proven end to end with a seeded scenario (removed afterwards). `isPublicIp`, `fingerprints`/`overlap`, `score` and the chat pattern are unit-tested.
15. ✅ **API Contracts** (`/developer/contracts`; `GET /api/developer/contracts[?flush=true]`, `GET /contracts/endpoint?method&route&status`, `POST /contracts/events/:id/ack` with operations access, audited).
    - **Sampler:** `contractSampler` wraps `res.json` on `/api/*` (developer, telemetry and docs excluded). It samples the first 100 responses per endpoint and status class (2xx / 4xx), then 5 %, and records field paths and JSON types only. Data-keyed maps collapse to `*`.
    - **Storage:** variants are flushed every minute to `ApiContract`.
    - **Change detection** (`classify()`, unit-tested), once an endpoint has ≥ 20 prior samples:
      - a field present in ≥ 90 % of prior responses goes missing → breaking,
      - a never-seen type → breaking,
      - a new field → additive.
      Empty arrays and null parents are not removals.
    - **Events:** `ContractEvent` (TTL 180 d), stamped with the running release.
    - **Alert:** `contract:<route>` for unacknowledged breaking changes in the last hour.
    - **Docs coverage:** Swagger paths compared with 30 days of traffic routes (undocumented / unused).

**Phase 6 (second list, 16–33)**

16. ✅ **Stripe Connect Health** (`/developer/connect`; `GET /api/developer/connect[?refresh=true]`, `GET /connect/:userId` (live `accounts.retrieve`), `POST /connect/:userId/resync` with operations access, audited).
    - **Readiness rule:** `readinessFromAccount()` was extracted from `getConnectReadiness`, so the payout gate and the dashboard share one rule. No behaviour change; the suite passes.
    - **Data source:** one paged `accounts.list` per scan, cached 10 min.
    - **Per provider:** Stripe readiness and status, currently-due / past-due / pending counts, deadline, capabilities, verification errors, DB vs Stripe drift, and the SafePay money held for them.
    - **Also lists:** providers with orders but no Connect account, Stripe accounts not linked to any user, failed transfers and failed bank payouts.
    - **Resync** reuses the owner-checked `persistConnectAccount` path.
    - **Finding:** `persistConnectAccount` never stores `restricted`, so a disabled account is saved as `pending_verification`.
20. ✅ **Financial Ledger** (`/developer/ledger`; `GET /api/developer/ledger?month=YYYY-MM`, `GET /ledger/:orderId` as a journal with a running escrow balance). Read-only, all amounts in øre.
    - **Identity** (`buildLedger()`, unit-tested): charged = refunded + paid out + kept + held.
      - charged = captured amount, else checkout amount.
      - refunded = succeeded refund operations, checked against `Payment.refundedAmountMinor`.
      - paid out = Stripe transfers minus reversals, checked against `Payout.netProviderAmount`.
      - kept = customer fee + provider fee, recognised only on settled orders that were not fully refunded.
    - **Flags:** held on a closed order, overdisbursed, refund records disagreeing, transfer amount mismatch, transfer not recorded, payout arithmetic, gross ≠ agreed price, capture mismatch, charged below price, duplicate Payment rows.
    - **Escrow liability:** a balance over all open orders.
31. ✅ **Business Transactions** (`/developer/transactions`; `GET /api/developer/transactions?days=`, `GET /transactions/:id`, where the id may be a job, order, payment, payout or bid). Read-only.
    - **Stages:** posted → first bid → accepted → paid → started → delivered → completed → paid out → reviewed. They come from Service, JobRequest, Order, Payment, Payout and Review.
    - **Branches:** cancelled, refunded, disputed, declined.
    - **Journey position** (`position()`, unit-tested): the journey stops at the first REQUIRED step that never happened, so a review written at approval cannot hide a missing payout. First bid and review are optional. Review timing is measured from completion.
    - **Journeys view:** funnel reach, p50/p90 per step, and jobs stuck past per-step limits.
    - **Trace view:** a stepper with time between steps, bids, earlier cancelled attempts, disputes and refunds. Investigate links to it.
    - Overlaps #19 Marketplace Health (conversion); #19 will add supply/demand, categories and geography rather than repeat this funnel.
17. ✅ **Real Users (RUM)** (`/developer/rum`; intake `POST /api/rum` is public, rate-limited, 64 KB, whitelisted, and accepts text/plain for `sendBeacon`; read via `GET /api/developer/rum?days=1|7|30`).
    - **Web reporter** `frontend/src/lib/rum.ts`, using the `web-vitals` 5.3 dependency:
      - page views with load time,
      - LCP / INP / CLS / FCP / TTFB with Google ratings,
      - uncaught errors and unhandled rejections (max 10 per tab).
      - Batched every 15 s, on hide, and when 20 events are queued.
    - **Anonymous:** a random per-tab id in memory, no cookies, no storage, no user, no query strings. `/developer` and `/dashboard` are never recorded.
    - **Storage:** `RumEvent` (TTL 30 d).
    - **Page:** p75 per vital (the pass line) with a good / needs-improvement / poor split, crash-free visits, per-page p75 and errors, devices, browsers, error groups.
    - Verified with real Chromium visits (desktop and mobile emulation).
18. ✅ **User Impact** (`/developer/impact`; `GET /api/developer/impact?days=1|7|30` and `GET /api/developer/impact/scope?kind=error|incident|release|window&id=|from=&to=`). Read-only. `services/monitoring/impact.js`.
    - **Scopes:**
      - an error group (code + route + message, last 30 d),
      - an incident (its window, filtered to `relatedErrorCodes` when set, plus `relatedOrderIds`),
      - an API release (only error groups first seen after it, same window as Deployment Impact),
      - any time window (max 31 d).
    - **Attribution:** `collectRefs` (unit-tested) reads `userId`, `metadata.userId`, `metadata.orderId`, `metadata.orders[]` and `metadata.disputes[]`, plus Stripe `pi_` ids (mapped to jobs) and `sub_` ids (mapped to users).
      - Customers and providers of affected jobs count as "via job".
      - Rows with no user or job are reported as unattributed, never guessed.
    - **Money:** job value (agreed price) and the amount captured on those jobs, excluding refunded payments.
    - **Page:** error groups ranked by people affected, plus incidents and releases with headline numbers. The detail view lists users (emails masked), jobs and payments, with links to User/Job diagnostics, Transactions and Ledger.
19. ✅ **Marketplace Health** (`/developer/marketplace`; `GET /api/developer/marketplace?days=7|30|90`). Read-only. `services/monitoring/marketplace.js`.
    - **Data:**
      - demand = `Service` (jobs posted in the period),
      - supply = `JobRequest` (applications to those jobs),
      - hire = a non-cancelled `Order` for the job.
    - **Per category and per county:**
      - jobs posted,
      - % of jobs that got an applicant,
      - applications per job,
      - distinct providers,
      - hire rate,
      - median time to first applicant,
      - jobs unanswered for over 48 h,
      - median price,
      - a health label. `verdict`, unit-tested with `segment`, uses these labels:
        - "thin": fewer than 3 jobs;
        - "undersupplied": under 50 % of jobs got an applicant, or over 30 % are unanswered;
        - "oversupplied": over 8 applications per job with under 20 % hired;
        - "low_conversion": under 15 % hired;
        - "healthy": otherwise.
    - **Also:**
      - active categories with no jobs,
      - provider concentration (the top provider's and the top 3 providers' share of hires),
      - a liquidity series (jobs posted, applications, hires),
      - a list of unanswered jobs that links to Transactions.
    - **Geography:** the county code is mapped to `NorwayCounty.name`; jobs without a county fall back to the listing's city. No overlap with the #31 funnel: this page covers supply and demand per segment, not a job's stages.
21. ✅ **Event Consistency** (`/developer/event-consistency`; `GET /api/developer/event-consistency?days=7|30|90`). Read-only. `services/monitoring/eventConsistency.js`.
    - **12 checks, each classified by area (webhook / job / payment / notification) and by problem (missing / duplicate / out of order):**
      - **Webhooks:**
        - A Stripe event was never received. `events.list` covers the last 3 days, handled types only, capped at 300, cached for 10 min, and skips events younger than 5 min. If none of Stripe's events reached this database, the check reports that webhooks go to another deployment instead of flagging everything.
        - An event was claimed but never finished (`StripeEvent` processing for over 15 min, or the subscription pipeline is received / processing / failed).
        - Events for one object arrived out of order (`outOfOrder`, which uses lifecycle ranks per event family).
        - An event was redelivered and absorbed by idempotency (informational).
      - **Jobs:**
        - Steps are out of order: created → paid → started → ready for review → completed (`orderSequence`).
        - A status was reached without its timestamp.
      - **Payments:**
        - An order is paid but has no Payment row.
        - The Payment and the order disagree after a refund or capture.
        - Escrow was opened twice: more than one open SafePay record per order.
      - **Notifications:**
        - An identical in-app notification was sent within 2 min (`bursts`).
        - A job was paid or completed, but no notification followed.
        - An email or push was sent twice within 1 min.
    - **Unit tests:** `outOfOrder`, `orderSequence` and `bursts`. Duplicate *records* stay on Data Integrity.
22. ✅ **Migrations** (`/developer/migrations`; `GET /api/developer/migrations[?refresh=true]`, cached for 10 min). Read-only: scripts are never run from the dashboard. `services/monitoring/migrations.js`.
    - **No migration framework (YAGNI).** Each one-off script in `backend/scripts` has a detector that asks the database whether its work is still outstanding. A "has run" ledger would turn wrong after a restore; the detectors stay correct.
      - **Scripts covered:** admin role, phone index, usage-period index, payment dedupe, orphan duplicate archive (points to its runbook), chat merge, OG backfill.
      - **New scripts** whose names look like migrations but have no detector are listed so they get one.
    - **Index changes not applied:** reuses Integrity `indexCheck`, which is now exported.
    - **Stored data vs schema:** `schemaRules` (unit-tested) lists every enum and hard-required path. The page counts documents that would fail `.save()`, typically legacy data. Locally: 45 `Transaction`s with no `planId`, and 12 with `type: 'safepay'` written by a code path that has since been removed.
    - **Rollback readiness checklist:**
      - backup within 24 h,
      - drill within 30 d,
      - previous release recorded,
      - no unique index missing,
      - data matches the schema,
      - no destructive migration pending.
    - **Incompatible app versions:** mobile versions active in the last 7 d, against breaking `ContractEvent`s recorded after each version first appeared.
23. ✅ **External Services**: a tab on Dependency Map (`/developer/dependencies?view=external`; `GET /api/developer/dependencies/external?hours=24|168`). Read-only.
    - **Recorder:** `services/monitoring/externalCalls.js`. Calls are held in memory per (service, operation) and written to `ExternalCallMinute` (TTL 30 d) every minute, the same way as `requestMetrics`.
      - **Stripe:** recorded from the existing Stripe `response` hook in `apm.recordStripe`.
      - **OpenAI:** recorded through a `timedFetch('openai')` passed to the OpenAI client.
      - **Email and push:** read from `DeliveryLog`, which already stores latency and errors.
      - **Geocoding:** a new built-in synthetic probe calls the Geonorge address search. Turn it off with `SYNTHETIC_GEO=false`. Google Maps runs in the browser, so its failures show under Real Users.
    - **Pure functions (unit-tested):**
      - `classify` sorts each call into ok, error, rate-limited or client error. Rate limiting is recognised from a 429 and from provider text such as SMTP 421/454 or `5.4.5`, or FCM `message-rate-exceeded`.
      - `templateOp` replaces Stripe-style ids with `:id`, but only when the segment contains uppercase letters or digits, so path words like `payment_intents` and `setup_intents` stay intact. This also fixed APM's Stripe route grouping, which now uses the same function.
      - `fold` combines the rows into totals, a count-weighted p95, a time series and per-operation stats.
    - **Quotas:**
      - Stripe: 100 req/s live or 25 req/s test, compared against the busiest minute.
      - SMTP: `SMTP_DAILY_QUOTA`, or 500 per day for Gmail.
      - OpenAI: `OPENAI_RPM_LIMIT`, when set.
24. ✅ **Runbooks** (`/developer/runbooks`). `services/monitoring/runbooks.js`, `RunbookRun` model (TTL 1 y), `runbookController.js`.
    - **Routes:**
      - `GET /runbooks` and `GET /runbooks/:key`;
      - `POST /runbooks/:key/runs` (operations);
      - `PATCH /runbooks/runs/:id` (operations).
    - **Nine runbooks, kept in code:** API errors, webhooks, money out of sync, scheduler, database, backups, brute force, synthetic, mobile.
      - Each lists the alert fingerprints it covers; `forFingerprint` (unit-tested) matches exact keys and `prefix:` keys.
      - Open incidents show their runbook directly.
    - **17 read-only diagnostic checks.** They reuse existing services: event consistency, config drift, Connect health, backups, APM, `SecurityEvent`, `SyntheticRun`. Each has a 10 s timeout and rolls up to pass, warn or fail.
    - **Recovery steps only point at workflows that are already gated.** Each step is labelled with the access it needs: operations, step-up, a Super Admin `ChangeRequest`, or a human with shell or dashboard access.
      - Money recovery says explicitly: never release or refund from the console.
      - Two safe steps run inline through their existing endpoints: "back up now" and "re-run probes".
    - **Run log:**
      - A run records the check results and the steps ticked off (with notes), then an outcome on close.
      - Re-running while a run is open refreshes it instead of opening a second one.
      - When a run is tied to an incident, results, steps and the close are written to the incident timeline.
      - Every write is audited.
25. ✅ **Privacy & Data** (`/developer/privacy`; `GET /api/developer/privacy`, read-only; `POST /api/developer/privacy/export/:userId`, Super Admin + step-up + a reason of at least 10 characters, audited with `targetModel: 'User'`). `services/monitoring/privacy.js`.
    - **Retention:**
      - A declared `POLICY` lists 19 collections, each with its personal fields, purpose and retention. Accounting records are a legal hold of 5 years under bokføringsloven.
      - Each policy is checked against the real TTL index and the number of records older than the limit (`retentionStatus`, unit-tested).
      - Locally: `errorlogs`, `adminactivities` and `notifications` have no TTL, so nothing ever deletes them.
    - **Deleted accounts:**
      - `userLeftovers` (unit-tested) lists personal fields still on each `isDeleted` user.
      - Also counted: live sessions, active push tokens, favourites, open job listings and pending applications.
      - Self-service deletion anonymises the account. Admin `deleteUser` only soft-deletes and leaves the personal data; reported to the user, not changed.
    - **Data-subject requests:** `subjectRequests` (unit-tested) finds support tickets about deletion, access or export (Norwegian and English keywords) and tracks the one-month GDPR deadline.
    - **Consent:**
      - Terms version per active user against `CURRENT_TERMS_VERSION`, now exported from `authController`. Locally, 46 of 66 users never accepted any version.
      - Newsletter opt-ins.
      - Cookie consent is browser-only, which the page states.
    - **Export (Art. 15/20):**
      - Contents: profile via `sanitizeUserOwner` (no password, tokens or bank details), jobs, applications, orders, payments, reviews, only the chat messages the person wrote, notifications, sessions (no tokens), tickets, subscriptions, favourites.
      - Downloaded as JSON.
26. ✅ **Search & Location** (`/developer/search`; `GET /api/developer/search-health?days=1|7|30`). Read-only. `services/monitoring/searchHealth.js`.
    - **New `SearchLog`** (anonymous, TTL 30 d, added to the privacy policy). `recordSearch` is a fire-and-forget write from `getAllServices` (first page only) and `getNearbyServices`. It stores the normalised words, categories, number of region codes, radius in km, result count and time taken.
    - **Listing problems on open listings (`geoIssue` / `listingFindings`, unit-tested):**
      - no coordinates,
      - 0,0,
      - lat/lng swapped (mainland test, so a point in Asia isn't read as a swapped Svalbard point),
      - outside Norway,
      - no county code,
      - a category that doesn't exist.
    - **The page also shows:**
      - zero-result rate and the top empty searches,
      - p50/p95 of search time,
      - radius bands,
      - search endpoint latency from `ApiMetricMinute`,
      - whether the 2dsphere index exists.
    - **Bug fixed in `getNearbyServices`, a public route:**
      - It returned drafts, cancelled and completed listings with no limit; it now returns only public listings (`PUBLIC_SERVICE_STATUSES`).
      - Radius capped at 200 km and results at 50.
      - Invalid lat/lng/radius now get a 400 instead of a 500.
27. ✅ **Sessions** (`/developer/sessions`; `GET /api/developer/sessions?days=&kind=` and `GET /api/developer/sessions/:sessionId`). Read-only. `services/monitoring/sessionDiagnostics.js`.
    - **A breadcrumb replay, not a DOM recording (rrweb is the documented upgrade path).**
      - `lib/rum.ts` keeps the last 30 steps in memory: pages, clicks described by role and label only (never input values), API calls with templated path, status and ms, and console errors.
      - It sends them only with a problem, capped at 20 per tab and deduplicated.
    - **New problem kinds** (RUM type `problem`; JS errors stay type `error` and now carry the trail too):
      - render crash (`RouteErrorElement`),
      - code chunk that failed to load,
      - page not found (`NotFoundPage`),
      - API 5xx or network failure (axios interceptors in `api/mainURLs.ts`),
      - console error (sent 1 s later and skipped if the same message was already reported, so a React crash is counted once).
    - **Masking runs twice:** in the browser, then on intake (`maskLabel` / `normalizeTrail`, unit-tested). It covers emails, phone numbers and 24-hex ids, whitelists crumb types and caps the trail at 30. Pages are templated.
    - **Page:**
      - problem-free visit rate and counts per kind,
      - grouped problems with a Replay link,
      - visits with problems,
      - the replay timeline (`buildTimeline`, unit-tested: merges views, crumbs and problems and removes duplicates).
    - Verified with a real mobile visitor session; the test data was deleted. Hard page reloads start a new visit, because the id lives only in memory.
28. ✅ **Mobile releases**: a "Releases" tab on Mobile App (`/developer/mobile?view=releases`; `GET /api/developer/mobile/releases?days=7|30|90`). Read-only. `services/monitoring/mobileReleases.js`.
    - **Per platform, over the last 7 days of `MobileEvent` sessions:**
      - latest version,
      - share of devices on the latest version,
      - outdated share (2 or more releases behind, or below the minimum),
      - share below the minimum (`MOBILE_MIN_VERSION[_IOS|_ANDROID]`, optional).
    - **Version table** (`releaseTable` / `cmpVersion`, unit-tested: numeric semver, so 1.10 > 1.9):
      - status, devices and share,
      - crash-free sessions,
      - API failures per 100 sessions,
      - breaking API changes since the version first appeared (reuses `migrations.incompatibleClients`, now exported).
    - **Also:**
      - an adoption curve: daily share of devices on the latest version, carried forward on days with no sessions;
      - devices per major OS version;
      - the version in the repo's `jobblo-app/app.json` (the next build).
    - **Not built (YAGNI):** a force-update endpoint for the app. The minimum version is report-only until the app checks it.
    - Verified with marked seed data (`installId` starting `devtest-`), which was then deleted.
29. ✅ **Test & Quality** (`/developer/quality`; `GET /api/developer/quality?days=7|30|90`). `services/monitoring/quality.js`, `QualityRun` model (TTL 180 d).
    - **Intake:** `POST /api/quality/report` (`routes/quality.js`).
      - Returns 404 unless `QUALITY_INGEST_TOKEN` is set. The token is checked with a timing-safe compare against the `X-Quality-Token` header.
      - Rate-limited.
      - The payload is whitelisted (`normalizeReport`), and the CI URL must be on github.com.
    - **Reporter:** `scripts/quality-report.js` turns Jest's own `--json` output and `coverage-summary.json` into the report (`toReport`, unit-tested).
      - Contents: totals, coverage, failing tests with a short message (ANSI stripped), files that failed to load, the 10 slowest files, and branch/sha/run id from GitHub Actions.
      - It never fails a build.
    - **CI changes:**
      - The backend job runs `npm run test:quality` (new: `test:ci` plus `--json` plus a coverage summary over controllers, routes, middleware and services).
      - A new step "Report test results" runs `if: always()`, so failures are reported too. It does nothing until both GitHub secrets are set.
      - `jest-results.json` is gitignored.
    - **Analysis:**
      - Failing tests are ranked across runs.
      - Flaky = failed in one run and passed in another of the same suite on the same commit (`flakyTests`, unit-tested).
      - Coverage trend.
      - GitHub Actions runs (reusing `githubRuns`, now exported and including `run_attempt` for re-runs).
    - **Quality gates (`evaluateGates`, unit-tested).** Blocking gates:
      - latest `main` tests pass,
      - coverage at least `QUALITY_MIN_COVERAGE` and not dropping more than `QUALITY_MAX_COVERAGE_DROP` points,
      - CI green on `main`,
      - no unacknowledged breaking API change,
      - no open critical incident.
      - Advisory only: flaky tests, reports missing, GitHub not configured.
      - Verdict: clear, warning or blocked.
    - **Tests:** `__tests__/qualityIngest.test.js` covers the intake (404 when off, 401 wrong token, 201 with a sanitised URL), flaky detection, gates and `toReport`. One real local run is stored: 1,586 of 1,606 passed, 45.5 % line coverage.
30. ✅ **Change Risk** (`/developer/risk`; `GET /api/developer/risk`, `POST /api/developer/risk/assess`, a read-only preview). `services/monitoring/changeRisk.js`.
    - **Scoring:** a 0–100 score from hand-tuned weights (`ponytail:`, kept in one file). Each factor carries a reason and, where it helps, a mitigation. Levels: low, medium, high, critical (75 or more).
    - **Pure factor functions (unit-tested):**
      - `actionFactors`: IP block width, your own IP inside the block, signed-in sessions in the range, no expiry; flags touching payments, sign-in or availability, or disabling a feature; thresholds more than doubled; SLO targets lowered; operations access.
      - `roleFactors`: becomes superAdmin or developer, removes the last Super Admin, account under 7 days old, open fraud case, deleted account.
      - `stripeModeFactors`: production switched to test, target key missing or of the wrong kind, no webhook secret, open paid orders in the current mode, active subscriptions, pending payouts.
      - `deploymentFactors`: diff size; touches money, sign-in, models, migration scripts, infrastructure or dependencies (docs and tests excluded); CI failed for the head commit; destructive migrations pending.
      - `environmentFactors`: production, open critical or high incidents, burning SLOs, a blocked quality-gate verdict, another release within 2 h, and off-hours in Europe/Oslo time (Friday from 14:00, weekend, night).
    - **Deployment diff:** a two-dot `git diff --numstat` between the running commit and the ref, so rollbacks are scored too. Falls back to the GitHub compare API. The ref is validated, and `execFile` runs without a shell.
    - **Applied before every change:**
      - `approvalsController.submitAction` scores every sensitive action, stores the score on the `ChangeRequest` (new `risk` field) and in the audit entry.
      - A **critical** score returns 409 `RISK_CONFIRM` until the request repeats with `acknowledgeRisk: true`. The same applies when a Super Admin approves someone else's critical request.
      - Scoring errors never block a change.
      - Frontend: `useRiskConfirm`, together with the dialog in `StepUpProvider`, shows the reasons and retries on confirm, both for `useSensitiveAction` and for Approvals.
    - **Verified end to end:**
      - Blocking `::/48`, which contains your own IP, scored 100 and was refused with 409; nothing was applied.
      - A first test run applied two harmless 1-hour blocks on documentation addresses (198.51.100.x); they were removed straight away.

**Security: authenticator-app 2FA is required for superAdmin and developer**
- **TOTP** (RFC 6238) on `node:crypto`, with no OTP library: `services/auth/mfa.js`.
  - It passes the RFC test vectors. Replay of a used 30 s step is refused, and ±1 step is allowed for clock drift.
  - The secret is stored AES-256-GCM-encrypted with `MFA_ENCRYPTION_KEY`, or with a key derived from `JWT_SECRET` (`ponytail:`).
  - 10 one-time backup codes are stored as SHA-256 hashes.
- **Enforced centrally.**
  - `authenticate` refuses a superAdmin or developer session without `Session.mfaVerifiedAt` (403 `MFA_REQUIRED`). Only `/api/auth/mfa*`, `/api/auth/profile` and `/api/auth/logout` stay open.
  - The socket.io handshake applies the same rule.
  - Every login path (password, Google web and mobile, Vipps, BankID) ends in `createSession`, so none can skip it. Sessions that existed before this change must verify too.
  - The check uses the user's role at request time, so a later promotion is covered.
- **Endpoints:**
  - `GET /api/auth/mfa` (status);
  - `POST /api/auth/mfa/setup` (new pending secret, returning the otpauth URL; 409 if already enabled);
  - `POST /api/auth/mfa/verify` (`code` or `backupCode`; rate-limited to 6 failures per 15 min per user; a wrong code returns 400 so clients do not refresh and resend);
  - `POST /api/admin/users/:id/mfa/reset` (Super Admin; not for yourself; signs the user out everywhere; audited).
- **Frontend:**
  - `components/shared/MfaGate.tsx` sits inside the Admin and Developer route guards: QR (`react-qr-code`, the one new dependency) plus manual key, then the backup codes shown once, or a code / backup code at sign-in.
  - Any other call that gets `MFA_REQUIRED` is sent to `/mfa?next=…` by the axios interceptor.
  - The admin User page shows the 2FA state and has a "Tilbakestill 2FA" (reset 2FA) button.
- **Tests:**
  - `__tests__/mfa.test.js`: RFC vectors, drift, replay, base32, encryption, backup codes, and the middleware allow-list.
  - An integration run on the real models (enrol, wrong code, replay, backup code reuse, reset), using a throwaway user that was then deleted.
  - Browser end to end: setup → wrong code → right code → backup codes → console reachable.
- **Not covered:** the mobile app has no 2FA screen, so admin and developer accounts cannot use the app (their calls get `MFA_REQUIRED`). Step-up for sensitive actions still uses the emailed code.

     | SLO | Default target | Measured as |
     |---|---|---|
     | API availability | 99.5 % | non-5xx |
     | API latency | 99 % | ≤ `SLO_LATENCY_MS` |
     | Synthetic uptime | 99.5 % | probe runs that passed |
     | Stripe webhook processing | 99.9 % | events processed |
     | Email delivery | 99 % | sends accepted |
     | Push delivery | 98 % | sends accepted |
     | Background jobs | 99 % | scheduler runs that succeeded |
     | Mobile crash-free sessions | 99.5 % | sessions without a fatal crash |

   - `/api/developer/*` and telemetry routes are excluded from the API SLOs.
   - **Latency counting:** `requestMetrics` now counts `slow` requests per bucket (exact, not estimated from p95). Older rows have no `slow` field and are skipped.
   - **Per SLO:** SLI, budget, budget remaining, 1 h / 6 h burn rate, and a status of ok, at_risk (≤ 25 % left or 6 h burn ≥ 6×), fast_burn (1 h burn ≥ 14.4×), breached or no_data. `evaluate()` is unit-tested.
   - **Targets:** editable through the sensitive action `slo_targets_set` (90–99.999 %, step-up, approval for operations developers), stored in GlobalConfig `devdash_slo_targets`.
   - **Alert:** `slo_burn:<key>` (high) on fast burn with at least 20 events in the hour, evaluated every 5 min.
   - **Page:** SLO cards with a budget bar, plus a budget burn-down chart and a daily SLI chart.

**Admin dashboard (same UI as the Developer Console)**
- Every admin page now uses dev-theme tokens: the hard-coded storefront hex colours, Tailwind grays and xl/2xl radii were replaced by a one-off codemod. The shared admin wrappers now use `components/developer/ui` instead of the storefront `components/Ui`, which fixes the full-width stacked filters and the green buttons.
- New `/dashboard/users/:id`, backed by `GET /api/admin/users/:id/overview`. It uses an explicit safe field list (no bank or identity numbers) and covers profile, stats, orders, jobs, chats, reviews, money, disputes and support, devices and the admin log.
- New `/dashboard/orders/:id`, backed by `GET /api/admin/orders/:id/details`, which reuses Job Diagnostics `getJob`. It shows the parties with contact details, payment, payout, the health check, disputes, the timeline and notifications.
- `/dashboard/system-health` renders the live Server page; it is listed as "Server" in the sidebar.
- The Chats list's Ordre-ID column showed `[object Object]` because `orderId` is populated. Its type is fixed and the column now links to the order detail page.

## Critical files
- **Backend, edited:**
  - `backend/models/User.js`
  - `backend/middleware/auth.js`
  - `backend/app.js`
  - `backend/models/ErrorLog.js`
  - `backend/utils/errorLogger.js`
  - `backend/services/scheduler/index.js`
  - `backend/server.js` (developer socket room)
- **Backend, new:**
  - `backend/routes/developer/index.js`
  - `backend/controllers/developer/*.js`
  - `backend/middleware/requestMetrics.js`
  - `backend/models/ApiMetricMinute.js`
  - `backend/models/SchedulerRun.js`
  - `backend/utils/redact.js`
- **Frontend, edited:**
  - `frontend/src/routing/Routes.tsx`
  - `frontend/src/styles/index.css` (`.dev-theme`)
  - the login redirect
  - the `components/Ui` → `ui` rename
- **Frontend, new:**
  - `frontend/src/pages/DeveloperDashboard/*`
  - `frontend/src/components/developer/*`
  - `frontend/src/components/shared/DeveloperProtectedRoute.tsx`
  - `frontend/src/api/developer/*`
  - `frontend/src/features/developer/hooks.ts`

## Verification
- **Backend check:** one small jest + supertest file, `backend/tests/developer.test.js`, covering:
  - `user` → 403 on `/api/developer/overview`
  - `developer` → 200
  - `superAdmin` → 200
  - `redact()` masks `password` / `authorization` / `sk_live_...`
  - `requestMetrics` percentiles on a known sample.
- **Manual end-to-end:**
  1. Run `npm run dev` (backend and frontend).
  2. Set a test user's role to `developer` in Mongo or from the admin users page.
  3. Log in and confirm the redirect to `/developer`.
  4. Open each Phase 1 page and check that it renders with real data.
  5. Confirm `/dashboard` (admin) is blocked for the developer.
  6. Confirm the admin UI looks unchanged.
- **Build checks:**
  - `npm run build` and `tsc` in the frontend, so the casing rename is verified.
  - a Linux Docker build: `docker-compose build frontend`.
