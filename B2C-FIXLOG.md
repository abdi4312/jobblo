# Jobblo B2C — Launch Fix Log

Running record of every fix made for the **B2C (customer-facing)** launch, target **24 Aug 2026**.
Newest first. One issue per entry, each tested before moving on.

Audit and full issue backlog: `C:\Users\aliha\.claude\plans\jobblo-b2c-launch-zazzy-bee.md`
Severity scale: **P0** launch blocker · **P1** critical · **P2** important · **P3** polish

| # | Issue | Severity | Status |
|---|---|---|---|
| 15 | Disputes, account deletion, support tickets, settings overwrites, dead code | P1–P3 | ✅ Done |
| 14 | Phase 2–4 sweep: auth redirects, statuses, crashes, security, consent, prod hardening | P0–P2 | ✅ Done |
| 13 | Job creation: map pinned jobs to the poster, edit corrupted jobs, draft wiped on failure | P1 | ✅ Done |
| 12 | Chat payment funnel dead; everyone routed as provider | P0 | ✅ Done |
| 11 | SafePay contract showed hardcoded date/duration/city, fake card, dead Vipps/Apple Pay | P0 | ✅ Done |
| 10 | `/Anmeldelser` served hardcoded fake customer reviews | P0 | ✅ Done |
| 9 | "Velg uten SafePay" faked hiring an applicant | P0 | ✅ Done |
| 8 | Notification endpoints had no ownership checks; test route unauthenticated | P0 | ✅ Done |
| 7 | Socket handlers had no authorization — any chat readable/writable | P0 | ✅ Done |
| 6 | `POST /api/reviews` had no eligibility check — anyone could 1-star anyone | P0 | ✅ Done |
| 5 | Payout failure reported to the customer as "money sent" | P0 | ✅ Done |
| 4 | Payment success page declared "Betaling bekreftet!" without verifying | P0 | ✅ Done |
| 3 | Legacy payout endpoint released funds without payment/state/dispute checks | P0 | ✅ Done |
| 2 | SafePay payment confirmation had no Stripe webhook | P0 | ✅ Done, needs deploy config |
| 1 | Dead routes, no error boundary, placeholder text | P0 | ✅ Done |

---

## Fix #15 — The rest of the backlog

**Severity:** P1–P3 · **Audit ref:** F-08, F-09, F-15, F-16, F-47, F-61, F-63 + message inventory

The three items I had previously declined to do unattended, plus the remaining P2/P3 cleanup.

### F-47 — Disputes were write-only

The backend was already complete and correctly guarded: `GET /contract/:orderId/dispute` and
`POST /disputes/:disputeId/message` are both routed, both check participation, and both strip
internal admin notes. **Neither was called from anywhere in the B2C frontend.** A customer who
escalated a payment problem got a toast and then nothing — no status, no thread, no way to add
evidence.

| File | Change |
|---|---|
| `frontend/src/features/disputes/hooks.ts` | **new** — `useDispute`; treats 404 as "no dispute", which is the ordinary answer, not a failure |
| `frontend/src/components/SafePay/DisputePanel.tsx` | **new** — status, reason, description, admin resolution, full message thread, and a reply box that closes when the dispute does |
| `frontend/src/constants/disputes.ts` | **new** — reason options **scoped by role**, status labels, active-status list mirroring the controller |
| `SafePayApproval.tsx` / `ProviderOrderDetailPage.tsx` | render the panel; hide "opprett en tvist" once one exists |

**Self-accusing reason lists.** Both sides offered the identical full list, so the customer could
file "Kunde samarbeider ikke" and the provider "Tilbyder samarbeider ikke" — each party able to open
a dispute accusing themselves. `disputeReasonOptions(role)` now returns only what that side can
legitimately claim.

**`revieweeRole` — deliberately NOT flipped.** The audit calls the values inverted, and they are:
`'poster'` is written when the *provider* is reviewed and `'seeker'` when the *customer* is. But
every write and the single live read (`CompletedJobPage`) agree with each other, so the labels users
see are correct — `reviewsAPI.ts`, the only thing that could filter by role, has no callers.
Flipping the values means migrating every existing Review document *and* changing three call sites
in one commit; getting it half-right inverts the labels in production. The inversion is now
documented on the model and at the write site so nobody fixes one half. **This is naming debt, not
a user-visible bug.**

### F-08 — Account deletion is now real

The button ran `toast.success('Kommer snart')`. The endpoint it should have called,
`DELETE /api/users/:id`, did `User.findByIdAndDelete` — a hard delete with **no checks at all**,
directly contradicting the comment on the model's own `isDeleted` field: *"Soft delete — admin
action only. Never hard-delete users with financial history."*

Two guards, then anonymisation:

1. **Refuses outright** (409, with a message that says what to do) when the user is party to an
   order in `awaiting_payment`, `paid`, `in_progress`, `ready_for_review` or `disputed`. Deleting
   there would orphan a contract mid-escrow and leave a pending Stripe payout with nowhere to go.
2. **Anonymises rather than drops the row.** Every personal field is overwritten, the password is
   replaced with random bytes, refresh tokens are emptied and all `Session` rows are deleted, so
   every existing login dies immediately. The e-mail becomes `slettet+<id>@jobblo.invalid` to stay
   unique without being identifying. Order and review rows survive for bookkeeping — Norwegian
   bokføringslov requires transaction records to be retained, so a hard delete would have been
   legally wrong as well as technically unsafe.

The UI now requires typing **SLETT**, calls the endpoint, then logs out and clears the query cache.

### F-09 — Support tickets land somewhere

New `SupportTicket` model, `supportController` and `POST /api/support/tickets`
(+ `GET /tickets/mine`). `createTicket` is deliberately unauthenticated — someone who cannot log in
is the person most likely to need support — but it prefers the account's own e-mail when the caller
is signed in, and requires one from visitors. The form now posts there instead of reporting success
for an operation that never happened. Also removed "Gjennomsnittlig svartid: 2–4 timer", a number
nothing measures.

### F-15 — Settings no longer overwrite fields you didn't touch

Every save POSTed all 21 fields, so editing your bio re-submitted email, phone, address and
orgNumber — anything stale in that tab silently overwrote the server's newer value
(last-write-wins across tabs and devices). `handleUpdate` now diffs against the loaded user and
sends only what changed, and says "Ingen endringer å lagre" when nothing did.

Also deleted the five payout fields (`payoutMethod`, `bankAccountNumber`, `iban`, `bicSwift`,
`vippsHandle`) from the payload. No settings view edits them, the backend strips them from
`allowedUpdates`, and real payouts go through Stripe Connect — they were pure dead payload.

### F-61 — Third-party placeholder assets

New `constants/assets.ts` with inline-SVG data URIs. The default avatar was an
`api.builder.io/.../TEMP/...` URL — a design-tool CDN serving a placeholder that was never meant to
ship — used in **six** places as a hard production dependency for anyone without a profile picture.
Same for the Unsplash banner default (2 places), the Stripe logo hotlinked from Wikimedia on the
checkout screen, and the send sound hotlinked from mixkit while every other sound was bundled.

Not touched: `src/data/banners.ts`, which is live on the homepage promo carousel. Replacing those
images is a content decision, not a fix.

### F-16 — Typecheck in CI

New `.github/workflows/frontend-checks.yml`. `continue-on-error: true` is deliberate — the audit
says not to chase the ~346-error backlog before launch. It writes the count and first 50 errors to
the job summary, so the number stops growing unnoticed without blocking merges. Remove the flag once
the backlog is cleared.

### Message inventory

`useAuth` now routes all seven error handlers through `getErrorMessage`, which also fixes a latent
F-04: `err.response?.data?.error` would have handed the object-shaped envelope straight to
`toast.error`. Translated the remaining English session toasts and the payment-failure string, and
removed a `console.log` of the login error message.

### Verification

- Backend suite **179 passed, 9 failed** — the same pre-existing `chatReport.test.js` failures.
  New modules load; every edited file passes `node --check`.
- Frontend typecheck **349 → 346**, diffed as error sets. Three errors I introduced were caught and
  fixed: `never[]` inference on the settings form, and two duplicated reads of `orgType`/`locations`/
  `website` — fields that exist on the backend model but were missing from the `User` type, which is
  why reading them was an error in the first place.
- ESLint clean on all new files (the hook was split into `features/disputes/hooks.ts` so
  `DisputePanel.tsx` only exports a component).

### Not done — needs you to run it

