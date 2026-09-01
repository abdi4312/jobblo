# Jobblo — Mobile App Developer Guide

Everything needed to build the Jobblo mobile app: the design system, the API surface, the
job lifecycle rules, and the traps in the existing data model.

This is a companion to [`JOBBLO-DESIGN-BRIEF.md`](./JOBBLO-DESIGN-BRIEF.md) (the web design
context) and [`AGENTS.md`](./AGENTS.md). Where they disagree with this file, this file wins
for mobile — it has been reconciled against the backend as of **17 Aug 2026**.

Every value below is taken from the running code, not from a spec. Sources are cited so you
can verify and so you know what to re-check when the backend moves.

---

## 0. What you are building

Jobblo is a Norwegian two-sided marketplace for small jobs ("oppdrag" — moving help,
painting, gardening, assembly, handyman work).

1. A **customer** (job poster) publishes an oppdrag with a description, location and price.
2. **Providers** (workers) apply. Applying costs the applicant one "contact" from a monthly quota.
3. The customer picks one applicant and pays into **SafePay** escrow (Stripe).
4. The provider does the work, uploads proof, and marks it finished.
5. The customer approves — only then is the money released.
6. Either side can open a **dispute** instead.

Jobblo's cut is taken on completion. Free to post, free to receive offers.

**Two roles, one account.** There is no "provider account" — the same user can post one job
and apply to another. Role is *per order*, decided by whether your id sits in `customerId`
or `providerId`. Never cache "I am a provider" globally.

**Language: Norwegian (nb-NO) only.** All UI copy, all error messages, all empty states.
There is no i18n layer and none is planned. Do not ship English strings.

---

## 1. The stack that already exists

`mobile/` is already scaffolded. **Do not restart it** — extend it.

| Concern | Choice | Notes |
|---|---|---|
| Framework | Expo SDK 54, React Native 0.81.5, React 19.1 | |
| Routing | `expo-router` v6 (file-based) | `app/(tabs)/` already has index, explore, create, messages, profile, job-search |
| Styling | **NativeWind v4** + Tailwind v3.4 | `tailwind.config.js` `theme.extend` is currently **empty** — §2 fills it |
| Server state | TanStack Query v5 | |
| Forms | TanStack Form | |
| HTTP | `axios` — `mobile/features/auth/api/client.ts` | Interceptors already wired |
| Token storage | `expo-secure-store` under key `token` | |
| Icons | `lucide-react-native` | Same icon set as web — keep parity |
| Images | `expo-image`, `expo-image-picker` | |
| Auth session | `mobile/context/AuthContext.tsx` | |

Feature folders follow `features/<domain>/{api,hooks,types}` — already established for
`auth`, `category`, `hero`, `job`, `list`, `user`. **Keep that shape** for the new domains
you add: `order`, `safepay`, `chat`, `notification`, `applicant`, `dispute`.

Missing dependencies you will need to add: `socket.io-client` (chat + realtime),
and a date library if you need more than `Intl.DateTimeFormat('nb-NO')`.

---

## 2. Design system

Every colour is sampled from the logo — black wordmark, green sprout. **Do not introduce
hues that are not on this list.** Before this palette existed the app carried six different
greens; that is the failure mode being avoided.

Source of truth on web: [`frontend/src/theme/brand.ts`](./frontend/src/theme/brand.ts).

### 2.1 Palette

**Brand**

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B0B0B` | Headings, body text, the wordmark |
| `green` | `#2E6641` | **The** accent — primary buttons, links, active tab, one highlighted block per section |
| `green-dark` | `#255335` | Pressed state for primary green only |
| `leaf` | `#347028` | Link pressed; use sparingly |
| `green-deep` | `#122A1C` | Darkest surface — SafePay panels, solid dark controls. Same hue as `green` at 11% lightness |
| `green-on-ink` | `#8FBF9A` | The only green legible **on** `green-deep` |
| `green-mist` | `#EAF1E9` | Icon plates, small green-on-light chips |

**Neutrals**

| Token | Hex | Use |
|---|---|---|
| `ink-muted` | `#63665F` | Body copy, secondary text |
| `ink-faint` | `#9B9E96` | Placeholders, micro-labels, metadata |
| `line` | `#E6E7E1` | Every border and divider. **One value, no alpha borders** |
| `field` | `#F5F6F1` | Input resting surface |
| `panel` | `#F4F6F0` | Tinted block inside a white section |
| `page` | `#EFF0EA` | Screen background |

**The one exception**