**F-63 (dead code).** I verified by exact import path that these are unreferenced, transitively —
`pages/index.ts` and `components/profile/index.ts` are barrels nothing imports, and
`ProfileSettingsPage` is not routed:

```
frontend/src/components/notifications/NotificationItem.tsx
frontend/src/api/userAPI.ts
frontend/src/api/reviewsAPI.ts
frontend/src/features/auth/hook/useLogin.ts
frontend/src/features/auth/hook/useRegister.ts
frontend/src/components/chat/ConversationView.tsx
frontend/src/components/chat/ChatView.tsx
frontend/src/pages/MessagesPage/MessagesPage.tsx
frontend/src/pages/EditJobPage.tsx
frontend/src/pages/ProfileSettingsPage.tsx
frontend/src/pages/index.ts
frontend/src/components/profile/index.ts
frontend/src/components/profile/ProfileSettings/
frontend/src/components/profile/ProfileMenuSection/
```

The `git rm` was blocked by a safety classifier — removing 14 source paths in one command is exactly
the kind of thing that should get a human look. Run it yourself and re-run the typecheck; the count
should drop, not rise. `ProfileSettings` is the one worth removing: it renders hardcoded fake PII
(`olanormannen@theman.com`, `645 23 452`).

### New deploy configuration

Nothing new beyond Fix #14. The `SupportTicket` collection is created on first write.

### Still to test manually

1. Open a dispute as a customer → the panel appears with status and your description; post a
   message and confirm it shows as "Deg".
2. Open the same order as the provider → same panel, and the reason dropdown must **not** offer
   "Tilbyder samarbeider ikke".
3. Try deleting an account that has a paid, in-progress order → refused with the 409 explanation.
4. Delete an account with no live orders → logged out, and logging back in with the old password
   must fail.
5. Send a support ticket logged out (e-mail field required) and logged in (no e-mail field).
6. Change only your bio in Settings → the request body should contain **only** `bio`.

---

## Fix #14 — Phase 2–4 sweep

**Severity:** P0–P2 · **Audit ref:** F-01, F-04, F-06, F-07, F-08, F-09, F-10, F-13, F-14, F-18,
F-19, F-20, F-21, F-22, F-39, F-40, F-41, F-43, F-44, F-45, F-46, F-48, F-49, F-54, F-55, F-56,
F-57, F-58, F-59, F-60, F-62

Everything left in the launch plan except the items listed under **Deliberately not done** at the
end. 47 files changed, +702/−416, plus 3 new backend files and 6 new frontend ones.

### Auth & navigation

| Ref | What was wrong | Fix |
|---|---|---|
| F-06 | `ProtectedRoute`'s modal called `navigate(-1)` on cancel. On a cold deep link there is no history entry, so the user sat on a page with only a header and footer and no way out. | Replaced the modal with `<Navigate to="/login" state={{ from }} replace />`. |
| F-07 | `ProtectedRoute` wrote `state.from` and **nothing read it**; `useAuth` hardcoded `/home`. Anyone following a shared job, notification or checkout link lost their destination. | `redirectAfterAuth()` in `useAuth`, also honoured by `PublicRoute`. Only same-origin paths are accepted, so a crafted state can't redirect off-site. |
| F-13 | `/subscription/success` navigated to `/dashboard`; `AdminProtectedRoute` bounced every ordinary user to `/profile`, or `/login` if auth was lost during the Stripe round-trip. The paid funnel ended in a redirect bounce. | Now `/membership`. Page translated. |
| F-20 | The OAuth JWT stayed in the URL, so it persisted in history and `document.referrer`. Vipps/Google `?error=` redirects were never read — a failed login landed on a blank form. | `history.replaceState` scrubs the token (cookies are already set by the same handler); `?error=` now shows the failure state. |

### Status vocabulary (F-41)

New `src/constants/statuses.ts`. The three checks that leaked to users:

- `JobListingDetailPage` — `CLOSED_STATUSES` omitted `awaiting_payment`, `paid` and
  `waiting_for_approval`, all written by the backend. Those jobs kept an enabled "Send forespørsel"
  and printed the raw string `awaiting_payment` as the status chip. Fixed, plus `statusLabel()` as
  the fallback so no snake_case can reach the UI.
- `applicantController.activeOrder` — omitted `ready_for_review` and `disputed`, so the moment a
  provider marked work ready the applicants page re-armed "Velg og start SafePay" for every
  applicant; clicking gave `400 Kontrakt finnes allerede` with no way forward.
- `features/services/types.ts` — `ready_for_review` was missing from the `Service['status']` union.

### Applicants & fees

- **F-44** — `hasRequested` had no status filter while the backend only blocks re-application while
  a request is `pending`. Applicants mass-declined when someone else won stayed permanently stuck on
  a disabled "Forespørsel sendt", with no notification. Now filtered to `pending`, and a declined
  applicant gets an explicit "Forespørselen din ble ikke valgt denne gangen. Du kan søke på nytt."
- The apply cooldown was computed from **all** of `/orders/requests/my`, which returns received
  requests too — so a job poster saw a bogus "Åpner for deg om 4:32" on unrelated jobs. Now only
  requests the user sent, and the timer is cleared when it expires (it was only ever set).
- **F-43** — `Math.round(price * 0.97)` vs the backend's `price - Math.round(price * 0.03)`. At
  350 kr the sidebar printed 350 / 11 / 340 — three numbers that don't add up — while the provider
  got 339. New `utils/safePayFee.ts` mirrors the backend exactly.
- **F-48** — `isSafePayUser: true`, `isFastResponder: true` and `responseTime: '< 1t'` were
  hardcoded for every applicant and rendered to the poster as fact. Removed; `completedJobs`,
  `responseRate`, `rating` and `reviewCount` are real and stay.

### Crashes and silent failures

- **F-45** — guarded `job.location.city` and `job.duration.value` in `MineAnnonser` (one bad job
  killed the entire listing grid), `order.customerId.name[0]` / `providerId.name[0]` in
  `SafePayCheckout` (`providerId` is not `required` on the model), and `CompletedJobPage`'s
  `if (!data) return null` — a blank white page whenever the Service had been deleted. The `/home`
  browse grid now distinguishes a failed fetch from "no jobs"; it rendered `null` for both.
- **F-55** — `useChatSocket` registered three listeners and never removed them. The socket is a
  module-level singleton, so after N conversation opens one inbound message ran the handler N times,
  each firing two `invalidateQueries` — 2N duplicate refetches on the busiest screen in the app.
- **F-56** — a failed message send produced nothing: no toast, no retry, no failed state. (The input
  is only cleared on success, so the text itself was never lost.)
- **F-57** — `Alert.tsx`'s delete handlers awaited with no catch, so on failure the promise rejected
  unhandled and **the confirm dialog never closed**. Four of eight favourite-list mutations had no
  `onError` at all; all eight now share one handler.
- **F-54** — "Se" sent *everyone* to `/provider/orders/:id`, so a customer told "Din forespørsel er
  godkjent" landed on the provider's work page, and a deleted order produced
  `/provider/orders/null`. New `utils/orderRoute.ts`; it also marks the notification read, which it
  never did.

### Fake controls removed (F-58)

Hardcoded `4.9 ★ · 38 oppdrag` in the chat header (shown for every user) · "Archive this thread" ·
the paperclip and image buttons in the live composer · `alert('Invoice download coming soon!')` on a
completed paid job · the "Søk i samtaler..." box with no `value`, `onChange` or consumer · the
search-engine visibility checkbox with no state and no API — a privacy promise that did nothing.

### Backend security

| Ref | Fix |
|---|---|
| F-19 | `origin: true` reflected **any** origin while sending credentials, so any website could make authenticated calls for a logged-in user. Now an allowlist from `ALLOWED_ORIGINS`/`FRONTEND_URL` (localhost still allowed in dev). Added `app.set('trust proxy')` — without it every request behind a load balancer shares one IP, so `authLimiter`'s 10/hour became **10 logins per hour for the entire user base**. Session cookie now `secure`+`httpOnly` in production, with its own `SESSION_SECRET` instead of reusing `JWT_SECRET`. |
| F-39 | `updateService` ended with `Object.assign(service, otherFields)` carrying `status`, `userId`, `promoted`, `urgent` and `views` — free promotion, re-opening a job that already had a paid contract, or reassigning the listing. Replaced with a whitelist; `urgent` now re-checks the subscription on update as it already did on create. |
| F-40 | `multer({ storage })` had no `limits` and no `fileFilter`; the 2 MB cap was client-only, and `multer-storage-cloudinary` uploads *before* the controller runs. Added 8 MB / 6 files / MIME allowlist, and a translating error handler (a too-large file used to become a bare 500). `upload.array('images', 5)` also disagreed with the UI's "inntil 6 bilder" — a 6th file produced an unhandled error. |
| F-46 | Review photos are posted base64 inside JSON against `express.json()`'s default **100 KB** limit, so every real phone photo died in the body parser. Raised to 12 MB. |
| F-14 | New `utils/mongoErrors.js`. `updateUser` returned `err.message`, so changing your e-mail to one in use surfaced `E11000 duplicate key error collection: jobblo.users index: email_1 dup key: { email: "x@y.no" }` in a toast — leaking schema internals and confirming which addresses are registered. |
| F-18 | The backend checked length ≥ 8 only, while the client required upper+lower+digit — so any non-browser client could create `aaaaaaaa` accounts. `validatePasswordStrength` now enforces it at all three sites and reports the actual reason. |
| F-49 | Removed 13 `console.log` calls that dumped whole applicant, review and user documents — names, e-mails, ids — into container logs on every contract creation and every review. |
| F-59 | Swagger UI was mounted unauthenticated in production; now dev-only unless `ENABLE_API_DOCS=true`. `logger('dev')` no longer runs in production. |

### Consent, config and production build

- **F-10** — the banner was entirely in English on a Norwegian-first product, had **no reject
  option** (only "Accept" and a "Customise" that silently accepted), and linked to `/cookie-policy`,
  which is not a route. Rewritten in Norwegian with a real "Bare nødvendige". More importantly,
  `index.html` loaded **Google AdSense unconditionally, before any consent** — consent after the
  fact under GDPR/ePrivacy. New `utils/cookieConsent.ts` injects it only after an explicit accept,
  gated on `VITE_ADSENSE_CLIENT`.
- **F-01/F-60** — new `src/config/env.ts` is the single source for the API URL. A production build
  without `VITE_MAIN_URL` used to bake in `http://localhost:5000`, so every request was blocked as
  mixed content with no diagnostic; callers with no fallback produced literal
  `undefined/api/auth/google`. New `scripts/check-env.mjs` **fails the build** when it's missing
  (wired into `npm run build`), with a same-origin runtime fallback as a net. Socket transports now
  include `polling` — `['websocket']` alone meant corporate proxies got no real-time at all, and
  `reconnectionAttempts: Infinity` retried forever.
- **F-59** — `<ReactQueryDevtools>` shipped to production unguarded, letting any visitor inspect the
  whole query cache (profile, orders, chats). Now `import.meta.env.DEV`. Added
  `esbuild.drop: ['console','debugger']` for production — 105 console statements shipped, including
  `ChatWindow` logging the entire chat object on every render.
- **F-21** — the logout the UI actually calls never cleared the React Query cache, so on a shared
  browser the previous user's profile and chats stayed rendered. `disconnectSocket()` also sat
  *after* the awaited network call, so an offline or 500 logout left the socket connected as the old
  user.
- **F-22/F-62** — `lang="en"` → `nb`, added `viewport-fit=cover`, removed the duplicate Leaflet CSS
  CDN link (already imported from npm, and a third-party hard render dependency), fixed the
  unconditional `px-12` on `Categories`/`TrustBar` (96px of padding on a 360px phone), and replaced
  the native `alert()` calls — worst was `alert('Notification error: ' + JSON.stringify(err))`.

### Honest instead of fake (F-08, F-09)

Neither could be *implemented* unattended; both were made truthful.

- **F-08** — "Slett profil" ran `toast.success('Kommer snart')`: a green success toast, on a page
  promising irreversible deletion, for a GDPR Art. 17 right. `DELETE /api/users/:id` exists, but
  self-serve erasure needs a confirmation flow and a decision about live orders and escrowed funds.
  The page now says deletion is handled by support and sends the request there.
- **F-09** — the support form called nothing and then said "Saken din er sendt". There is no
  ticket endpoint, but `support@jobblo.no` is real, so the form now hands the message to the user's
  mail client and only claims that. Removed the "Live Chat" that toasted "kommer snart" and the
  placeholder phone number `+47 123 45 678`.

### Verification

- New tests: `serviceUpdateWhitelist.test.js` (5) and `mongoErrors.test.js` (7). Full backend suite
  **179 passed, 9 failed** — the same pre-existing `chatReport.test.js` failures as every previous
  fix.
- Frontend typecheck **353 → 349**, verified by diffing sorted error *sets* at four checkpoints. The
  three errors I introduced along the way (unused imports left by deletions) were caught and fixed;
  everything else is line-shift.
- ESLint clean on all new and rewritten files.

### Deliberately not done

- **F-16** (379 type errors) and **F-17** (B2C i18n) — the audit explicitly rules both out before
  launch. Strings were translated in place where touched.
- **F-47** (disputes are write-only) — needs a status view, a message thread and evidence upload.
  Feature work, not a fix.
- **F-63** (dead duplicate chat implementations) and **F-61** (builder.io placeholder assets) — P3,
  and touching them risks more than it fixes this close to launch.
- **F-15** (settings posts all 21 fields) — P2 cleanup; the fields it drops are dead payload, not
  lost bank details (payouts go through Stripe Connect).

### New deploy configuration required

`ALLOWED_ORIGINS` (or `FRONTEND_URL`) — **without this, production browser requests are refused.**
Optional: `SESSION_SECRET`, `TRUST_PROXY`, `ENABLE_API_DOCS`, `VITE_ADSENSE_CLIENT`.
`npm run build` now fails without `VITE_MAIN_URL` and `VITE_GOOGLE_MAPS_API_KEY`.

### Still to test manually

1. Open a protected page in a fresh tab while logged out → redirected to login, and after logging in
   you land on **that page**, not `/home`.
2. Log in as a job poster, open a notification about an order → your checkout/approval page, not the
   provider work page.
3. Open five conversations, then receive a message → the chat should refetch **once**, not five times.
4. First visit → Norwegian cookie banner with "Bare nødvendige"; choose it and confirm no AdSense
   script is in the Network tab.
5. Log out on a shared browser, log in as someone else → no trace of the first user's data.
6. Deploy check: set `ALLOWED_ORIGINS` and confirm the app can still talk to the API.

---

## Fix #13 — Job creation correctness: location, validation, drafts, edit mode, error messages

**Severity:** P1 · **Flow:** Legg ut oppdrag (create + both edit entry points)
**Audit ref:** F-42, F-11, F-12

### Re-verified against current code first

Two of the audit's claims had already been fixed and are **not** part of this change:

- F-11's "publishes silently pinned to Oslo" — `useCreateJobForm.validateStep(2)` already blocked on
  `!coordinates` (line 523), and `StepIndicator` only allows jumping *backwards*
  (`isClickable = stepNumber <= currentStep`), so step 4 is unreachable without a pin. The Oslo fallback was
  still in the payload, though, and is reachable one way: `loadFormData()` restores `currentStep` from
  IndexedDB, so a draft saved at step 4 *before* that rule existed restores past the check.
- F-42's "step 4 is a required step whose data is thrown away" — the step is labelled
  **"Kontaktinformasjon (Valgfritt)"** and `jobValidationSchema` has no `phone` rule at all. Nobody is forced
  through it. The data was still being discarded, which is the part that needed fixing.

Everything else in F-42 reproduced exactly as described.

### The problems

**1. The map pinned every job to wherever the poster was sitting.**
`LocationPickerMap.tsx:75-78` called `getCurrentLocation({ pan: true })` in a mount effect. That ran
`setLocation` → `onCoordinatesChange` → `TimeAndPlace.handleCoordinatesChange` → `setLocationConfirmed(true)`,
plus a reverse-geocode that overwrote the city. Posting a job for a flat in Trondheim from your sofa in Oslo
produced Oslo coordinates, "Oslo" as the city, and a green **"bekreftet"** badge — without a single click.
It also published the poster's **home coordinates** on a public listing.

**2. Fylke and Kommune were marked required but never validated.** Both carry a red `*` in
`TimeAndPlace.tsx:136,163`, and neither was checked anywhere. A job saved without them never matches
`getAllServices`' location filter, so it is invisible to everyone searching that area.

**3. Everything typed in the contact step was dropped.** The form sent `phone` and `email`;
`models/Service.js` had neither path, so Mongoose strict mode discarded both on every save.