`#FF5B24` — **Vipps orange**, mandated by Vipps' brand guidelines, permitted *only* on the
Vipps sign-in button. It is the only saturated colour outside the logo palette, and staying
rare is what makes it read as "the fast way in".

> There is a legacy `#e08835` in the web app's older screens. Do not port it.

**Discipline**

- Green carries **actions** and at most **one** highlighted element per section. Everything
  else is black, white and the two greys.
- No gradients as decoration.
- `#63665F` on white and `#2E6641` on white both pass AA for body text. `#9B9E96` is for
  large or non-essential text only.

### 2.2 `tailwind.config.js` — paste this in

`mobile/tailwind.config.js` currently has an empty `theme.extend`. Replace it:

```js
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B0B0B', muted: '#63665F', faint: '#9B9E96' },
        green: {
          DEFAULT: '#2E6641',
          dark: '#255335',
          leaf: '#347028',
          deep: '#122A1C',
          onInk: '#8FBF9A',
          mist: '#EAF1E9',
        },
        line: '#E6E7E1',
        field: '#F5F6F1',
        panel: '#F4F6F0',
        page: '#EFF0EA',
        vipps: '#FF5B24',
      },
      borderRadius: { control: '12px', panel: '16px', container: '24px' },
      spacing: { control: '46px', 'control-lg': '52px' },
    },
  },
  plugins: [],
};
```

### 2.3 `constants/theme.ts` — replace the Expo default

`mobile/constants/theme.ts` still ships Expo's template palette (`#0a7ea4` teal, dark mode
scaffolding). **None of it is Jobblo.** Replace it with the tokens above so non-Tailwind
consumers — status bar, navigation theme, `lucide-react-native` `color` props, `expo-image`
placeholders — read from one place:

```ts
export const Colors = {
  ink: '#0B0B0B',
  inkMuted: '#63665F',
  inkFaint: '#9B9E96',
  green: '#2E6641',
  greenDark: '#255335',
  leaf: '#347028',
  greenDeep: '#122A1C',
  greenOnInk: '#8FBF9A',
  greenMist: '#EAF1E9',
  line: '#E6E7E1',
  field: '#F5F6F1',
  panel: '#F4F6F0',
  page: '#EFF0EA',
  vipps: '#FF5B24',
  white: '#FFFFFF',
} as const;
```

**Dark mode: do not build it.** The web app has no dark theme and the palette has no dark
variants. Lock the app to light (`app.json` → `"userInterfaceStyle": "light"`) and delete
the `Colors.dark` branch rather than inventing colours.

### 2.4 Type

Web uses **Inter Display**. Load Inter via `expo-font` so the two products match; do not
fall back to system fonts for headings.

Web uses `clamp()` viewport scaling, which has no mobile equivalent. This is the adapted
fixed scale — **this table is an adaptation, not a copy**, so treat it as the starting point
and check it on a 360px device.

| Role | Size | Weight | Tracking | Colour |
|---|---|---|---|---|
| Screen title | 28 | 700 | −1.2 | `ink` |
| Section heading | 20 | 700 | −0.6 | `ink` |
| Card title | 15–17 | 600 | −0.2 | `ink` |
| Body | 14–15 | 400 | 0 | `ink-muted` |
| Micro-label | 11 | 600 | +1.8, UPPERCASE | `ink-faint` |
| Caption / meta | 12 | 400 | 0 | `ink-faint` |

The uppercase micro-label above a block is a recurring Jobblo device — keep using it.

### 2.5 Shape, size, rhythm

| Thing | Value |
|---|---|
| Corner radius — cards, inputs, buttons | 12 (`rounded-control`) |
| Corner radius — feature panels | 16 (`rounded-panel`) |
| Corner radius — large containers, CTA bands | 24 (`rounded-container`) |
| Pills (`rounded-full`) | **status chips only** |
| Control height | 46 — every button, input, select |
| Prominent control height | 52 — primary search and its button only |
| Screen gutter | 20 (`px-5`) |
| Card | white bg, radius 12, `border border-line` |
| Shadows | rare — one elevated element per screen at most |

**Focus rings translate to pressed states on mobile.** Web uses
`focus-visible:ring-4 ring-green/20`. On native, use `Pressable` with a pressed background
step (`green` → `green-dark`, white → `panel`) plus `expo-haptics`
`impactAsync(Light)` on primary actions. Never ship a tappable element with no pressed
feedback.

**Minimum tap target: 44×44.** Several web controls are visually smaller (the 36px chip);
pad them out on mobile rather than shrinking the target.

### 2.6 Component recipes

```tsx
// Primary action — one per screen
<Pressable className="h-control flex-row items-center justify-center gap-2 rounded-control
                      bg-green active:bg-green-dark px-5 disabled:opacity-50">
  <Text className="text-[15px] font-semibold text-white">Legg ut oppdrag</Text>
</Pressable>

// Secondary
<Pressable className="h-control flex-row items-center justify-center gap-2 rounded-control
                      border border-line bg-white active:bg-panel px-5">
  <Text className="text-[15px] font-semibold text-ink">Avbryt</Text>
</Pressable>

// Card
<View className="rounded-control border border-line bg-white p-4" />

// Status chip
<View className="self-start rounded-full bg-green-mist px-3 py-1">
  <Text className="text-[12px] font-semibold text-green">Pågår</Text>
</View>

// Icon plate
<View className="size-10 items-center justify-center rounded-control bg-green-mist">
  <Wrench size={18} color={Colors.green} />
</View>
```

### 2.7 Hard rules (inherited from the web brief — they apply on mobile too)

1. **Never invent trust signals.** No star ratings, review counts, "10 000+ brukere",
   "svarer innen en time", or testimonials unless the number comes from a real API endpoint.
   The web app previously shipped a hardcoded "4.8 ★" and a "250+ jobber per dag" badge;
   both were removed. If there is no real figure, design a layout that does not need one.
2. **Never build a control that does nothing.** If a filter or toggle has no backend behind
   it, leave it out. Half-wired controls read as broken, not as "coming soon".
3. **Norwegian only**, including error and empty states.
4. **Vipps before Google, always**, in its own orange.
5. **Design down to 360px wide.** Use `SafeAreaView` from `react-native-safe-area-context`
   on every screen — the web equivalent bug (`vh` vs `dvh` hiding submit buttons) becomes
   the notch and home indicator on mobile.
6. **Icons from `lucide-react-native` only.** Keep icon choices identical to the web screen
   they mirror.
7. **Accessibility:** `accessibilityLabel` on every icon-only button, `accessibilityRole`,
   and `accessibilityState={{ disabled }}` — a disabled-looking button that is still
   focusable is a bug.

---

## 3. API

### 3.1 Base URL

`mobile/features/auth/api/client.ts` currently hardcodes a LAN IP:

```ts
const DEV_IP = '192.168.79.26';
const BASE_URL = Platform.OS === 'android' ? `http://${DEV_IP}:5001/api` : 'http://localhost:5001/api';
```

**Fix this before doing anything else.** Move it to `app.json` → `expo.extra.apiUrl` and
read it via `expo-constants`, with per-environment values. As written, iOS `localhost` fails
on a physical device and the Android IP goes stale on every network change. Also strip the
`console.log` of every request/response — it leaks tokens and payloads into production logs.

All routes are mounted under `/api`. Full prefix list from `backend/app.js`:

`/api/auth` · `/api/users` · `/api/services` · `/api/favorites` · `/api/messages` ·
`/api/upload` · `/api/home-hero` · `/api/config` · `/api/orders` · `/api/notifications` ·
`/api/categories` · `/api/plans` · `/api/filter` · `/api/hero` · `/api/chats` ·
`/api/stripe` · `/api/coupons` · `/api/transactions` · `/api/lists` · `/api/ai` ·
`/api/explore` · `/api/applicants` · `/api/safepay` · `/api/safepay-checkout` ·
`/api/connect` · `/api/my-applications` · `/api/location-filter` · `/api/support`

Swagger is served at `/api/docs`.

### 3.2 Auth

**Login** — `POST /api/auth/login` `{ email, password }` → `200 { user, accessToken }`
**Register** — `POST /api/auth/register` `{ name, lastName, email, password, role, companyName?, orgNumber? }` → `201 { user, accessToken }`

- `role` is `'user'` or `'company'`. Company requires `companyName` and a **9-digit**
  `orgNumber`.
- Password rules are enforced server-side (`authController.validatePasswordStrength`):
  min 8 chars, at least one lowercase, one uppercase, one digit — Norwegian letters
  (`æøå` / `ÆØÅ`) count. Mirror these client-side so the user is not round-tripped.
- The response body carries `accessToken`. The server *also* sets httpOnly cookies
  (`accessToken`, 1h; `refreshToken`, 7d).

`backend/middleware/auth.js` accepts **either** a cookie **or**
`Authorization: Bearer <token>`, so the existing SecureStore + interceptor approach works
for normal REST calls. Two things do not — see §3.4.

**Auth error codes** (401 with a `code` field):

| `code` | Meaning | App should |
|---|---|---|
| `TOKEN_MISSING` | No token sent | Route to login |
| `TOKEN_EXPIRED` | Access token past 1h | Refresh, then retry once |
| `SESSION_REVOKED` | Session deleted server-side | Clear SecureStore, route to login |

Other auth endpoints: `POST /logout`, `POST /refresh-token`, `GET /profile`,
`GET /sessions`, `DELETE /sessions/:id`, `DELETE /sessions/revoke-others`,
`POST /forgot-password`, `POST /verify-otp`, `POST /reset-password`,
`POST /change-password/send-otp`, `POST /change-password/verify-otp`.

Social: `GET /api/auth/vipps` → `GET /api/auth/vipps/callback`, and
`GET /api/auth/google` → callback. Both are browser redirect flows — use
`expo-web-browser` `openAuthSessionAsync` with a deep link back into the app. **Vipps must
appear above Google on every sign-in surface.**

### 3.3 Error response shape — handle both

The backend is not consistent. Depending on the controller you will get:

```jsonc
{ "error": "Ugyldig orderId" }      // most controllers
{ "message": "User not found" }     // middleware, subscription checks
```

Write one extractor and use it everywhere:

```ts
export const apiError = (e: unknown, fallback = 'Noe gikk galt. Prøv igjen.') =>
  (e as any)?.response?.data?.error ??
  (e as any)?.response?.data?.message ??
  (e as any)?.message ??
  fallback;