**4. A failed publish destroyed the user's work.** `LeggUtOppdrag.handleFormSubmit` caught the error,
toasted, and did **not** re-throw — so `await onSubmit(formData)` resolved normally and
`handleFinalSubmit` ran `clearFormData()`. A 500 or a dropped connection wiped the entire IndexedDB draft.
The code comment ("Clear the draft only after a successful POST") described the opposite of the behaviour.

**5. Editing a job corrupted it.** Both entry points built `initialData` with fields missing:

| Missing | Consequence |
|---|---|
| `paymentType`, `hourlyRate` *(MineAnnonser)* | a **Timepris** job silently reopened as **Fastpris** with the rate blanked |
| `latitude`/`longitude` *(both)* | coordinates started null → step 2 blocked → the map auto-located → **the job moved to the editor's position** |
| `countyCode`/`municipalityCode`/`areaCode` *(both)* | location codes cleared on save → job disappeared from area search |
| `maxApplicants` *(both)* | reset to 0 |
| `categories` | `MineAnnonser` did `.join(', ')` → `["Hage","Maling"]` became one category `"Hage, Maling"`; `LeggUtOppdrag` took `[0]` and dropped the rest |

**6. Every publish failure said the same thing.** `toast.error('Det oppstod en feil ved sending av
oppdraget. Prøv igjen.')` for 400, 403, 413 and 500 alike, so nothing was actionable and users just retried.

### What changed

| File | Change |
|---|---|
| `frontend/src/utils/getErrorMessage.ts` | **new** — normalises both backend error shapes (legacy `{error:'text'}` and the `{error:{code,message}}` envelope) into one Norwegian string, with status-specific fallbacks |
| `frontend/src/components/CreateJobForm/LocationPickerMap.tsx` | removed the auto-geolocate mount effect; the "Bruk min nåværende posisjon" button is unchanged |
| `frontend/src/components/CreateJobForm/TimeAndPlace.tsx` | reverse-geocode no longer overwrites `city` when a kommune is selected (that field is locked to the kommune name) |
| `frontend/src/hooks/useCreateJobForm.ts` | require fylke + kommune in `validateStep(2)` and name them in the toast; hard coordinates guard in `handleFinalSubmit` that returns the user to step 2; removed the Oslo fallbacks; send `contactPhone`/`contactEmail`; only clear the draft when `!isEditMode`; use `getErrorMessage`; dropped the bogus "telefon mangler" from the step-4 message |
| `frontend/src/components/CreateJobForm/CreateJobForm.tsx` | widened its duplicate `InitialData` interface so the new fields aren't rejected as excess properties |
| `frontend/src/pages/LeggUtOppdragPage/LeggUtOppdrag.tsx` | re-throws on failure (preserving the draft) and drops its duplicate toast; passes coordinates, location codes, all categories, `hourlyRate`, `maxApplicants` |
| `frontend/src/pages/MyJobsPage/MineAnnonser.tsx` | same `initialData` completion incl. `paymentType`; `mutateAsync` so a failed save actually rejects |
| `frontend/src/features/{services,jobDetail}/types.ts` | declared the fields the edit forms read |
| `backend/models/Service.js` | added `contactPhone`/`contactEmail` with **`select: false`** |
| `backend/controllers/serviceController.js` | `pickContactUpdates()` helper; `getMyPostedServices` opts into the contact fields |

### Judgment calls

**Contact fields are `select: false`, not plain fields.** The job listing is served to unauthenticated
visitors (`GET /api/services/:id` has no `authenticate`), so storing the poster's phone number as an ordinary
path would have published it to every anonymous visitor — trading a data-loss bug for a PII-leak bug.
`select: false` keeps them out of every read by default; the owner-scoped `/api/services/my-posted` opts back
in explicitly. That needed no new middleware and no endpoint sweep.

**Blank contact values are ignored on update.** There are two edit entry points, and `/Publish-job/:id` reads
the *public* endpoint, which will never return these fields — so it always submits empty strings. Assigning
those would erase a saved phone number just because the user edited from a screen that couldn't see it.
`pickContactUpdates` trims and drops blanks, so an empty field is a no-op.

**Auto-geolocation was removed, not made smarter.** The map is the *confirmation* step for where the job
happens. Prefilling it with the poster's position is wrong by default and defeats the purpose of asking.

### Verification
- New `backend/__tests__/serviceContactFields.test.js` — **5 tests, all passing**: fields persist, both are
  `select: false`, the old `phone`/`email` names are still dropped, a blank update does not erase a saved
  value, and a real value still applies.
- Full backend suite: **167 passed, 9 failed** — the same pre-existing `chatReport.test.js` failures as every
  previous fix (162 + my 5 new).
- Frontend typecheck: **354 → 353**, verified by diffing the sorted error *sets* across a `git stash`. All 11
  apparent "new" errors are pre-existing ones at shifted line numbers; the one real change is
  `useCreateJobForm.ts(98,18) maxApplicants does not exist on InitialData`, now fixed.
- ESLint on all changed files: no new violations (`getErrorMessage.ts` and `LocationPickerMap.tsx` clean).

### Still to test manually
1. **Create a job from a different city than you are in.** The map must open *empty* with "Klikk på kartet for
   å sette lokasjon" — no pin, no green badge, no city auto-filled.
2. Try "Neste" on step 2 without a fylke/kommune → toast must name them.
3. **Edit a Timepris job from "Mine annonser"** → payment type stays Timepris, hourly rate intact, all
   categories still separate, map still on the original location.
4. **Fail a publish on purpose** (offline, or stop the backend) → the error must be specific, and reloading
   `/Publish-job` must restore the draft.
5. Enter a phone/e-mail in step 4, publish, then reopen from "Mine annonser" → both should come back.
6. Confirm `GET /api/services/:id` as a logged-out visitor does **not** contain `contactPhone`/`contactEmail`.

### Known follow-ups (not touched)
- `/Publish-job/:id` cannot prefill the contact fields (public endpoint). Harmless today because blanks are
  ignored, but it also means the form cannot *clear* a saved value. Fixing properly needs optional auth on
  `getServiceById`, which does not exist in the codebase yet.
- `previewJobData` still falls back to Oslo coordinates for the preview map. Display-only, and the publish
  guard now stops that value ever being saved.
- `usePaymentCalculation` only understands `hours`/`days`/`minutes`; `Service.duration.unit` also allows the
  Norwegian `timer`/`dager`/`minutter`. The UI select only offers the English values, but an AI-filled or
  legacy job with a Norwegian unit will not auto-recalculate its Timepris total. Pre-existing (F-41 family).
- `updateService`'s mass-assignment (`Object.assign(service, otherFields)`) is untouched — that is F-39.

---

## Fix #12 — Chat payment funnel restored; viewers no longer all routed as provider

**Severity:** P0 · **Flow:** Chat → create contract → payment; any order link opened from chat
**Audit ref:** F-52

### The problem
`ChatWindow.tsx:169` decided the viewer's role with:
```ts
const isServiceOwner = activeChat?.serviceId?.userId === userId;
```
Every chat-fetching populate in `chatController.js` (lines 35, 59, 79, 99, 328, 375) used the projection
`'title description images price categories'` — **`userId` was not selected**. So `serviceId.userId` was
always `undefined` and `isServiceOwner` was permanently `false`. Two consequences:

- `ChatWindow.tsx:353` `{isServiceOwner && isChatReady && (...)}` never rendered — the customer **never saw
  "Opprett kontrakt" or "Start fiks ferdig-betaling"**. The entire in-chat purchase funnel was unreachable.
- `navigateToOrder` derives `const viewerIsProvider = !isServiceOwner`, which was therefore always `true`, so
  **every** user opening an order from chat — customers included — was sent to `/provider/orders/:id`, a page
  they do not own.

### What changed
| File | Change |
|---|---|
| `backend/controllers/chatController.js` | added `userId` to all six `serviceId` populate projections (lines 195/264 already used a full populate) |
| `frontend/src/components/messagelist/ChatWindow.tsx` | `String()`-coerced comparison guarded against a missing id, so an ObjectId/string mismatch can't silently reintroduce the bug |

### Why `serviceId.userId` and not `Chat.clientId`
`Chat.clientId` is whoever *initiated* the chat (`chatController.js:29,49` — it is `req.userId`). Today the
only caller is `ApplicantsPage.handleStartChat`, i.e. the poster, so `clientId` happens to equal the service
owner — but that is incidental. If an applicant ever gets a "message the poster" button, `clientId` inverts.
`serviceId.userId` is the job's actual owner and is correct either way, so the populate was the right fix
rather than switching the source.