```

Messages from the backend are already in Norwegian and are safe to surface directly. Your
fallback must be Norwegian too.

Upload failures return `413` with a translated message (max 8 MB per file, max 6 images).

### 3.4 ⚠️ Two backend gaps that block mobile

These are not opinions — they are places where the backend reads cookies and only cookies.
A React Native client has no browser cookie jar. **Raise both before you start; neither can
be worked around cleanly on the client.**

**(a) Token refresh is cookie-only.**
`authController.refreshToken` reads `req.cookies?.refreshToken` and nothing else, and the
refresh token is never returned in a response body. So after the 1-hour access token
expires, the app has no way to refresh — the user gets logged out every hour.

*Asked-for fix:* accept `refreshToken` from the request body (or an `X-Refresh-Token`
header) and return it in the `login` / `register` / `refresh-token` response bodies
alongside `accessToken`. Then store it in SecureStore and add a 401-retry interceptor.

**(b) Socket.IO auth is cookie-only.**
`backend/sockets/chat.socket.js` reads the token from
`socket.handshake.headers.cookie` and rejects the connection when there is none. So chat,
online presence and every realtime order event are unreachable from the app.

*Asked-for fix:* also read `socket.handshake.auth.token`, so the client can do
`io(url, { auth: { token } })`. It is a three-line change in the `io.use()` handler.

Until (b) ships, chat must fall back to polling `GET /api/chats/:chatId` and notifications
to polling `GET /api/notifications/unread-count`. Build the transport behind an interface so
swapping to sockets later is one file.

---

## 4. Data model — and the naming traps

### 4.1 The inversion that will bite you

`customerId` and `providerId` mean **opposite things** in the two main collections.

| Collection | `customerId` is… | `providerId` is… |
|---|---|---|
| **`Order`** | the job **poster** (pays) | the **worker** (gets paid) |
| **`JobRequest`** (an application) | the **applicant / worker** | the job **poster** |

Confirmed in `orderController.js:89` — `const providerId = service.userId` (the job owner)
while `customerId` is `req.userId` (whoever is applying).

`Chat` uses a third convention: `clientId` / `providerId`, matched **direction-agnostically**
— the same pair may exist in either slot order depending on who messaged first
(`orderController.js:150`). Never assume a slot; always match the pair.

**Do not derive roles from field names.** Write one helper and use only that:

```ts
export const roleInOrder = (order: Order, userId: string) =>
  String(order.customerId?._id ?? order.customerId) === userId ? 'customer'
  : String(order.providerId?._id ?? order.providerId) === userId ? 'provider'
  : null;