### Verification
- Backend modules load; frontend typecheck **354, zero new errors**.

### Still to test manually
1. As the **job poster**, open the chat with an applicant → "Opprett kontrakt" / "Start fiks ferdig-betaling"
   is now visible (it never was).
2. As the poster, click through to the order → lands on `/safepay/checkout/:id` (or `/safepay/approval/:id`
   when already paid), **not** `/provider/orders/:id`.
3. As the **applicant**, the same chat → still routes to `/provider/orders/:id`, and the customer-only action
   bar stays hidden.

---

## Fix #11 — SafePay contract and payment panel show only real data

**Severity:** P0 (legal / trust) · **Flow:** SafePay checkout
**Audit ref:** F-38

### The problem
The panel headed *"Digital kontrakt — generert automatisk"*, with the footnote *"Den er juridisk bindende og
beskytter deg ved eventuell tvist"*, printed:
- `Dato: Lørdag 24. mai 2026` — hardcoded
- `Estimert tid: Ca. 2 timer` — hardcoded
- `Sted: … || 'Frogner, Oslo'` — a hardcoded fallback city

Directly below, the payment panel showed a saved **`Visa •••• 4242 / Utløper 09/28`** — a Stripe test card
presented as the user's own — plus **Vipps** and **Apple Pay** options that only set local React state.
`createSafePaySession` is unconditionally `payment_method_types: ['card']`, so choosing Vipps silently charged
a card. The provider's rating also fell back to a fabricated `4.9` for anyone with no reviews.
`ApplicantsPage.tsx:194` carried the same hardcoded `Ca. 2 timer`.

### What changed
| File | Change |
|---|---|
| `backend/controllers/SafePayCheckoutController.js` | `getCheckoutDetails` populate now selects `fromDate toDate duration` (the comment said "duration hidden for now" — that is why the UI invented it) |
| `backend/controllers/applicantController.js` | `duration` added to the `service` payload |
| `frontend/src/utils/timeFormatter.ts` | new `toJobDuration({value, unit})` → Norwegian text, or `null` so callers omit the row. Handles the model's mixed English/Norwegian unit enum. Shared by both pages rather than duplicating a label map |
| `frontend/src/pages/SafePayPage/SafePayCheckout.tsx` | Sted / Dato / Estimert tid now render real order data and are **omitted entirely when absent**; date via the existing Norwegian `dateFormatter`, with a range when `toDate` differs. Fake card and the two non-functional payment options replaced by an honest "Kort — du fullfører betalingen sikkert hos Stripe i neste steg". Rating shows the real value or "Ingen vurderinger ennå". Removed the now-unused `paymentMethod` state, `Apple` and `useState` imports |
| `frontend/src/pages/ApplicantsPage/ApplicantsPage.tsx` | real duration, row hidden when the job has none |

Vipps/Apple Pay should be re-added here **only** once the backend forwards the chosen method to Stripe.

### Verification
- Frontend typecheck **354, zero new errors**; no new lint violations.

### Still to test manually
1. Job created **with** dates and a duration → checkout shows those exact values.
2. Job created **without** them → those rows are absent (no invented values, no empty rows).
3. Job spanning two dates → shown as a range.
4. Provider with no reviews → "Ingen vurderinger ennå", not "4.9".
5. Payment panel offers card only, and "Bekreft og betal" still reaches Stripe Checkout.

---

## Fix #10 — Removed the fake reviews page

**Severity:** P0 (trust) · **Flow:** `/Anmeldelser`
**Audit ref:** F-36

### The problem
`AnmeldelserPage.tsx` made **no API call at all**. It rendered two invented reviews — *"Illyas — Veldig stort
og fin vegg, jeg er sjalu"*, *"Dulahi — Knuste den benken og fikk pengene"*, both dated `04.01.2002`, with
`https://via.placeholder.com/40` avatars — plus a hardcoded 4.5 average and a review count of 2, presented to
every visitor as their own reviews. The route was **public**, with no guard.

### What I verified
The only link to `/Anmeldelser` is `ProfileMenuSection.tsx:38`, which is **dead code** (reachable only via the
unused `components/profile/index.ts` barrel; nothing renders that component). So the route was orphaned —
unreachable through the UI but live by direct URL and indexable by search engines.

### What changed — route removed, not wired
| File | Change |
|---|---|
| `frontend/src/routing/Routes.tsx` | route registration and the lazy import removed, with a note explaining why |
| `frontend/src/pages/AnmeldelserPage/AnmeldelserPage.tsx` | prominent header warning that it renders fake data and must not be re-enabled as-is |