```

### 4.2 Populated vs. raw ids

The same field comes back as a bare ObjectId string on list endpoints and as a populated
object on detail endpoints. Always unwrap with `x?._id ?? x` and `String()` before
comparing — an ObjectId/string mismatch is silently `false`, which is exactly how the web
app once hid the customer's whole action bar.

### 4.3 Core entities

**`Service`** — the oppdrag. `userId` (poster), `title`, `description`, `price`,
`hourlyRate`, `paymentType`, `location { type:'Point', coordinates:[lng,lat], address, city }`,
`countyCode`/`municipalityCode`/`areaCode`, `categories[]`, `images[]`, `urgent`,
`promoted`, `status`, `checklist[]`, `fromDate`/`toDate`/`duration`.

> `contactPhone` and `contactEmail` are `select: false` — they are **not** in public reads.
> Only `GET /api/services/my-posted` opts back in. Do not build a UI that expects them on
> the public listing.

**`Order`** — the contract. `serviceId`, `customerId`, `providerId`, `chatId`, `status`,
`paymentStatus`, `agreedPrice`, `checklist[]`, `beforeImages[]`, `afterImages[]`,
`completionNote`, `history[]`, lifecycle timestamps (`startedAt`, `readyForReviewAt`,
`completedAt`), `review {}`.

**`JobRequest`** — an application. `serviceId`, `customerId` (applicant), `providerId`
(poster), `status`, `message`, `favorite`, `archived`, `withdrawnAt`.
One open application per applicant per job, enforced by a partial unique index — a duplicate
POST returns 400, not a second row.

**`ChatMessage`** (the conversation doc) — `clientId`, `providerId`, `serviceId`, `orderId`,
`status`, `agreedPrice`, `messages[]`, `lastMessage`.

---

## 5. Status vocabularies

Five different enums are in play. Keep them in separate TS unions — do not merge them.

### 5.1 `Order.status`

`pending` · `accepted` · `declined` · `awaiting_payment` · `paid` · `in_progress` ·
`ready_for_review` · `completed` · `cancelled` · `disputed`

### 5.2 `Order.paymentStatus`

`unpaid` · `pending` · `paid` · `refunded`

> `paymentStatus === 'paid'` and `status === 'paid'` are **not** the same thing and must not
> be used interchangeably. `paymentStatus` stays `'paid'` for the entire rest of the
> lifecycle; `status` moves on. Testing `paymentStatus` where you meant lifecycle stage is
> the exact bug that made the web app tell employers a job was finished when the worker had
> not started it.

### 5.3 `Service.status`

`open` · `closed` · `awaiting_payment` · `paid` · `in_progress` · `waiting_for_approval` ·
`completed` · `pending` · `cancelled` · `expired`

The backend mirrors order transitions onto the service: start → `in_progress`,
ready-for-review → `waiting_for_approval`, payment → `paid`, approval → `completed`.
Note `waiting_for_approval` (service) is the counterpart of `ready_for_review` (order) —
**different words for the same moment.**

### 5.4 `JobRequest.status`

`pending` · `accepted` · `declined` (plus `withdrawnAt` for applicant-initiated withdrawal —
"declined by the poster" and "withdrawn by me" must read differently in the UI).

### 5.5 `Dispute.status`

`open` · `under_review` · `waiting_for_customer` · `waiting_for_provider` ·
`evidence_submitted` · `resolved` · `closed` · `cancelled`

A dispute is "active" when its status is **not** in `resolved` / `closed` / `cancelled`.
That is the exact test the backend uses to block starting, finishing and approving.

### 5.6 Norwegian labels

Port these verbatim from
[`frontend/src/constants/statuses.ts`](./frontend/src/constants/statuses.ts) so the two
products say the same thing:

```ts
export const STATUS_LABELS: Record<string, string> = {
  open: 'Åpent',           active: 'Aktivt',        pending: 'Venter',
  draft: 'Utkast',         awaiting_payment: 'Venter på betaling',
  paid: 'Betalt',          in_progress: 'Pågår',    ready_for_review: 'Klar til godkjenning',
  waiting_for_approval: 'Venter på godkjenning',    completed: 'Fullført',
  cancelled: 'Kansellert', closed: 'Lukket',        expired: 'Utløpt',
  disputed: 'Tvist',       accepted: 'Godkjent',    declined: 'Avslått',
};
export const statusLabel = (s?: string | null) => (s && STATUS_LABELS[s]) || 'Ukjent status';
```

**Never render a raw snake_case status.** Route every status through `statusLabel`.

---

## 6. The job lifecycle — the core logic

This is the part to get exactly right. Every guard below is enforced server-side; your UI
must agree with it or users hit errors they cannot act on.

```
  Poster publishes oppdrag
          │  Service.status = 'open'
          ▼
  Provider applies ──────────────► JobRequest 'pending'   (spends 1 contact quota)
          │                              │
          │                              ├─ poster declines ──► 'declined'
          │                              └─ applicant withdraws ─► withdrawnAt set
          ▼
  Poster accepts + creates contract
          │  Order created, status = 'awaiting_payment'
          ▼
  Poster pays via Stripe Checkout
          │  Order.status='paid'  Order.paymentStatus='paid'  Service.status='paid'
          ▼
  Provider taps "Start jobben"          POST /api/safepay/orders/:id/start
          │  Order.status='in_progress'   Service.status='in_progress'
          ▼
  Provider uploads proof, ticks checklist
          │  POST /api/safepay/orders/:id/evidence
          ▼
  Provider taps "Meld jobb som ferdig"  POST /api/safepay/orders/:id/ready-for-review
          │  Order.status='ready_for_review'  Service.status='waiting_for_approval'
          ▼
  Customer reviews + approves           POST /api/safepay-checkout/approve
          │  Order.status='completed'  Service.status='completed'  → payout
          ▼
        Done