Wiring it to real data was the alternative, but nothing links to it, and doing it properly needs the
received/given split from `GET /api/users/:userId/reviews`, loading/empty/error states, **and** converting it
to a `ProtectedRoute` (it shows the signed-in user's own reviews, so it cannot stay public). That is a feature
build, not a launch fix. The file is kept so the layout work isn't lost.

### Verification
- Frontend typecheck **354, zero new errors** (`AnmeldelserPage` is simply no longer in the build graph).

---

## Fix #9 — Removed "Velg uten SafePay"

**Severity:** P0 · **Flow:** Choosing an applicant
**Audit ref:** F-35

### The problem
`ApplicantsPage.tsx:463-471` rendered a button whose entire handler was:
```tsx
onClick={() => { toast.success('Bruker valgt uten SafePay'); }}
```
No API call. No contract created, no applicant selected, nobody notified — while the poster saw a green
success toast and believed they had hired someone. The applicant was never contacted.

### What changed
`frontend/src/pages/ApplicantsPage/ApplicantsPage.tsx` — button removed, with a comment recording why.
Hiring outside escrow is not an implemented flow, so there was nothing to wire it to; "Velg og start SafePay"
and "Send melding" are untouched. `toast` is still used elsewhere in the file, so the import stays.

### Verification
- Repo-wide search for "uten SafePay" returns only the explanatory comment.
- Frontend typecheck **354, zero new errors**.

---

## Fix #8 — Notification ownership checks + closed the unauthenticated test route

**Severity:** P0 (security) · **Flow:** Notifications / alerts
**Audit ref:** F-53

### The problem
- `markAsRead` (`notificationController.js`) did `findById` then `findByIdAndUpdate` with **no comparison
  between the notification's owner and the caller** — any authenticated user could mark any other user's
  notification read.
- `deleteNotification` did `findByIdAndDelete(id)` with **no ownership check at all** — any authenticated
  user could delete any other user's notifications.
- `POST /api/notifications/test` (`routes/notifications.js:200`) had **no `authenticate`**, unlike every other
  route in the file, and took the recipient from the request body. Anyone on the internet could inject
  arbitrary notifications into any user's tray — a ready-made phishing surface inside Jobblo's own UI.

### What changed
| File | Change |
|---|---|
| `backend/controllers/notificationController.js` | `markAsRead`: 403 unless the caller owns the notification (system broadcasts, `userId: null`, still allowed — they are addressed to everyone) |
| | `deleteNotification`: fetch first, then 403 unless the caller owns it; system broadcasts refused outright |
| | `createTestNotification`: recipient is now `req.userId`; the body `userId` is ignored |
| `backend/routes/notifications.js` | added `authenticate` to `POST /test` |

**System broadcasts deliberately treated separately.** They are a live admin feature
(`createSystemNotification` → `userId: null, isSystem: true`, shown in every user's list). Marking one read
stays allowed; **deleting** one is now refused, because it is a single shared document and one user deleting
it would remove the announcement for everybody.

### Verification
- `backend/__tests__/notificationOwnership.test.js` added — 7 assertions, all passing: cross-user mark refused,
  own mark allowed, system mark still allowed, cross-user delete refused, system delete refused, own delete
  works, and the test endpoint can only ever target the caller.
- No frontend caller of `/api/notifications/test` exists, so adding auth breaks nothing.

### Known follow-ups in this area (deliberately not fixed here — correctness, not ownership)
- Marking a **system** notification read still flips the shared `read` flag for every user. The model already
  has a `readBy` array intended for per-user state; nothing writes or reads it. Fixing this properly also
  needs `getNotifications` / `getUnreadCount` to compute per-user read state.
- There is no per-user dismissal of system broadcasts (would need a `deletedFor` array), which is why delete
  is refused rather than scoped.
- `markAllAsRead` skips system notifications entirely, so "Marker alle som lest" can leave a non-empty list.

---

## Fix #7 — Socket handlers now authorize every chat event

**Severity:** P0 (privacy) · **Flow:** Chat / messaging, and the order + payment event stream
**Audit ref:** F-50

### The problem

The Socket.IO **handshake** is properly authenticated (`chat.socket.js:7-40` — cookie JWT plus a DB session
check). Every event handler after it was not:

| Handler | Hole |
|---|---|
| `join-chat` | `socket.join(\`chat-${chatId}\`)` with **no membership check** — any authenticated user who knew or guessed a chat id received every `receive-message` broadcast in that conversation |
| `send-message` | loaded the chat and pushed a message with **no participant check** — any authenticated user could inject messages into any conversation |
| `setup` | joined a room named by a **client-supplied** userId and registered that id in `onlineUsers` — join another user's private room, fake their presence |
| `mark-as-read` | took `userId` from the **client payload** — spoofable read receipts |
| `server.js` `join` | `socket.join(\`user_${userId}\`)` from a **client-supplied** id. This is the worst one: `orderController`, `providerWorkController` and `SafePayCheckoutController` all emit order and payment events to `user_<id>`, so an attacker emitting `join` with a victim's id received their entire order and payment stream |

### What changed
| File | Change |
|---|---|
| `backend/sockets/chat.socket.js` | added a shared `isChatParticipant(chat, userId)` helper (participants are `clientId` / `providerId`); applied it to `join-chat`, `send-message` and `mark-as-read`; `setup` and `mark-as-read` now use `socket.userId` and ignore client payloads. Refused joins/sends emit a `chat-error` event. |
| `backend/server.js` | `join` now uses `socket.userId` and ignores the payload. Safe because `chatSocket(io)` registers its `io.use()` handshake middleware before this handler, and `io.use` applies to every connection on the instance. |

**Backward compatible:** all five frontend emitters still send their old payloads
(`useChatSocket.ts:22,25,26,37`, `Header.tsx:78,81`, `notifications/hooks.ts:39,66`); the extra fields are now
simply ignored. Admin chat viewing goes over HTTP, not sockets, so it is unaffected. `join_service` was left
alone — nothing anywhere emits to `service_*` rooms, so it carries no data.

### Verification
- `backend/__tests__/chatSocketAuth.test.js` added — 6 assertions, all passing: participant can join, outsider
  refused and not joined; participant's message saved, outsider's message not appended and not saved; `setup`
  ignores a supplied id; `mark-as-read` from an outsider does not write.

### Known follow-up
- Nothing on the frontend listens for the new `chat-error` event, so a refused join is silent to the user.
  Acceptable for launch (it only fires on an unauthorised attempt), but worth wiring up with **F-56**
  (message-send failures are silent).

---

## Fix #6 — `POST /api/reviews` now checks eligibility

**Severity:** P0 (security) · **Flow:** Reviews after a completed job
**Audit ref:** F-34

### The problem

The entire validation in `createReview` was: `revieweeId` is a valid ObjectId, and `rating` is a number
between 1 and 5. It never checked that the order existed, that it was completed, that the reviewer took part
in it, or that the reviewee was the counterparty. It then recomputed and wrote the reviewee's public
`averageRating` and `reviewCount`.

**Any authenticated account could permanently damage any user's public rating** with a single request.

Two read routes were also missing `authenticate`, unlike every neighbouring line:
`GET /orders/:orderId/review` (populates *both* parties' names and avatars — deanonymises the pair to anyone
holding an order id) and `GET /reviews` (dumps the entire review table, unpaginated).

### What I verified first
The **only** live caller of `createReview` is `ProviderOrderDetailPage.tsx:246` — the provider reviewing the
customer — and its form is gated on `status === 'completed' && isProvider`, so a backend `completed`
requirement matches the UI exactly. `reviewsAPI.ts` has **zero importers** (dead module) and
`POST /services/:id/reviews` has **zero callers**. The customer's review of the provider is created
server-side inside `approveAndPayout`, not through this endpoint, so it is unaffected.

### What changed
| File | Change |
|---|---|
| `backend/controllers/reviewController.js` | `createReview`: requires a valid `orderId`; 404 if the order is missing; 403 unless the reviewer is the order's customer or provider; 400 unless `status === 'completed'`; 400 unless `revieweeId` is the counterparty. `serviceId` is now taken from the order instead of the request body. |
| | `getReviewByOrderId`: 400 on a bad id, 404 if the order is missing, 403 unless the caller is a participant |
| `backend/routes/review.js` | added `authenticate` to `GET /orders/:orderId/review` and `GET /reviews` |

`revieweeRole` was deliberately left as a pass-through — the audit found its semantics are inverted
(**F-47**), but changing it here would break the existing read filters. That is a separate fix.

### Verification
- `backend/__tests__/reviewEligibility.test.js` added — 9 assertions, all passing: stranger refused (403),
  non-completed order refused, non-counterparty refused, missing order refused, nonexistent order 404,
  legitimate provider→customer review allowed (201), `serviceId` taken from the order not the body, and
  `getReviewByOrderId` refuses a non-participant while allowing a participant.
- Both live callers of the now-restricted GET are participants; `CompletedJobPage.tsx:66` additionally wraps
  it in `.catch(() => null)`, so it degrades gracefully.

### Known follow-up
- `getAllReviews` is now authenticated but still returns every review with no pagination. Nothing in B2C calls
  it (admin has its own `/api/admin/reviews`), so it is low risk, but it should be paginated or removed.
- The PII `console.log`s in this controller (**F-49**) were left in place — separate item.

---

## Fix #5 — Payout failure no longer reported to the customer as "money sent"

**Severity:** P0 · **Flow:** Customer approves job → provider payout
**Audit ref:** F-33

### The problem

When the Stripe Connect transfer fails, `approveAndPayout` returns **HTTP 200** with
`{ message: 'Jobb godkjent', payoutWarning, payoutErrorCode }`. That status is *correct* — the approval
itself succeeded, the order is completed, and the provider is notified separately. The failure was entirely
on the frontend: `SafePayApproval.tsx` did `onSuccess: () => { setIsSuccess(true); toast.success('Jobb godkjent!'); }`
and **never read `payoutWarning`**.

So on a failed transfer the customer saw a green checkmark, *"Pengene er lagt til {provider} sin saldo"*, the
full amount in large green type, and *"Tilgjenelig innen 1–2 virkedager"* — while no money had moved and the
provider's `earnings` was deliberately not incremented. Both parties believed the worker had been paid.

The two most common causes are exactly the ones a launch will hit: the provider hasn't finished Stripe Connect
onboarding (`PAYOUT_SETUP_REQUIRED` / `PAYOUT_NOT_ENABLED`), or a transient Stripe failure.

### What changed — frontend only

`frontend/src/pages/SafePayPage/SafePayApproval.tsx`:
- Added `payoutWarning` state; `onSuccess` now reads the response body and stores it.
- On a payout failure the toast is a neutral warning (`'Jobb godkjent, men utbetalingen er ikke fullført.'`),
  **not** `toast.success`.
- The success screen swaps to honest content when `payoutWarning` is set: amber warning icon instead of the
  green check, the backend's specific explanation instead of "Pengene er lagt til … saldo", and
  "Utbetaling ikke fullført" instead of the availability promise.
- Fixed the `Tilgjenelig` → `Tilgjengelig` typo in the same block.

**The backend was deliberately not changed.** Returning 200 is the right semantics here — the approval is a
real state transition that must not be rolled back because a transfer failed — and it already creates the
right provider notification. The bug was that nobody read the warning it was already sending.

### Verification
- Frontend typecheck: **354 errors, unchanged — zero new**.
- Lint on the file: 7 → 6 errors (I typed my own callback rather than adding an `any`); all 6 remaining are
  pre-existing (`Home`/`MessageCircle`/`Bell` unused, three older `any`s).

### Still to test manually
1. Approve a job for a provider who has **not** completed Stripe Connect onboarding → amber icon,
   the Connect-setup explanation, "Utbetaling ikke fullført", and no success toast.
2. Approve a job for a fully onboarded provider → unchanged green success path.
3. Confirm the provider receives the "Fullfør Stripe Connect-oppsett" notification in case 1.

---

## Fix #4 — Payment success page now verifies before claiming success

**Severity:** P0 · **Flow:** SafePay checkout → Stripe → `/safepay/success`
**Audit ref:** F-37

### The problem

`SafePaySuccess.tsx` destructured only `{ isLoading, error }` from its status query and **never read the
response body**. The status query was also `enabled: !!sessionId`, so with no `session_id` in the URL it never
ran at all — `isLoading` stayed false and the page rendered straight to success.

Result: anyone could open `/safepay/success?orderId=<anything>` and be told *"Betaling bekreftet! … Pengene er
nå trygt lagret hos SafePay"*. Even with a real `session_id`, the success UI rendered whether Stripe reported
`paid`, `unpaid`, or the request errored outright — the error case only fired a toast behind the success screen.

### What I had to be careful about

The page is **not** only a Stripe return URL. Two live flows reach it with no `session_id`:
- `ApplicantsPage.tsx:111` → `/safepay/success?orderId=…`
- step 3 ("Jobb utføres") of the SafePay steps bar, `SafePaySteps.tsx:20`

and the chat checkout uses a third shape, `?session_id=…&chatId=…` with no `orderId`
(`chatController.js:239`). Simply requiring `session_id` would have broken the first two.

### What changed — frontend only

`frontend/src/pages/SafePayPage/SafePaySuccess.tsx` now derives an explicit
`paymentState: 'verifying' | 'paid' | 'pending' | 'unverified'` from two independent sources:
- the Stripe session status (authoritative — the backend retrieves the session live), and
- the order's own `paymentStatus` / `status` from the details endpoint we already fetch, which covers the
  no-`session_id` entry points.

Behaviour per state:

| State | Condition | UI |
|---|---|---|
| `verifying` | either query loading | spinner (as before) |
| `paid` | either source confirms payment | the existing success screen, unchanged |
| `pending` | a source answered and said not paid | "Betalingen er ikke fullført" + "Sjekk på nytt" + "Gå til betaling" |
| `unverified` | nothing could be checked | "Vi fikk ikke bekreftet betalingen" + same recovery CTAs |

The steps bar is now only rendered in the `paid` state, so it can't imply step 3 is reached on an unpaid order.
The error toast now fires only when verification genuinely failed — a confirmed "not paid yet" is a legitimate
state with its own UI, not an error.

Cases walked through: no params at all (was the exploit — now `unverified`); `orderId`-only on a paid order
(still `paid`, so the ApplicantsPage and steps-bar flows keep working); `orderId`-only on an unpaid order
(now `pending` instead of fake success); `session_id`-only from the chat flow; and a non-participant getting
403 on both lookups (now `unverified` instead of a full success page).

### Verification
- Frontend typecheck: **354 errors, unchanged — zero new**. The one apparent new entry
  (`providerName` unused) is the same pre-existing error shifted from line 46 to line 77 by the added code;
  confirmed by diffing the before/after error sets.
- Lint on the file: 2 errors, both pre-existing (`ArrowRight`, `providerName` unused).

### Still to test manually
1. `/safepay/success` with **no query params** → "Vi fikk ikke bekreftet betalingen", **not** success.
2. `/safepay/success?orderId=<a paid order>` → success (proves ApplicantsPage / steps-bar flows still work).
3. `/safepay/success?orderId=<an awaiting_payment order>` → "Betalingen er ikke fullført".
4. Real Stripe test payment with the redirect intact → success as before.
5. `/safepay/success?orderId=<someone else's order>` → "Vi fikk ikke bekreftet betalingen".
6. Cancel at Stripe, then hit the success URL manually with that `session_id` → pending, with "Sjekk på nytt".

---

## Fix #3 — Removed the legacy payout endpoint that bypassed every payment check

**Severity:** P0 (financial security) · **Flow:** SafePay approval → provider payout
**Audit ref:** F-32

### The problem

`POST /api/safepay/contract/:orderId/complete` (`routes/safepay.js:41` → `safepayController.completeJobAndPayout`)
released a **real Stripe Connect transfer** after checking only two things:

```js
if (String(order.customerId) !== String(userId))  // customer only
if (order.status === 'completed')                 // not already done
```

It did **not** check `paymentStatus === 'paid'`, did **not** require the order to be in `ready_for_review`,
and did **not** check for an active dispute. It then unconditionally set `paymentStatus: 'paid'` and called
`releasePayoutToProvider({ grossAmount: order.agreedPrice })`.

A customer could therefore `POST` to it on an order still sitting in `awaiting_payment` and trigger a payout
of money the platform had never collected — or force a payout out from under an open dispute.

### Verification done *before* changing anything

Searched the whole repo (frontend, backend, **and the `mobile/` React Native app**):

| Reference | Location | Live? |
|---|---|---|
| Route registration | `backend/routes/safepay.js:41` | the only executable link |
| Controller method | `backend/controllers/safepayController.js:319` | **no callers other than the route** |
| Frontend API wrapper | `frontend/src/api/safePayAPI.ts:22` | **zero callers** |
| Direct URL calls | none anywhere | — |
| Mobile app | zero matches for `safepay` / `payout` / `/complete` | does not use SafePay at all |

`safePayAPI.ts` has exactly **one** importer — `pages/ChatView/ChatView.tsx` — and it imports only
`createContract`. `ChatView.tsx` is itself dead code: nothing imports it, and it is not in `Routes.tsx`
(it is a duplicate chat implementation superseded by `MessagesPageSplit`).

**Conclusion: the endpoint had no live callers.** No migration was needed, so nothing was migrated.

The hardened replacement is live and was **not touched**: `SafePayApproval.tsx:318` →
`POST /api/safepay-checkout/approve` → `SafePayCheckoutController.approveAndPayout`
(`routes/safePayCheckout.js:9`). It has full parity with the deleted method — same review creation,
same rating recalculation, same payout call — plus the three guards the legacy path lacked:
`status !== 'ready_for_review'` → 400, `paymentStatus !== 'paid'` → 400, active dispute → 400.

### What changed

| File | Change |
|---|---|
| `backend/routes/safepay.js` | removed the route; left a comment recording why and naming the replacement |
| `backend/controllers/safepayController.js` | deleted `completeJobAndPayout` and its doc block (273 lines) |
| `frontend/src/api/safePayAPI.ts` | deleted the now-dead `completeJobAndPayout` wrapper |
| `backend/services/payout/releasePayoutToProvider.js` | corrected the header comment that listed it as a valid release path |
| `backend/services/payoutService.js` | same, in the shared-helper doc block |

Deliberately **not** touched: `approveAndPayout` and the whole `/api/safepay-checkout` flow; the sibling
legacy routes on lines 40/42/43 (`/contract/:orderId/start`, `/history/:userId`,
`/contract/:orderId/checklist/:itemId`) — out of scope for F-32.

### Verification after the change
- Repo-wide search for `completeJobAndPayout` and `contract/*/complete` → only three hits remain, all
  **documentation**: this log, the removal comment in `routes/safepay.js`, and the historical note in
  `releasePayoutToProvider.js`. **No executable reference survives.**
- `routes/safepay.js`, `safepayController.js`, `payoutService.js`, `releasePayoutToProvider.js` all load;
  remaining exports intact (`createContract`, `getContract`, `startJob`, `getSafePayHistory`,
  `updateChecklistItem`, `getCheckoutDetails`).
- SafePay-specific suites: `safePayStateService` + `bug006_stripe_connect` + `orderSchema` → **13/13 passed**.
- Full backend suite: **140 passed, 9 failed** — identical to the pre-existing baseline (all 9 in
  `chatReport.test.js`, previously confirmed by stashing all changes and reproducing the same 9).
- Frontend typecheck: **no new errors**, none in `safePayAPI.ts`.

### Remaining risk
- **Low.** The endpoint had no callers, so no client can regress. A third-party or older deployed client
  calling it directly would now get a 404 — but no such caller exists in this repo or the mobile app, and
  the wrapper that would have made one possible was never used.
- The dead `ChatView.tsx` still imports `createContract` from `safePayAPI.ts`, so that module stays. Removing
  the duplicate chat implementation is tracked separately as **F-63** (P3).
- **F-33** and **F-37**, noted here as still open when Fix #3 was written, are now done — see Fixes #5 and #4.

---

## Fix #2 — SafePay: payment confirmation now survives the browser going away

**Severity:** P0 · **Flow:** Applicant selected → SafePay checkout → payment → provider starts work
**Audit refs:** F-30 (no webhook), F-31 (Order schema dropping fields)

### The problem

There was **no Stripe webhook anywhere in the backend** (grep for `webhook` / `constructEvent` returned
nothing). Payment was recorded only as a side effect of the browser landing back on `/safepay/success`,
which fires `GET /api/safepay-checkout/status/:sessionId`.

If the tab closed, the phone switched apps, or the network dropped on the redirect:
- Stripe captured the money;
- the order stayed `awaiting_payment` / `unpaid`;
- the provider was never notified and could not start work;
- `createSafePaySession` only blocks when `paymentStatus === 'paid'`, so the customer was invited to **pay a second time**.

The only recovery path, `reconcilePayment`, was permanently dead: it bails on `if (!order.checkoutSessionId)`,
and `checkoutSessionId` was **never persisted** — because it wasn't in the `Order` schema, and Mongoose strict
mode (the default) silently drops unknown paths.

That same root cause broke three other things: `updateCustomerChecklist` wrote *only* dropped fields, so it
returned `200 {message:'Sjekkliste bekreftet'}` and changed nothing; all lifecycle timestamps were `undefined`;
and `ready_for_review` sat outside the status enum, so any later `order.save()` on such a document threw.

### What changed

**`backend/models/Order.js`** — additive schema fix (the root cause)
- Added `ready_for_review` to the `status` enum.
- Added the reconciliation fields: `checkoutSessionId`, `checkoutSessionStatus`, `checkoutSessionCreatedAt`, `paymentIntentId`, `paymentConfirmedAt`.
- Added the lifecycle fields: `startedAt`, `readyForReviewAt`, `completedAt`, `completionNote`, `price`.
- Added the two-sided checklist fields: `providerCompleted{,At,By}`, `customerConfirmed{,At,By}`.

**`backend/controllers/SafePayCheckoutController.js`**
- Extracted the payment-confirmation transition out of `checkoutSessionStatus` into one shared
  `confirmPaidSession(session, io)`, so the redirect path and the webhook cannot drift. It is idempotent:
  it short-circuits on already-paid orders and treats a lost `findOneAndUpdate` race as "already confirmed".
- Added `exports.stripeWebhook` — verifies the Stripe signature, handles `checkout.session.completed`
  (confirm payment) and `checkout.session.expired` (clear the stale session so session reuse stops retrying it).
  Returns 400 on a bad signature and 500 on transient DB failure so Stripe retries.
- `checkoutSessionStatus` keeps its auth checks and now delegates to the shared function; its previously
  silent `catch` now logs.

**`backend/app.js`** — mounted `POST /api/safepay-checkout/webhook` with `express.raw({type:'application/json'})`
**before** `express.json()` (signature verification needs the raw body) and **before** `apiLimiter`
(rate-limiting Stripe's retries would drop payment confirmations).

**`backend/config/stripe.js`** — extracted `isTestMode()` and added `getStripeWebhookSecret()` so the webhook
picks the signing secret matching whichever mode `getStripe()` is using.

**`backend/.env.example`** — documented `STRIPE_WEBHOOK_SECRET` and `STRIPE_TEST_WEBHOOK_SECRET`.

### ⚠️ Deploy steps required — the fix is inert without these

1. In the Stripe Dashboard, add an endpoint: `POST https://<API_HOST>/api/safepay-checkout/webhook`
2. Subscribe it to **`checkout.session.completed`** and **`checkout.session.expired`**.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (and `STRIPE_TEST_WEBHOOK_SECRET` for the test endpoint).
4. If a proxy/WAF sits in front of the API, make sure it does not rewrite or re-encode the request body on that path.

### Verification done
- All modules load; `backend/__tests__/orderSchema.test.js` added — 5 assertions, all passing.
- Full backend suite: 140 passed. The 9 failures in `chatReport.test.js` are **pre-existing** — confirmed by
  stashing these changes and re-running, which produced the identical 9 failures.

### Still to test manually (needs a deployed endpoint + Stripe test mode)
1. Complete a test payment, **kill the tab before the redirect** → the order must still become `paid`,
   the provider must get the notification, and "Start jobb" must be available.
2. Re-open checkout for that order → must refuse with `409 Ordre er allerede betalt.`, not offer a second payment.
3. Pay normally with the redirect intact → exactly **one** `Payment` record and one notification pair
   (proves webhook + redirect are idempotent together, since both will fire).
4. Abandon a checkout until it expires → `checkoutSessionStatus` becomes `expired`; a new session is created cleanly.
5. Provider ticks a checklist item, customer confirms it → the `✓ Bekreftet` badge now renders.

### Known follow-ups from the same area (not in this fix)
- ~~**F-32** legacy payout endpoint with no payment or status check.~~ **Done — see Fix #3.**
- ~~**F-33** payout failure reported as success.~~ **Done — see Fix #5.**
- ~~**F-37** `/safepay/success` declared confirmation without reading the response.~~ **Done — see Fix #4.**

---

## Fix #1 — Dead routes, missing error boundary, developer placeholder text

**Severity:** P0 · **Flow:** First-time discovery, upsell, favourites, any crash
**Audit refs:** F-51, F-03, F-02, F-05

### The problem
- `TopResults.tsx` / `InfiniteResults.tsx` sent homepage search results to `/service/:id` — **not a registered route**.
  Clicking a job on the landing page, the app's primary discovery surface, hit a wordless 404.
- `PricingPage` was `lazy()`-imported in `Routes.tsx` but **never registered**, so the upsell CTA 404'd.
- `/favorites`, bare `/job-listing`, and `/cookie-policy` were also linked but unregistered.
- `NotFoundPage` rendered **only a Lottie animation** — no text, no way back.
- `ErrorBoundary` existed but was **mounted nowhere**, and no route had an `errorElement`: any render throw
  ejected the user to React Router's unstyled English error screen.
- `ProtectedRoute` showed `'Beep boop later som jeg logger inn om 2 sek'` to users, and `return <>{children};</>`
  painted a literal `;` at the top of every protected page.

### What changed
| File | Change |
|---|---|
| `frontend/src/components/landing/Search/TopResults.tsx:80` | `/service/${id}` → `/job-listing/${id}` |
| `frontend/src/components/landing/Search/InfiniteResults.tsx:118` | same |
| `frontend/src/components/job/RelatedJobs.tsx:45` | bare `/job-listing` → `/home` |
| `frontend/src/components/shared/CookieBanner.tsx:51` | `/cookie-policy` → `/cookies` |
| `frontend/src/routing/Routes.tsx` | registered `pricing` (public) and `favorites` (protected); added `errorElement` to `/` **and** to `login`/`register`/`forgot-password` (siblings of `/`, so the root element would not have covered them) |
| `frontend/src/components/ErrorBoundary.tsx` | extracted shared `reportClientError`; added `RouteErrorElement` (Norwegian copy, "Prøv igjen" + "Til forsiden", reports to the existing `/api/errors/client`) |
| `frontend/src/pages/NotFoundPage/NotFoundPage.tsx` | Norwegian copy + two links (the `Link` import was already there, unused) |
| `frontend/src/components/shared/ProtectedRoute.tsx:21,51` | replaced placeholder text; removed the stray `;` |

`pricing` is **public** deliberately: the job-detail CTA is reachable by logged-out visitors, and gating it
would just move the dead end.

### Verification done
- Typecheck 379 → **377** errors. Before/after diff: **zero new errors**; two fixed, including
  `'PricingPage' is declared but never used` — the exact symptom of the missing route.
- Lint: no new violations (new code typed with `unknown`, not `any`).

### Still to test manually
1. Landing page → search a job → click a result → job detail, not a 404
2. Job detail → upgrade modal → "Se alle abonnementer" → pricing page (logged out too)
3. Open a favourite list → back → favourites page
4. Fresh browser → cookie banner → "Cookie Policy" → cookie page
5. `/en-side-som-ikke-finnes` → Norwegian 404 with working links
6. Logged out → `/profile` → no stray `;`, no "Beep boop"
7. Temporarily `throw` in a page component → branded error screen; a POST reaches `/api/errors/client`

---

## Environment note (resolved during Fix #3)

Six dependencies in `frontend/package.json` were **absent from `frontend/node_modules`** (dated 16 May, while
`package.json` is dated 14 Aug): `@vis.gl/react-google-maps`, `react-day-picker`, `input-otp`, `@base-ui/react`,
`@shadcn/react`, `recharts`.

They were pulled in during the tooling runs for Fix #3 and are now present; `package-lock.json` is unchanged.
Two consequences worth knowing:

- Frontend typecheck dropped from 377 to **354** errors — 24 of them were `TS2307 Cannot find module` and their
  cascading implicit-`any` errors, now resolved. Nothing to do with any code fix.
- One error became newly *visible*: `src/components/Ui/message-scroller.tsx:88` (`"icon-sm"` not assignable to
  the Button size union). It was previously masked because the whole module failed to resolve. Pre-existing,
  untouched by any fix so far.

Anyone setting up a fresh checkout still needs `npm install` in `frontend/`.