```

At any point after payment, either side can branch to **`disputed`**.

### 6.1 Transition guards — copy these into the client

| Action | Who | Requires | Result | Endpoint |
|---|---|---|---|---|
| Start job | **provider only** | `status === 'paid'` **and** `paymentStatus === 'paid'` **and** no active dispute | `in_progress` | `POST /api/safepay/orders/:orderId/start` |
| Upload / delete evidence | **provider only** | `status ∈ {paid, in_progress}` | — | `POST` / `DELETE .../evidence` |
| Provider checklist tick | **provider only** | `status ∈ {paid, in_progress, ready_for_review}` | — | `PATCH .../provider-checklist/:itemId` |
| Customer checklist tick | **customer only** | `status ∈ {paid, in_progress, ready_for_review}`, no active dispute | — | `PUT /api/safepay-checkout/contract/:orderId/checklist/:itemId` |
| Mark ready for review | **provider only** | `status === 'in_progress'` **and** `paymentStatus === 'paid'` **and** no active dispute | `ready_for_review` | `POST .../ready-for-review` |
| Approve + pay out | **customer only** | `status === 'ready_for_review'` **and** `paymentStatus === 'paid'` **and** no active dispute **and** `ratings.overall ≥ 1` | `completed` | `POST /api/safepay-checkout/approve` |
| Open dispute | either party | order exists, no active dispute | `disputed` | `POST /api/safepay/contract/:orderId/dispute` |

Sources: `providerWorkController.startJob` / `.markReadyForReview` / `.uploadEvidence`,
`SafePayCheckoutController.approveAndPayout` (state check at line 475),
`safepayController.updateChecklistItem` (editable statuses at line 547).

### 6.2 The rule that matters most

> **`ready_for_review` is written by exactly one thing: the provider pressing
> "Meld jobb som ferdig".** Nothing else sets it. No timer, no payment webhook, no
> checklist completion.

So the customer-facing app must never claim, imply, or pre-render "utføreren har meldt
jobben som ferdig" at any other status, and must never offer an enabled approve button
before then. Do not gate on `paymentStatus === 'paid'` — that is true from the moment the
card is charged.

This exact bug shipped on web (a hardcoded banner plus four routes that tested
`paymentStatus`) and was fixed in Aug 2026. Do not reintroduce it on mobile.

### 6.3 Where each role belongs, per status

Drive navigation from `Order.status`, never from `paymentStatus`.

| Order status | Customer sees | Provider sees |
|---|---|---|
| `awaiting_payment` | Checkout — "Bekreft og betal" | "Venter på betaling fra oppdragsgiver" |
| `paid` | Status screen — "Utfører har ikke startet ennå" | **"Start jobben"** |
| `in_progress` | Status screen — "Utfører jobber med oppdraget nå" | Upload evidence + **"Meld jobb som ferdig"** |
| `ready_for_review` | **Approval screen — checklist, rating, "Godkjenn og utbetal"** | "Meldt ferdig — venter på godkjenning" |
| `completed` | Receipt / summary | "Oppdrag fullført" + payout |
| `disputed` | Dispute panel | Dispute panel |

Cross-check against `ProviderOrderDetailPage.tsx:406-409`, which is the web app's
already-correct provider gating:

```ts
canStart      = isProvider && status === 'paid'             && paymentStatus === 'paid' && !activeDispute;
canMarkReady  = isProvider && status === 'in_progress'      && !activeDispute;
canApprove    = isCustomer && status === 'ready_for_review' && !activeDispute;
```

### 6.4 Evidence

- Types: `before` and `after`, stored in `beforeImages[]` / `afterImages[]`.
- Max **10** per type, per order.
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Max **10 MB** per file.
- Multipart field name is `files`, plus optional `completionNote` and
  `evidenceType` (`'before' | 'after'`, defaults to `'after'`).
- **Locked** once status is `ready_for_review`, `completed`, `disputed`, `cancelled` or
  `declined` — the provider cannot swap out evidence after submitting. Reflect that in the
  UI; do not show an upload button that will 400.

---

## 7. Money

`agreedPrice` is the negotiated job price. From `providerWorkController.getOrderDetail` and
`SafePayCheckoutController`:

```
fee         = round(agreedPrice × 0.03)
total       = agreedPrice + fee     ← what the customer is charged
providerNet = agreedPrice − fee     ← what the provider receives
```

Display both sides explicitly — the customer's total and the provider's net are different
numbers and users notice.

> ⚠️ **Flag for the product owner, not a bug for you to fix.** The design brief says Jobblo
> takes "3% of the agreed price", but the code adds 3% to the customer *and* subtracts 3%
> from the provider — an effective take of ~6%. Confirm which is intended before building
> the fee copy, and use whatever the backend actually returns
> (`GET /api/safepay/orders/:orderId` → `calculation`) rather than recomputing it on device.

Payment runs through Stripe Checkout:

1. `POST /api/safepay-checkout/create-session` → returns a Stripe Checkout URL.
2. Open it with `expo-web-browser` `openAuthSessionAsync` and a deep-link return URL.
3. On return, verify with `GET /api/safepay-checkout/status/:sessionId`.
4. If the redirect never comes back (app killed, network drop), the customer can self-heal
   with `POST /api/safepay/orders/:orderId/reconcile-payment`, which re-reads the session
   live from Stripe. **Build this recovery path** — on mobile, an interrupted browser
   handoff is common, and without it the order is stuck with money taken and no contract.

Never mark an order paid from the client's return URL alone. The authoritative sources are
the status endpoint and the webhook.

---

## 8. Contact quota (why applying can fail)

Applying to a job spends one "contact" from the applicant's monthly allowance
(`backend/middleware/checkSubscription.js`, guarding `POST /api/orders/request` and
`POST /api/chats/create`).

- Quota resets 30 days after `lastContactReset`.
- **Free rule:** private users applying to jobs under **10 000 NOK** do not spend quota —
  gated by the `FREE_PRIVATE_JOBS_UNDER_10000` global config flag, so it can be turned off
  server-side. Do not hardcode the threshold as a permanent product promise.
- Plans carry `freeContact`, `perContactPrice` and `ContactUnlock` (a cooldown in minutes
  between applications, applied **only after** free contacts are exhausted).

Two failure responses to handle explicitly:

| Status | Body | UI |
|---|---|---|
| `403` | `{ message, isDelayed: true, unlockAt }` | Cooldown — show a countdown to `unlockAt`, keep the button disabled |
| `402` | `{ message, paymentRequired: true, upgradeRequired: true, limit, usage, perContactPrice }` | Quota exhausted — offer upgrade or single-contact purchase, showing `usage`/`limit` |

Both messages are already Norwegian; surface them.

---

## 9. Realtime

**Blocked until §3.4(b) ships.** Once the server accepts `handshake.auth.token`:

```ts
const socket = io(BASE_URL.replace('/api', ''), { auth: { token }, transports: ['websocket'] });
```

**Rooms are joined server-side on connection** (`backend/sockets/rooms.js`), including on
every reconnect. The client must **not** emit `join` — the old client-driven join is why
realtime silently died after the first network blip, which on a phone is most of a session.
Emitting `setup` is harmless but unnecessary.

**Client → server**

| Event | Payload |
|---|---|
| `join-chat` | `chatId` — membership is verified server-side; failure returns `chat-error` |
| `send-message` | `{ chatId, text }` |
| `mark-as-read` | `{ chatId }` |
| `join_service` | `serviceId` — live updates for a listing |

**Server → client**

| Event | Payload | Use |
|---|---|---|
| `receive-message` | `{ chatId, message }` | Append to thread |
| `messages-read` | `{ chatId, userId }` | Read receipts |
| `chat-error` | `{ chatId, error }` | Toast; leave the room |
| `get-online-users` | `string[]` of userIds | Presence dots |
| `new_notification` | Notification doc | Badge + toast |
| `order_status_changed` | `{ orderId, status }` | **Invalidate order queries** |
| `order_ready_for_review` | `{ orderId }` | Customer: the approve action just became available |
| `payment_confirmed` | `{ orderId }` | Both parties |
| `order_completed` | `{ orderId }` | Both parties |

Treat every order event as a cache-invalidation trigger for TanStack Query, not as a source
of truth — refetch the order rather than patching status locally.

**Never trust a client-supplied userId for anything.** The backend was hardened against
exactly that (a socket could join a victim's room and read their whole event stream); do not
build an API shape that reintroduces it.

---

## 10. Notifications

`GET /api/notifications` · `GET /api/notifications/unread-count` ·
`PUT /api/notifications/:id/read` · `PUT /api/notifications/read-all` ·
`DELETE /api/notifications/:id` · `DELETE /api/notifications/delete-all`

Types: `message`, `order`, `system`, `promotion`, `alert`, `system_update`, `general`,
`follow`, `favorite`, `application`, `payment`, `review`, `job_update`.

**Tapping a notification must route by order status, not payment status** — the same rule as
§6.2. Port the web helper:

```ts
// isApprovable === status ∈ {ready_for_review, completed}
if (isApprovable(order.status))       → approval screen
else if (isPaidOrder(order.status))   → order status screen
else                                  → checkout screen
```

`follow` / `favorite` route to the sender's profile.

Push notifications do not exist server-side yet. If they are in scope, that is a backend
change (device-token storage + Expo push dispatch) and must be scoped separately.

---

## 11. Suggested build order

Each milestone should be independently demoable.

1. **Foundation** — replace `constants/theme.ts` and `tailwind.config.js` (§2.2, §2.3), load
   Inter, move the API base URL into config, strip request logging, build the shared
   `Button` / `Card` / `StatusChip` / `EmptyState` primitives.
2. **Auth** — email login/register with the real password rules, SecureStore, `AuthContext`,
   401 handling. Vipps and Google after §3.4(a) lands.
3. **Browse** — explore feed, categories, job detail, search, filters. Read-only; no orders yet.
4. **Post a job** — the create flow (`app/(tabs)/create.tsx` is scaffolded), image upload, location.
5. **Apply** — application flow plus the 402/403 quota states from §8.
6. **Chat** — polling first, sockets when §3.4(b) lands.
7. **SafePay** — contract, Stripe Checkout handoff, reconcile-payment recovery.
8. **The lifecycle screens** — §6.3, both roles. Build the state machine as a single tested
   module before building any screen against it.
9. **Approval, review, disputes.**

**Build §6.1 as one pure, unit-tested module** (`features/order/lifecycle.ts`) exporting
`canStart`, `canMarkReady`, `canApprove`, `canEditChecklist`, `canUploadEvidence`. Every
screen reads from it. The web app's bug happened because those rules were re-typed inline at
each call site and each copy drifted.

---

## 12. Open questions to resolve before coding

1. **Refresh-token gap** (§3.4a) — blocks sessions lasting more than an hour.
2. **Socket cookie auth** (§3.4b) — blocks chat and all realtime.
3. **Fee: 3% or effectively 6%?** (§7) — changes user-facing copy on both sides.
4. **Push notifications** — in scope for v1? Requires backend work.
5. **Vipps/Google on native** — confirm the redirect URIs registered with Vipps and Google
   include the app's deep-link scheme; the current ones are web-only.
6. **Deep links** — decide the scheme and whether web URLs (`/safepay/approval/:id`) should
   open the app via universal links.

---

## 13. File map — where to look in this repo

| Need | Read |
|---|---|
| Palette, type, control tokens | `frontend/src/theme/brand.ts` |
| Product + design rules | `JOBBLO-DESIGN-BRIEF.md` |
| Status labels and helpers | `frontend/src/constants/statuses.ts` |
| Role-correct order routing | `frontend/src/utils/orderRoute.ts` |
| Provider screen (correct gating reference) | `frontend/src/pages/ProviderWorkPage/ProviderOrderDetailPage.tsx` |
| Customer approval screen | `frontend/src/pages/SafePayPage/SafePayApproval.tsx` |
| Lifecycle transitions + guards | `backend/controllers/providerWorkController.js` |
| Approval + payout + fee math | `backend/controllers/SafePayCheckoutController.js` |
| Application + quota | `backend/controllers/orderController.js`, `backend/middleware/checkSubscription.js` |
| Auth, cookies, sessions | `backend/controllers/authController.js`, `backend/middleware/auth.js` |
| Socket events + rooms | `backend/sockets/chat.socket.js`, `backend/sockets/rooms.js` |
| Schemas | `backend/models/{Order,Service,JobRequest,ChatMessage,Dispute,Notification}.js` |
| Live API docs | `GET /api/docs` (Swagger) |
