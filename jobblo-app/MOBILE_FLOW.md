# Jobblo Mobile Flow

## 📋 Quick Reference

**For comprehensive Search/Filter documentation**, see [MOBILE_FILTER_FLOW.md](MOBILE_FILTER_FLOW.md):

- Complete filter feature list (search, categories, price, urgent, location, sort)
- Interactive price filter with Norwegian formatting
- TanStack Query integration and cache strategy
- Component hierarchy and dependencies
- API contract and query parameters
- useSearchFilters hook and state management
- Performance considerations

---

## Architecture & Shared Components

### Category Icons & Mapping

**Component**: [src/components/CategoryChip.tsx](src/components/CategoryChip.tsx)

**Icon Mapping**: [src/utils/categoryIcons.ts](src/utils/categoryIcons.ts)

**Icon Source**:

- Icons come from `lucide-react-native` library (matching frontend which uses `lucide-react`)
- Backend stores category.icon as string name (e.g., "Brush", "Wrench", "Paintbrush") matching lucide icon names
- Mobile getCategoryIcon() maps backend icon names to lucide-react-native components
- Verified against frontend JobListingPage.tsx getCategoryIcon() logic — both use identical fallback keyword matching

**Icon Mapping Priority** (from backend categories API):

1. Backend `category.icon` field → lucide-react-native component
2. Fallback: category name keyword matching:
   - "håndverk", "oppussing" → Wrench
   - "maling" → Paintbrush
   - "rengjøring", "rense" → Home
   - "flytting", "flytt" → Truck
   - "hage", "hagearbeid" → Sprout
   - "it", "nettverk", "pc" → Laptop
   - "transport" → Package
   - "rørlegger" → Wrench
   - "småjobber" → Handshake
3. Default: MoreHorizontal icon

**"Alle" (All) Button**: Grid3x3 icon (LayoutGrid equivalent in web)

**Service**: [src/services/categories.service.ts](src/services/categories.service.ts)

- `categoriesService.getFilterOptions()` → GET /api/filter/options
- Returns FilterOptions with categories[], each with name, icon, _id fields
- Stale time: 30 minutes (categories change rarely)

**Hook**: [src/hooks/useCategories.ts](src/hooks/useCategories.ts)

- `useCategories()` — fetches filter options with categories
- Used by Home and Explore screens
- Query key: queryKeys.categories.all

**Frontend Verification**:

- Frontend source: frontend/src/pages/ExplorePage/JobListingPage.tsx lines 52-89
- Frontend getCategoryIcon() uses identical logic: try backend icon, fall back to name keywords

**Consumers**:

- Home screen: [app/(app)/index.tsx](<app/(app)/index.tsx>) — displays category chips with icons
- Explore screen: [app/(app)/explore.tsx](<app/(app)/explore.tsx>) — displays category chips with icons

---

## Search Visual Parity Update

**Source of truth inspected**:

- [frontend/src/pages/ServiceListingPage/ServiceListing.tsx](../frontend/src/pages/ServiceListingPage/ServiceListing.tsx)
- [frontend/src/components/landing/Search/SearchInput.tsx](../frontend/src/components/landing/Search/SearchInput.tsx)
- [frontend/src/components/component/jobCard/JobCard.tsx](../frontend/src/components/component/jobCard/JobCard.tsx)
- [frontend/src/pages/ExplorePage/JobListingPage.tsx](../frontend/src/pages/ExplorePage/JobListingPage.tsx)

**Search UI parity changes made in mobile**:

- Rebuilt the Explore/Search screen to match the web Search screen order: sticky search bar, filter trigger, result count + sort, category chip rail, active filter chips, then result grid.
- Reused the shared search input pattern with the web control size, 12px pill height, border radius, white background, and green accent states.
- Kept the verified TanStack Query infinite-query flow and did not move job data into local state.
- Kept the shared CategoryChip and category icon mapping architecture intact, while aligning display and selected-state styling to the web design.
- Reused the shared JobCard contract rather than duplicate card patterns.
- Reworked the mobile filter pattern to follow the critical web search semantics: a filter trigger, result summary, and a native sheet for the deeper filter panel.
- Kept sort values aligned to the canonical API contract: `newest`, `price_low`, `price_high`, `relevant`.
- Updated the result header to match the responsive web message structure: count plus result label, same vertical rhythm, and filter/sort placement.

**Native-vs-web difference note**:

- The desktop sidebar is translated into a native sheet on mobile, because the web mobile pattern is a filter drawer rather than an always-visible sidebar.
- The sticky search behavior is implemented as a native top control with the same visual hierarchy rather than a desktop floating layout.

---

## Backend Contracts Verified

### Sort Values

**Source**: backend/utils/serviceSort.js (canonical definition)

**Supported Values**: ['newest', 'price_low', 'price_high', 'relevant']

**Status of 'relevant'**:

- Deliberately supported but identical to 'newest' in current implementation
- Comment in serviceSort.js: "There is no relevance signal to rank on: the search path builds regex $or conditions rather than a $text query... It stays in the contract because it is already advertised and clients send it; it resolves safely instead of falling through an unknown-value path."
- Safe to send; will not cause errors
- Real relevance ranking to be added when signal becomes available

**Each sort option includes tiebreaker**:

- newest: { createdAt: -1 }
- price_low: { price: 1, createdAt: -1 }
- price_high: { price: -1, createdAt: -1 }
- relevant: { createdAt: -1 } (identical to newest for now)

### Category Query Parameter

**Source**: backend/controllers/serviceController.js line 144

**Format**: `category` (singular, comma-separated string)

**Backend Processing**:

```javascript
if (category && typeof category === 'string') {
  const categoriesArray = category.split(',').map((c) => c.trim());
  query.categories = { $in: categoriesArray };
}
```

**Mobile Implementation** (jobs.service.ts):

```typescript
if (categories.length > 0) queryParams.category = categories.join(',');
```

**Example Requests**:

- Single category: `GET /api/services?category=Maling`
- Multiple categories: `GET /api/services?category=Maling,Rengjøring`

---

## Infinite Scroll Pagination

**Current Implementation**: True infinite scroll with result appending

**Verified Behavior**:

- page 1 (limit 16) → initial fetch, setAllJobs(data)
- user scrolls to 90% → onEndReached triggered
- page 2 → new fetch, setAllJobs([...prev, ...page2Data])
- No duplicates: jobs fetched with pagination offset
- No request spam: page increments only once per scroll threshold
- Stops automatically: when page >= totalPages, handleLoadMore does nothing

**State Management**:

- `page` state: tracks current pagination page
- `allJobs` state: accumulates results across pages
- Reset to page 1 on: search change, category change, sort change, filter change

---

## Implementation status

- ✅ Foundation
- ✅ TypeScript
- ✅ NativeWind
- ✅ TanStack Query
- ✅ Category Icons & Mapping
- ✅ Login
- ✅ Register Step 1
- ✅ Register Step 2
- ✅ Forgot Password
- ✅ Home
- ✅ Explore / Search
- ⬜ Search Filters
- ✅ Job Details
- ⬜ Apply to Job
- ⬜ My Applications
- ✅ Post Job / Legg ut
- ⬜ My Jobs
- ⬜ Job Management
- ✅ Mine søkere overview
- ⬜ Applicant Details
- ⬜ Select Provider
- ✅ Chat List / Meldinger
- ✅ Chat Detail / Conversation
- ✅ Notification settings overview
- ✅ Notification inbox (Varsler)
- ⬜ Contract
- ✅ SafePay history
- ✅ Payout settings / Stripe Connect
- ✅ Membership / plan selection and purchase
- ⬜ Payment Success / Failure
- ⬜ Active Job
- ⬜ Checklist
- ⬜ Work Progress
- ⬜ Completion
- ⬜ Review
- ⬜ Dispute List
- ⬜ Dispute Details / Thread
- ⬜ Create Dispute
- ✅ Profile overview
- ✅ Edit Profile
- ✅ Settings overview
- ⬜ Account
- ✅ Support

## Profile overview

The canonical mobile profile route is `/(app)/profile` (bottom tab `Profil`). It fetches the authenticated owner profile through `useProfile` → `profile.service.ts` → `api/client.ts` using `GET /api/auth/profile` and the centralized query key `queryKeys.auth.profile`.

The page displays the backend-backed avatar/initials, name, role, verification status when present, location, member date, rating and review count, completed jobs or posted jobs, bio, and skills. The available action is `Mine oppdrag og søknader`, which navigates to `/(app)/my-applications`. Logout calls the existing `authStore.logout`, retaining query cancellation/cache removal, socket destruction, push cleanup where supported, and auth clearing.

There is currently no mobile settings, membership, reviews, support, or job-management destination to navigate to. Edit profile is now available at `/(app)/profile/edit`; the remaining pages are outside this profile overview and edit task.

The edit profile route is `/(app)/profile/edit`. It seeds the form from `GET /api/auth/profile` and sends text-only changes as JSON via `PUT /api/users/:id`; avatar changes use multipart field `avatar` on the same endpoint. Editable fields are the web-supported profile fields: name, last name, bio (600 characters), skills, availability text, address, post number, poststed, and company name/org number/website for companies. Role, verification, ratings, statistics, email, and phone are read-only or settings-owned. The mutation updates and invalidates `queryKeys.auth.profile`, then syncs only basic identity fields to auth storage before returning to the profile.

## Settings overview

The canonical route is `/(app)/profile/settings`. It is a static navigation page grouped as Profil, Konto, Betaling, Personvern, and Annet. Working destinations are `/(app)/profile/edit`, `/(app)/profile/settings/password`, `/(app)/profile/settings/notifications`, `/(app)/profile/settings/subscription`, `/(app)/profile/settings/safepay`, `/(app)/profile/settings/payout`, and `/(app)/profile/membership`; the remaining rows are visibly deferred until their mobile detail screens exist.

The web distinguishes `Medlemskap` (`/membership`) as plan selection/purchase from `Abonnementer` (`/settings/subscriptions`) as current subscription management. Mobile keeps that same split: `Medlemskap` → `/(app)/profile/membership` and `Abonnementer` → `/(app)/profile/settings/subscription`. Reviews remain deferred because the web review route was intentionally removed after relying on invented review data; the profile only shows server-backed summary data.

Recommended next settings screen: account deletion, then privacy/session settings, then e-post/telefon. These are priority order only; no detail screens are included here.

## SafePay history

The route is `/(app)/profile/settings/safepay`, enabled from `SafePay-historikk`. Mobile uses `useSafePayHistory` and `queryKeys.safepay.history` with `GET /api/safepay/history`, where the backend derives the user from `req.userId`. The legacy `GET /api/safepay/history/:userId` remains for web compatibility and requires the requested ID to match the authenticated user for normal users; mobile never sends a user ID.

The response is full, unpaginated `{ history, summary }`. Summary values are server-provided `totalEarned`, `totalSpent`, `totalFees`, `totalTax`, and `transactionCount`. Transactions provide service title, role-aware counterpart names, payment date, status, and NOK amounts: `agreedPrice`, `fee`, `tax`, `totalCustomer`, and `netProvider`. The screen maps `transferred`/`completed`, `processing`/`in_progress`, `failed`, `refunded`, `cancelled`, `pending`/`released_internal`/`disputed`, and unknown statuses without offering retry actions. Transactions expand to show the financial breakdown.

The SafePay History screen ends with a navigation-only card linking to `/(app)/profile/settings/payout` (see "Payout / Stripe Connect settings"). This replaced the earlier deferred placeholder text; it is a plain `router.push` and adds no payout query, mutation, or status claim to SafePay History. `payoutEnabled` and `stripeConnectAccountId` remain available in the profile projection but SafePay History deliberately does not render payout readiness, because SafePay transaction status is not proof of Stripe payout readiness. No SafePay mutations were added.

## Subscription management

The mobile route is `/(app)/profile/settings/subscription`, enabled from the `Abonnementer` row. It uses `useCurrentSubscription` and `queryKeys.subscription.current` with `GET /api/stripe/subscription`. The response is the authenticated user's current plan, plan type, local status, Stripe status when available, auto-renew state, renewal/current-period end, and cancellation flag. No user-supplied customer or subscription ID is sent.

Cancellation uses `POST /api/stripe/subscription/cancel` and sets Stripe `cancel_at_period_end`; access remains available through the returned period-end date. Resume uses `POST /api/stripe/subscription/resume` when cancellation is pending. Both mutations invalidate the current-subscription query. There is no existing customer portal, invoice, or payment-method API in this checkout. `Medlemskap` is a separate screen for plan selection and purchase — see "Membership / plan selection and purchase". This screen owns cancel/resume; Membership never duplicates them, and Membership routes users here when they already hold a paid subscription.

## Notification settings

The route is `/(app)/profile/settings/notifications`, enabled from the `Varsler` row. The current web toggles for sound, browser, email, and SMS are client-local Zustand preferences; the backend has no notification preference fields or APIs. This mobile screen therefore does not render fake toggles.

The mobile package now uses a guarded lazy `expo-notifications` loader. It reads `granted`, `denied`, or `undetermined`, requests only when undetermined, gets an Expo token, and registers it through `POST /api/push-tokens`; the token is stored locally only for current-device deactivation and is never displayed. The settings screen can deactivate that current device through `DELETE /api/push-tokens/current`. Expo Go receives a neutral development-build message and does not request permission. Denied native permissions can open system settings. Logout/account switching deactivates only the locally registered token before clearing the session. Backend chat sends deliver `data.type: chat_message` with `chatId`; tapping routes to the existing mobile chat detail, while socket foreground behavior remains unchanged.

## Notification inbox (Varsler)

### Distinction from push settings

`/(app)/profile/settings/notifications` manages push notification permission and device registration. This inbox (`/(app)/alerts`) is the database notification history — the actual Varsler list.

### Route

Canonical mobile route: `/(app)/alerts`. Public Expo Router URL: `/alerts`. Registered as a hidden tab in `(app)/_layout.tsx`. No duplicate `/notifications` route exists.

### Entry point

A bell icon (`Bell` from lucide-react-native) with an unread badge is rendered in the top-right corner of the Home screen. The badge count comes from `GET /api/notifications/unread-count` via the `useUnreadCount` hook and the centralized `queryKeys.notifications.unreadCount` key.

### Architecture

```text
AlertsScreen (app/(app)/alerts.tsx)
  ├── useNotifications(type?)        → TanStack useInfiniteQuery
  │     └── notifications.service    → GET /api/notifications?page=X&type=TYPE
  ├── useUnreadCount()               → TanStack useQuery
  │     └── notifications.service    → GET /api/notifications/unread-count
  ├── useMarkAsRead()                → useMutation → PUT /api/notifications/:id/read
  ├── useMarkAllAsRead()             → useMutation → PUT /api/notifications/read-all
  ├── useDeleteNotification()        → useMutation → DELETE /api/notifications/:id
  └── useDeleteAllNotifications()    → useMutation → DELETE /api/notifications/delete-all
```

No Axios or fetch calls in the screen. All API access funnels through `src/services/notifications.service.ts` → `src/api/client.ts`.

### Query keys

Centralized in `src/queryKeys.ts`:

```ts
notifications: {
  all:         ['notifications'] as const,
  list: (type) => ['notifications', 'list', type ?? 'all'] as const,
  unreadCount: ['notifications', 'unreadCount'] as const,
}
```

All mutations invalidate both `notifications.all` and `notifications.unreadCount` on success.

### Pagination

`useInfiniteQuery` with `initialPageParam: 1`. Next page when `currentPage < totalPages`. FlatList `onEndReached` triggers `fetchNextPage`. A "Se flere" button is also shown as footer. Backend returns `{ success, total, currentPage, totalPages, data }`. Default limit is 5 per page (server default).

### Category filters

Horizontally scrollable chips: Alle, Søknader, Betalinger, Meldinger, Anmeldelser, Jobber. Filters are sent as the `type` query parameter. Each filter change produces a new query key, resetting pagination.

### Unread filter

"Kun uleste" is a client-side filter over currently loaded pages. "Nullstill" resets both category and unread filters.

### Header

Title: "Varsler". When unread > 0: "X uleste varsler". Otherwise: "Alt er lest". Subtitle: "Alt som skjer med oppdragene dine, samlet her." "Merk alle som lest" button appears only when unread > 0.

### Mark single as read

PUT `/api/notifications/:id/read`. Fires via `mutateAsync` when an unread notification is tapped, before navigation. Failure is swallowed — navigation is never blocked.

### Mark all as read

PUT `/api/notifications/read-all`. Mutation `retry: false`. On success, invalidates list + unread count.

### Delete single

DELETE `/api/notifications/:id`. Uses ConfirmDialog with "Slett varsel?" / "Slett" / "Avbryt". Mutation `retry: false`.

### Delete all

DELETE `/api/notifications/delete-all`. Uses ConfirmDialog with "Slett alle varsler?" / "Slett alle personlige varsler? Denne handlingen kan ikke angres." / "Slett alle" / "Avbryt". Visually separated from filters (bottom of filter row, muted color). Mutation `retry: false`.

### System notification handling

Backend system notifications have `userId: null, isSystem: true, readBy: [userId]`. Current backend limitations:

- `markAsRead` sets global `read: true` on system notifications (shared state).
- `deleteNotification` returns 403 for system notifications.
- `deleteAllNotifications` only deletes personal notifications.

Mobile handles this:
- System notifications do NOT show the delete (trash) icon.
- The "Slett alle" action only deletes personal notifications.
- Copy says "Slett alle personlige varsler" to remain truthful.

The backend's `readBy` array is not exposed to mobile. Mobile relies on the `read` boolean from the API. This is a known backend limitation documented here.

### Order navigation

`resolveOrderRoute(order, userId)` in `src/utils/orderRoute.ts` handles role-aware routing:

- Customer + approvable status (`ready_for_review`, `completed`) → `/(app)/safepay/approval/:orderId`
- Customer + paid status → `/(app)/safepay/success/:orderId`
- Customer + unpaid → `/(app)/safepay/checkout/:orderId`
- Provider → `/(app)/provider/orders/:orderId`
- Unknown role → no navigation (shows error)

### Application navigation

If `notification.requestId` is populated, extracts `serviceId` (handles both string and populated object). Routes to `/(app)/job-applicants/:serviceId`.

### Message notification navigation

The backend Notification model does not persist `chatId` or `conversationId` — it only stores `senderId`. Direct chat deep-linking from a message notification is not reliably possible. Falls back to sender profile view.

### Realtime

`NotificationRealtime` component (mounted once in root layout) listens on the existing chat socket (`getChatSocket()`):

- `new_notification` → updates unread count from payload, invalidates notification list
- `notification_count` → updates unread count directly
- `connect` → refetches all (catches up after reconnect)

No second socket connection is created. The listener is attached once at app level and not duplicated per-screen.

### Pull-to-refresh

FlatList with `RefreshControl` using query `refetch`. Useful for cross-device status changes.

### Focus refresh

Stale time is 30 seconds on unread count. Socket realtime + pull-to-refresh provide freshness without aggressive polling.

### Empty states

- No notifications: "Ingen varsler ennå" / "Du får beskjed her når det skjer noe med oppdragene, søknadene eller betalingene dine."
- Filtered empty: "Ingen treff" / "Prøv en annen kategori, eller nullstill filtrene."

### Error state

"Vi fikk ikke hentet varslene dine." with "Prøv igjen" CTA. Does not clear auth.

### Notification row

Each row shows: sender avatar (or type icon fallback), category/type label, content (3 lines max), relative timestamp, unread dot, delete button. Whole row is tappable.

### Relative time format

"Nå" / "X min" / "X t" / "X d" / then date after ~1 week. Norwegian locale.

### Settings link

Bottom bar: "Varslingsinnstillinger" → `/(app)/profile/settings/notifications`.

### Files

**Created:**

- `app/(app)/alerts.tsx` — AlertsScreen
- `src/types/Notification.ts` — TypeScript types
- `src/services/notifications.service.ts` — API layer
- `src/hooks/useNotifications.ts` — TanStack Query hooks
- `src/utils/orderRoute.ts` — Mobile order routing
- `src/components/NotificationRealtime.tsx` — App-level socket listener

**Modified:**

- `src/queryKeys.ts` — Added `notifications.all`, `notifications.list(type)`, `notifications.unreadCount`
- `app/_layout.tsx` — Mounted `NotificationRealtime` in root layout
- `app/(app)/_layout.tsx` — Registered `alerts` as hidden tab
- `app/(app)/index.tsx` — Added bell icon with unread badge to home screen
- `MOBILE_FLOW.md` — This documentation section

### Push vs database notifications

Push notifications (`expo-notifications`) alert the device. Database notifications (`Notification` model) appear in this inbox. Both may fire for the same event. Mobile does NOT create push sends — that's backend-only. The inbox is purely a read-side view of the database notification collection.

## Change password

The password screen is `/(app)/profile/settings/password`, enabled from the settings overview. It sends `POST /api/auth/change-password/send-otp` with `{ currentPassword }`, then verifies with `POST /api/auth/change-password/verify-otp` using `{ otp, newPassword }`. Validation requires a current password, a new password of at least 8 characters containing lowercase, uppercase, and a digit, plus an exact confirmation match. OTP entry requires 6 digits; resend uses the same send endpoint after a 60-second countdown and keeps the current password local to the screen.

The backend stores the OTP for 10 minutes, rate-limits sending to 3 requests per 15 minutes and verification to 5 attempts per 10 minutes, then replaces the password and clears the OTP fields. It does not revoke or regenerate the current session, so mobile keeps the user signed in. Passwords and OTPs are never persisted or placed in query state.

## Addresses / Adresser settings

The canonical route is `/(app)/profile/settings/addresses`. Public URL path: `/profile/settings/addresses`. It is enabled from the settings overview row **Adresser** (group _Profil_, between _Rediger profil_ and _Jobbsøkerinnstillinger_) with subtitle _"Gateadresse, postnummer og sted"_ and icon `Home`. No duplicate route is created elsewhere.

### Reused profile PUT endpoint

No new API surface. The screen reuses the exact existing profile update chain:

```
AddressesScreen
  → useUpdateProfile (src/hooks/useProfile.ts)
      → updateCurrentProfile(userId, data) (src/services/profile.service.ts)
          → PUT /api/users/:id (src/api/client.ts, Authorization: Bearer token)
```

PUT payload is **only the three fields that differ from the server values**:

```json
{
  "address": "<trimmed gateadresse>",
  "postNumber": "<normalized digits only, max 4>",
  "postSted": "<trimmed city>"
}
```

Nothing else is ever sent: no country, no coordinates, no county/municipality/area job-location fields, no role, no subscription, no Stripe fields, no skills. Sparse payload — if only `postNumber` actually changed, only `{ postNumber }` goes over the wire.

### Backend contract verified

Backend route mounted: `backend/routes/users.js` → `router.put('/:id', authenticate, upload.fields([…avatar,banner…]), userController.updateUser)`.

Accepted fields in `userController.updateUser`'s `allowedUpdates` list (line 566) already includes `address`, `postNumber`, `postSted`. Ownership via `authorizeUser(req, id)` — only the caller themselves or a `superAdmin` can UPDATE; any other caller gets HTTP 403 `Not authorized`. Server remains authoritative: mobile passes its own userId in the path because the REST URL requires it, but the `authenticate` + `authorizeUser` guard means ownership cannot be bypassed by faking the `:id` param.

Model fields in `backend/models/User.js`:

```js
address:    { type: String, trim: true },      // declared twice (latter wins), plain string, optional
postNumber: { type: String, trim: true },      // STRING — never numeric, to keep leading zeros
postSted:   { type: String, trim: true },      // plain string, optional
```

All three are **optional** (`required: false` by default). Clearing them is allowed by sending empty strings through the existing profile-update flow; the schema does not convert empty strings to nulls, and the mobile screen therefore preserves that representation (empty string for cleared, not `null`).

### Postal code — string behavior

The `postNumber` field remains a **string at every layer** on purpose:

- Mongo schema: `type: String` (not `Number`).
- Backend controller: the minimal added normalization block casts to string, strips non-digits, caps to 4 chars — never calls `parseInt` / `Number`.
- Mobile state: `type Draft = { postNumber: string }`.
- Mobile TextInput: `keyboardType="number-pad"` so the numeric keyboard appears, but `onChangeText` pipes through `formatPostalCode(v) = digitsOnly(v, 4)` so state is always digits in a string.
- Live counter: `{draft.postNumber.length}/4`.

This keeps leading-zero Norwegian codes like **0150** (Oslo) intact. Numeric storage/modeling would silently collapse `0150 → 150` and corrupt the postal-code prefix buckets already used in `getTopUsers` (same file).

### Backend postal validation finding + minimal fix

**Audit result before the fix:**
The User schema declared `trim: true` on `postNumber` and `postSted`, but `updateUser` in `userController.js` performed **no normalization or validation** of postNumber whatsoever. A caller could submit arbitrary text (letters, spaces, `"01 50"`, `"N-0150"`), and Mongo would store exactly that because the schema is `type: String` with no `match:` regex. The web AddressesView and mobile both enforce digits-only on the client, but client validation is not security.

**Minimal server-side normalization applied (not a strict validator, to preserve existing data flexibility):**
Added a short block in `userController.updateUser` immediately after the `allowedUpdates` loop that, **if and only if `updates.postNumber` is actually being submitted**, runs:

```js
const raw = String(updates.postNumber);
const digits = raw.replace(/\D/g, '').slice(0, 4);
updates.postNumber = digits;
```

This is intentionally a **normalizer**, not a hard reject:

- Accepts empty / cleared postcode as empty string → field optional.
- Accepts `"0150"`, `"01 50"`, `"N-0150"` → all become `"0150"`.
- Capped at 4 chars, so `"01501"` → `"0150"`.
- Does **not** re-write existing documents: only runs when the UPDATE actually includes a `postNumber` key, so pre-existing profile data is untouched (no bulk migration risk).

Client still additionally shows a local validation toast _"Postnummer må være 4 siffer (f.eks. 0150)."_ whenever the user typed **something non-empty** that isn't yet 4 digits. Backend remains authoritative: even if that client guard were ever bypassed, the normalization block guarantees stored postNumber is digits-only.

### Current values — authoritative source

Draft seeds from the profile query (not Zustand local user storage alone):

```ts
profile.address    ?? ''         (text only — string)
profile.postNumber ?? ''         (STRING, never numeric)
profile.postSted                 — supports the legacy { city: string } shape
                                   (seen in CurrentProfile type) and unwraps
                                   it to .city, else falls back to raw string,
                                   else ''
```

`useProfile()` already hits `queryKeys.auth.profile` via `GET /auth/profile`.

### Save behavior

CTA button label: **Lagre adresser** (bottom sticky bar, so keyboard doesn't bury it; wrapped in `KeyboardAvoidingView` with `padding` on iOS).

Disabled when:

- nothing changed (tied to trimmed comparison, not raw, so trailing whitespace won't count as dirty).
- mutation is pending (renders **Lagrer...** with `Loader2` spinner).
- postNumber is non-empty yet invalid (client guard blocks save with the Norwegian message above).

No auto-save while typing — all changes must be committed by pressing **Lagre adresser**.

On success:

- `useUpdateProfile`'s existing `onSuccess` already does:
  `setQueryData(auth.profile)` + `invalidateQueries({ queryKey: queryKeys.auth.profile })` + syncs identity fields to Zustand. No extra invalidation needed; no global cache flush.
- Mobile screen additionally re-seeds `original` from the newly-trimmed/normalized values and shows an alert _"Adressene er lagret"_ before the user can navigate away.
- Discard (pressing back while dirty) shows the same two-choice Alert as Edit Profile: _Fortsett å redigere / Forkast_.

### Keyboard UX

| Field       | Keyboard                           | autoComplete               |
| ----------- | ---------------------------------- | -------------------------- |
| Gateadresse | default (letters + space + digits) | `street-address`           |
| Postnummer  | `number-pad` (only digit keys)     | `postal-code`, maxLength 4 |
| Sted        | default                            | `address-level2`           |

Sticky bottom Save button wrapped in `KeyboardAvoidingView` / `ScrollView` so it remains reachable on 360 / 375 / 390 / 393 / 414 / 430 dp widths. Inputs use the same floating-label visual as the current web `AddressesView`: label rendered absolutely above the value.

### Distinction from Location and Create Job location

Three separate flows, deliberately not merged:

**Addresses (this screen)** — profile-owned residential / business contact address:

- `address` + `postNumber` + `postSted`
- Own route `/profile/settings/addresses`
- Saves via PUT `/api/users/:id`
- No coordinates, no county codes.

**Location settings screen** — country / general profile location (already deferred placeholder row _Lokasjon_ under _Annet_):

- Owns `country` field only.
- Will not mix street/post/city fields into that screen.

**Create Job location** (used in `create-job.tsx`):

- Job-specific address _and_ `city` _and_ `countyCode` / `municipalityCode` / `areaCode` / `coordinates: [lat, lng]` for map display.
- Calls `expo-location`'s `Location.geocodeAsync(query)` for forward geocoding to resolve a pin on the job map.
- The address screen does **not** touch `countyCode`, `municipalityCode`, `areaCode`, `coordinates`, or the location-filter tree service.

### Interactive Google Map + live location + reverse geocoding

Mobile Addresses now ships an actual native interactive map — no placeholder, no WebView, no static image.

**Map implementation:**

- Installed `react-native-maps` (^1.29.0) and configured the Expo config plugin in `app.json` for `PROVIDER_GOOGLE` on Android and iOS.
- MapView uses explicit `h-72` (288 dp) container with `StyleSheet.absoluteFillObject` so the map can never collapse to zero height (the classic "invisible map" RN layout bug). `nestedScrollEnabled` and `keyboardShouldPersistTaps="handled"` on the outer ScrollView ensure pan/zoom/marker gestures are not swallowed by the parent scroll.
- Google provider is mandatory: `<MapView provider={PROVIDER_GOOGLE} … />`. No Apple Maps fallback on iOS.

**Google Maps API key — build-time configuration:**

- `app.json` plugins array declares:
  ```json
  [
    "react-native-maps",
    {
      "androidGoogleMapsApiKey": "$EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY",
      "iosGoogleMapsApiKey": "$EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY"
    }
  ]
  ```
- `.env` declares the two `EXPO_PUBLIC_GOOGLE_MAPS_*_KEY` variables (empty placeholders) — the developer must fill in real API keys restricted per-platform (Android: package `com.jobblo.app` + SHA-1; iOS: bundle `com.jobblo.app`). Never commit an unrestricted key.
- Because the config plugin writes the keys into the native manifest at prebuild time, **a fresh development/native build is required** after adding or changing the API keys. Restarting Metro alone does not pick up the native Google Maps SDK configuration.

**Foreground permission flow:**

- On mount the screen first calls `Location.getForegroundPermissionsAsync()` — it never auto-prompts. If already granted, it starts the flow silently; if denied, it surfaces the neutral Norwegian copy _"Posisjonstilgang er ikke aktivert. Du kan fortsatt skrive inn adressen manuelt."_ and never re-prompts on every render (guarded by `canAskAgain === false`).
- The explicit `Bruk min posisjon` CTA (pill button + floating crosshair FAB) is the **only** trigger for `Location.requestForegroundPermissionsAsync()` when permission is not yet granted. Double-tap during lookup is prevented by `locatingRef` plus `isLocating` disabled state.

**Live current location (GPS) vs selected address — two separate concepts:**

- `currentDeviceLocation` (LatLng state) — where the phone actually is right now. Populated by two channels:
  1. Initial `getCurrentPositionAsync({ accuracy: Balanced })` on mount when permission is granted (used only for the first camera auto-center).
  2. A foreground `Location.watchPositionAsync({ accuracy: Balanced, distanceInterval: 10, timeInterval: 5000 })` watcher that updates the blue dot while this screen is mounted.
- Watcher cleanup: effect-return calls `watcherRef.current?.remove()` and nulls the ref on unmount — no subscription leaks. No background location is ever requested.
- MapView additionally declares `showsUserLocation={true}` (only when permission is granted) so the native blue my-location dot renders directly from Google Maps SDK even if the JS-side watcher briefly lags.
- `selectedAddressLocation` (a Marker rendered separately) — the pin the user intends to save. It **never** auto-moves as the user walks. It is only updated by three deliberate user actions:
  1. Map tap (`onPress` → `handleMapPress`).
  2. Marker drag end (`draggable + onDragEnd` → `handleMarkerDragEnd`).
  3. Explicit "Bruk min posisjon" tap after a fresh GPS fix.
- Initial camera auto-center happens exactly once (first successful GPS lookup or first "Bruk min posisjon" success). After the user pans the map, the camera is never forced back to the live dot — only the dedicated FAB / button re-centers.

**Map tap / marker drag → reverse geocode → populate form:**

- Any deliberate coordinate change (tap, drag, GPS button) flows through `applyReverseGeocodeResult(coord)`, which calls `expo-location.reverseGeocodeAsync`. No backend Google Geocoding API is exposed in mobile code.
- Reverse-geocode fields are mapped defensively (any result may lack any property):
  - `address` ← `street + " " + name` with fallback to `street || name` only if truthy, never overwritten with empty string.
  - `postNumber` ← `hit.postalCode`, piped through the existing `formatPostalCode(digitsOnly, 4)` so `0150` stays `0150` (string, never numeric). Leading zeros preserved.
  - `postSted` ← `hit.subregion || hit.city || hit.region`, whichever is first non-empty.
- Failures in reverse geocoding (network, empty results, permission) are **silent** — the coordinate still updates on the map and the user can type manually. No error toast for geocoder misses.

**Form dirty state and save contract:**

- Reverse-geocoded writes go through the same `setDraft` reducer as manual edits, so `dirty = !same(draft, original)` correctly enables `Lagre adresser`. Nothing is auto-saved.
- Save still uses `useUpdateProfile` → `PUT /api/users/:id` with the exact sparse three-field payload from before (`address`, `postNumber`, `postSted`). No coordinates are ever sent to the User endpoint.
- On success, `useUpdateProfile`'s existing `onSuccess` already does `setQueryData + invalidateQueries(queryKeys.auth.profile)` — no extra cache flushing added.

**Manual fallback — always available:**

- The three TextInputs remain fully editable regardless of: permission denied, GPS disabled, Google Maps not loading, or reverse geocoding failing. Location permission is **not** a prerequisite for saving an address. `Keyboard.dismiss()` is called on map press to ensure the keyboard never obscures gestures.

**Layout order:** header card → (Gateadresse / Postnummer + Sted / Postal validation) → ("Velg adresse på kartet" card with MapView h-72 + floating crosshair FAB + "Bruk min posisjon" pill + helper/permission copy) → optional-addresses helper note → sticky bottom "Lagre adresser" CTA inside KeyboardAvoidingView.

### Files for Addresses

**Created:**

- `app/(app)/profile/settings/addresses.tsx` — Addresses screen (originally); updated now with Google Map, live GPS, permission flow, and reverse-geocoding.

**Modified (Addresses only):**

- `app/(app)/profile/settings/index.tsx` — added `Home` import + the `Adresser` row in group _Profil_.
- `backend/controllers/userController.js` — added the minimal postNumber normalization block inside `updateUser` (see "Postal validation" above).
- `package.json` — added `react-native-maps ^1.29.0` (previously absent).
- `app.json` — added `react-native-maps` config plugin with `$EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` / `$EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` placeholders.
- `.env` — added the two `EXPO_PUBLIC_GOOGLE_MAPS_*_KEY` placeholders (developer must fill real restricted keys).
- `MOBILE_FLOW.md` — this documented section.

No regressions on Create Job geocoding, phone, location, support, delete account, sessions, membership, subscription, SafePay, payout, chat, push, or auth isolation.

## Support / Kundesenter

The canonical mobile route is `/(app)/profile/support`, reachable from the settings overview row **Kundesenter** (group _Annet_). Public URL path: `/profile/support`. No duplicate route under `/(app)/profile/settings/support` is created.

### Backend contract

Mount point verified in `backend/app.js` at line 277: `app.use('/api/support', require('./routes/support'))`.

- **POST /api/support/tickets** — middleware `optionalAuthenticate`. Open to logged-out visitors (who must supply `email`), and recognises a signed-in Bearer token through `req.userId` so the backend looks up the account email from the `User` model. Authenticated mobile does **not** send `email`, `userId`, `orderId`, or status fields.
- **GET /api/support/tickets/mine** — middleware `authenticate`. Returns the current user's tickets descending by `createdAt`, limited to 50. Projected fields: `subject`, `message`, `status`, `createdAt`, plus the Mongo `_id`.

Backend validation enforced in `supportController.createTicket`:

- `subject`: required, trimmed, **max 200 chars**.
- `message`: required, trimmed, **max 5000 chars**.
- Anonymous `email`: required, must match `EMAIL_RE` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
- For authenticated callers the controller explicitly overwrites any client-supplied `email` with `User.findById(req.userId).select('email').lean()`, so a mobile user **cannot** hijack the reply address by typing a different one.

### Optional-auth behaviour for Bearer tokens from mobile

`api/client.ts` attaches `Authorization: Bearer <token>` on every request. The backend `optionalAuthenticate` short-circuits when no token is present, otherwise reuses `authenticate` against a silent stub response. Result: a valid, non-revoked token sets `req.userId` and the ticket is bound to the account; an expired, revoked or malformed token degrades the request to anonymous (no 401). Because this screen lives behind the authenticated profile area, the normal case is `req.userId` set and the account email used by the backend.

### Response / success

`POST /api/support/tickets` returns **HTTP 201** with:

```json
{
  "message": "Saken din er registrert. Vi svarer normalt innen 24 timer.",
  "ticketId": "<Mongo ObjectId>"
}
```

The mobile success UI prefers `data.message` from the server response when available and falls back to the same text otherwise.

### Mobile architecture

```
SupportScreen (/(app)/profile/support)
├── useCreateTicket  (mutation)  →  support.service.createTicket
│                                           ↓  POST /api/support/tickets
│                                           ↓  retry: false (no auto-retry)
│                                           ↓  onSuccess → invalidate queryKeys.support.mine
└── useMyTickets      (query)    →  support.service.getMyTickets
                                            ↓  GET /api/support/tickets/mine
                                            ↓  queryKeys.support.mine
```

Service layer lives at `src/services/support.service.ts` and exports:

- `createTicket({ subject, message }): Promise<{ message, ticketId }>`
- `getMyTickets(): Promise<SupportTicket[]>` with fields `_id`, `subject`, `message`, `status`, `createdAt`.
- Type aliases `SupportTicket`, `SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'`.

Hooks live at `src/hooks/useSupport.ts`:

- `useCreateTicket()` — mutation, `retry: false` to avoid accidental duplicate tickets, invalidates `queryKeys.support.mine` on success.
- `useMyTickets()` — read-only query.

No Axios/fetch calls happen inside the screen; everything funnels through the service and `api/client.ts`.

### FAQ — static, local content

FAQ is stored as a local `FAQ_ITEMS` constant inside the screen file (not TanStack Query, not a network call). Behaviour:

- Accordion (one expanded at a time) using local state `openFaqId`.
- Live client-side search over `question + answer + search` keywords, case-insensitive.
- Six questions matching the current web SupportPage, with one wording correction:
  - **Q6 "Hvordan sier jeg opp abonnementet?"** — the web used "Gå til Jobblo medlemskap"; mobile corrects this to **"Gå til Innstillinger → Abonnementer"** because the subscription cancellation screen is `/(app)/profile/settings/subscription`, matching the existing web split between `Medlemskap` (plan purchase) and `Abonnementer` (current subscription cancel/resume).
- No fake claims: no instant refunds, no guaranteed 24/7 response, no live chat, no phone number. Every promise is hedged with _"normalt"_.

### Support email

Only real channel that reaches a human:

- Address: **support@jobblo.no**
- CTA button uses `Linking.openURL('mailto:support@jobblo.no')`
- No Live Chat, no phone, no WhatsApp — same truthful channel set as the current web page (which removed the fake chat toast and placeholder +47 number).

### Ticket form (authenticated)

Because the screen opens from the authenticated profile/settings area, the form deliberately has **no email field** and instead shows a subtle line: _"Vi svarer til e-postadressen på Jobblo-kontoen din."_

Fields and constraints (mirrored UX, backend remains authoritative):

- **Emne** (TextInput, maxLength=200) — placeholder _"Kort beskrivelse av problemet"_ with live `subject.length/200` counter.
- **Melding** (TextInput, multiline, maxLength=5000, minHeight 140, textAlignVertical top) — placeholder _"Beskriv problemet ditt i detalj..."_ with live `message.length/5000` counter.
- Submit CTA button uses the existing reusable `Button` component (primary variant). Label flips to **Sender ...** while `createTicket.isPending`; button is disabled during pending or when subject/message are blank after trim.

Submission flow:

1. Client-side guard for empty subject/message → inline `submitError`.
2. On HTTP 201 success → show success card with `CheckCircle2` icon, server message, and a **Send en ny sak** link that resets local form state. Success is only shown **after** the network call resolves.
3. On error → extract `response.data.error` from the Axios error to surface the Norwegian backend validation text (subject empty, subject over 200 chars, anonymous email invalid, etc.), otherwise fall back to _"Kunne ikke sende saken. Prøv igjen."_
4. Mutation has `retry: false`; a failed POST is manually retried by the user tapping **Send sak** again — no automatic rapid retries that risk duplicate tickets.

A 401 from the global Axios interceptor clears the token in storage, but the screen itself never calls `authStore.logout` on ticket failure — session revocation is owned by the central auth layer and not triggered here.

### Mine saker (read-only list)

Implemented. Because `GET /api/support/tickets/mine` already exists in the backend and is a natural mobile affordance, a simple **Mine saker** card appears after the form. It is deliberately **read-only**:

- No reply / comment thread UI (no backend endpoint for replies).
- No edit / close / delete actions (no backend endpoints).
- No invented fields (no priority, no assignedAgent, no replyETA, no category).

Displayed per ticket:

- `subject` (bold, 2 lines max)
- `message` preview (muted, 2 lines max)
- `createdAt` formatted via `toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })`
- `status` badge using the real model enum only

Status → Norwegian label and colour class:

- `open` → **Åpen** (neutral gray pill)
- `in_progress` → **Behandles** (amber pill)
- `resolved` → **Løst** (green pill)
- `closed` → **Lukket** (faded white-border pill)

Loading shows `LoadingIndicator`; load error shows inline _"Kunne ikke hente sakene dine akkurat nå"_ with a local **Prøv igjen** pressable that calls `refetchTickets`; empty state shows _"Du har ikke sendt noen saker ennå."_.

After a successful ticket creation, the mutation's `onSuccess` calls `queryClient.invalidateQueries({ queryKey: queryKeys.support.mine })` so the new ticket appears in the list. No unrelated queries (auth, chat, SafePay, etc.) are touched.

### Rate limiting

The support routes themselves do not declare a per-route rate-limit middleware; protection comes from the global `apiLimiter` mounted in `backend/app.js`. Mobile cooperates by using `retry: false` on the create mutation.

### Settings row enabled

Only one row was enabled in `/(app)/profile/settings/index.tsx`, under the **Annet** group (added before Lokasjon / Om Jobblo / Slett profilen min):

- **Kundesenter** / subtitle _"FAQ, e-post og saksregistrering"_ / icon `HelpCircle` → navigates to `/(app)/profile/support`.

No other settings rows were enabled or removed. No Privacy, Blocked users, E-post/telefon, or About page was built.

### Files created vs modified

**Created:**

- `app/(app)/profile/support.tsx` — Support / Kundesenter screen.
- `src/services/support.service.ts` — API layer (POST ticket, GET mine, types).
- `src/hooks/useSupport.ts` — `useCreateTicket` (mutation, retry: false) + `useMyTickets` (query).

**Modified:**

- `app/(app)/profile/settings/index.tsx` — Added HelpCircle import and the working **Kundesenter** settings row.
- `src/queryKeys.ts` — Added `queryKeys.support.mine` query key.
- `MOBILE_FLOW.md` — Implementation status ✅ Support + this documented section.

### Remaining deferred / not implemented

- Anonymous/public Support route — not built. The task scope was the authenticated Profile/Settings area only.
- Reply/comment thread on a ticket — no backend endpoint.
- Ticket edit / close / delete actions — no backend endpoints.
- Per-ticket orderId injection on this generic Support page — intentionally omitted; a future _"Kontakt support om denne ordren"_ on SafePay/order detail screens can pass `orderId` in the service layer when needed.
- Ticket pagination — backend returns up to 50 most recent; mobile shows that flat list.

## Søkere og søknader overview

The mobile overview uses one shared shell with two tabs:

```text
Søkere og søknader
├── Mine søkere
│   ↓
│   useMyApplicantsOverview
│   ↓
│   applicants.service
│   ↓
│   GET /api/applicants/my/overview
│
└── Mine søknader
   ↓
   useMyApplications
   ↓
   applications.service
   ↓
   GET /api/my-applications
```

### Mine søkere

The owner overview uses the authenticated `GET /api/applicants/my/overview` response directly through TanStack Query. The response is an array of `ApplicantOverviewService` values with:

- `_id`, `title`, `price`, `status`, `location`
- `applicantCount`, `applicantAvatars`, `createdAt`, `updatedAt`, `lastActivity`
- `categories`, `fromDate`, `toDate`
- `selectedWorker` with `_id`, `name`, and optional `avatarUrl`
- `order` with `_id`, `status`, `paymentStatus`, and optional `agreedPrice`

Header stats are derived from the response: `totalApplicants` sums `applicantCount`, while `needsAttention` counts services with applicants and no `selectedWorker`. Search is client-side over title, selected worker name, and categories. Application status filters are only rendered on Mine søknader.

Each service card shows the Briefcase icon plate, service status, the `Velg utfører` action badge when `applicantCount > 0 && !selectedWorker`, title, created date, city, price, up to three applicant avatars, the correctly pluralized applicant count, and the selected-worker row when present. The card navigates to the mobile `/job-applicants/[serviceId]` detail route.

Owner loading uses the reusable overview row skeleton. Request failures use `Kunne ikke laste`, the server-connection explanation, and `Prøv igjen`. Empty owner data uses `Ingen søkere ennå`; a client-side search miss uses `Ingen treff`.

### Implementation map

- Screen: `app/(app)/my-applications.tsx`
- Shared tabs: `src/components/domain/OverviewTabs.tsx`
- Owner card: `src/components/domain/ApplicantServiceCard.tsx`
- Status primitive: `src/components/domain/ServiceStatusBadge.tsx`
- Avatar stack: `src/components/domain/ApplicantAvatarStack.tsx`
- Loading row: `src/components/domain/ApplicantOverviewSkeleton.tsx`
- Query: `src/hooks/useMyApplicantsOverview.ts`
- Service: `src/services/applicants.service.ts`
- Types: `src/types/Applicants.ts`
- Query key: `queryKeys.applicants.overview`

Provider selection, SafePay, Contract, and downstream flows remain outside the owner overview implementation.

## Meldinger / Chat Detail

The mobile conversation list is `/(app)/messages`, backed by `GET /api/chats/get` through `useMessages` and `messages.service.ts`. Rows show the other participant, avatar/initials, latest message, timestamp, unread indicator from the backend latest message `seenBy`, and service context. Rendering does not mark messages read; there is no mobile read mutation in this flow.

The canonical detail route is `/(app)/messages/[chatId]`. It uses `queryKeys.chats.detail(chatId)` and `useChatDetail` with `GET /api/chats/:chatId?limit=50&offset=...`. The backend `messagePage.hasMore` value drives older-page loading; pages are merged oldest-to-newest with message-ID/fallback deduplication. Sending uses `POST /api/chats/:chatId/message` with `{ text }`, clears the composer on success, and invalidates both detail and list keys.

Chat detail joins `join-chat` and leaves `leave-chat` using the shared Socket.IO client wrapper; it removes only its own `receive-message` listener. It renders text and system messages with timestamps, uses authenticated participant identity for own/other bubbles, and routes job context role-aware: customers use SafePay checkout/success/approval boundaries while providers use `/provider/orders/:orderId`. Attachments and persistent read marking are not implemented because this mobile flow has no corresponding user-facing send/read contract.

## Job Applicants detail

### Flow

```text
Mine søkere
↓
tap service card
↓
app/(app)/job-applicants/[serviceId].tsx
↓
useApplicants(serviceId, sort, filter)
↓
src/services/applicants.service.ts
↓
GET /api/applicants/:serviceId
```

The endpoint verifies that the authenticated user owns the service. The mobile screen preserves separate error states for unauthorized access, a missing job, and server/network failure rather than treating them as an empty applicant list.

The typed response contains:

- `service`: `_id`, `title`, `price`, `location`, `status`, `date`, and `duration`
- `applicants`: request `_id`, `status`, `message`, `appliedAt`, `favorite`, `archived`, and the populated applicant profile
- applicant profile: `_id`, `name`, optional `avatarUrl`, `verified`, `skills`, `locations`, `rating`, `reviewCount`, `completedJobs`, and nullable `responseRate`
- `activeOrder`: nullable `_id` and `status`

Sort values are `createdAt`, `rating`, `completedJobs`, and `favorites`. Filter values are `notArchived`, `favorites`, and `archived`. They are sent as query parameters through the service layer and cached with `queryKeys.applicants.detail({ serviceId, sort, filter })`.

The detail card shows only backend-backed data: avatar or initials fallback, verified state, skills, rating, review count, completed jobs, response rate, locations, application message, applied date, application status, favorite state, and archived state. Favorite, archive, and decline use their existing PATCH endpoints and invalidate the applicant-detail query family. A decline error with status 409 is surfaced as an active-contract warning.

The response `activeOrder` prevents duplicate contract creation and changes the action to the current existing-order destination: `Gå til betaling`, `Betalt`, `Se godkjenning`, or `Se aktiv kontrakt`. Without an active order, `Velg og start SafePay` calls `POST /api/safepay/create-contract` with `serviceId`, `applicantId`, and `requestId`, then navigates to the checkout boundary using the returned `orderId`.

### Job Applicants implementation map

- Route: `app/(app)/job-applicants/[serviceId].tsx`
- Card: `src/components/domain/ApplicantCard.tsx`
- Query hook: `src/hooks/useApplicants.ts`
- Service: `src/services/applicants.service.ts`
- Types: `src/types/Applicants.ts`
- Query keys: `queryKeys.applicants.detailRoot` and `queryKeys.applicants.detail`
- Selector: `src/components/ui/Select.tsx`
  Compare section: `src/components/domain/ApplicantCompareSection.tsx`
  SafePay sections: `src/components/domain/SafePayProgressSteps.tsx`
  Chat mutation: `src/hooks/useCreateOrGetChat.ts`

Favorite, archive, and decline remain on the detail page. Compare is local-only and limited to three applicants. `Send melding` calls `POST /api/chats/create` with `{ providerId: applicantId, serviceId }`, disables while pending, and navigates to `/messages/:chatId` on success.

SafePay checkout, payment status, approval, contract view, chat UI, provider work, and all later lifecycle screens are navigation boundaries only and remain the next implementation scope.

## SafePay Checkout

```text
Job Applicants
↓
Velg og start SafePay
↓
POST /api/safepay/create-contract
↓
order.awaiting_payment + orderId
↓
app/(app)/safepay/checkout/[orderId].tsx
↓
useSafePayCheckout(orderId)
↓
GET /api/safepay-checkout/details/:orderId
↓
POST /api/safepay-checkout/create-session
↓
Stripe browser checkout
↓
GET /api/safepay-checkout/status/:sessionId
↓
server confirmation / webhook
↓
order.paid + service.paid
↓
customer waits for provider
↓
provider sees paid and can start
```

**STATIC VERIFIED — MANUAL STRIPE RUNTIME REQUIRED**

Contract selection sends `{ serviceId, applicantId, requestId }` as three non-empty string IDs. The backend creates the order, accepts the selected application, declines other pending applications, marks the service `awaiting_payment`, and links the chat when available. Mobile does not duplicate those side effects. A successful response must contain a non-empty string `orderId` before checkout navigation.

The checkout response is typed as `{ order, calculation }`. `order` contains the populated service, customer, provider, status, payment status, agreed price, and checklist data. `calculation` is rendered directly from the backend as `basePrice`, `fee`, `total`, and `providerNet`; the mobile UI does not recalculate payment values.

The screen handles invalid orders, missing contracts, unauthorized access, server errors, deleted services, customer view, provider view, and unrelated-user access. Providers see `Betaling håndteres av oppdragsgiver` and a boundary to their order; unrelated users see only `Ikke tilgang` without contract or payment data.

The customer payment flow is:

```text
Payment CTA
↓
useCreateSafePaySessionMutation
↓
POST /api/safepay-checkout/create-session
↓
backend-provided Stripe URL
↓
Linking.openURL(url)
↓
app becomes active
↓
refetch checkout details and payment status
```

The response supports `{ url }` and `{ url, reused: true }`; a reused open Stripe session is valid and is opened directly. A missing URL and backend errors are shown to the customer; a `409` refetches checkout details. Payment is never marked paid locally. Settled state is read from `paymentStatus` and server-owned paid lifecycle statuses.

The backend builds Stripe success and cancel URLs from `FRONTEND_URL`, so mobile does not claim a native deep-link return. Returning to or resuming the app refetches server state. The canonical confirmation path is `GET /api/safepay-checkout/status/:sessionId`, which calls the shared idempotent confirmation path; the Stripe webhook can confirm the same session independently. Mobile does not call the separate order-level `POST /api/safepay/orders/:orderId/reconcile-payment` endpoint.

### SafePay Checkout implementation map

- Route: `app/(app)/safepay/checkout/[orderId].tsx`
- Public runtime URL: `/safepay/checkout/:orderId` (the `(app)` group is not part of the URL)
- Query and mutation hook: `src/hooks/useSafePayCheckout.ts`
- Service: `src/services/safepay.service.ts`
- Types: `src/types/SafePay.ts`
- Query key: `queryKeys.safepay.checkout(orderId)`
- Sections: `src/components/domain/SafePayCheckoutSections.tsx`

## SafePay Success / Payment Verification

The canonical mobile route is `app/(app)/safepay/success.tsx`. The old dynamic
`app/(app)/safepay/success/[orderId].tsx` path now forwards to it, so there is one payment-status implementation.

```text
SafePay Success
├── session_id
│   ↓
│   useSafePaySessionStatus
│   ↓
│   GET /api/safepay-checkout/status/:sessionId
│
└── orderId
   ↓
   useSafePayCheckout
   ↓
   GET /api/safepay-checkout/details/:orderId
```

The screen derives only four states: `verifying`, `paid`, `pending`, and `unverified`. A session is paid only when the backend status response says `payment_status: 'paid'`; an order fallback is paid only when `paymentStatus` is `paid` or the exact current SafePay Success statuses are `paid`, `in_progress`, `ready_for_review`, or `completed`. The backend status endpoint owns `confirmPaidSession`, idempotency, Payment creation, notifications, and order updates. Mobile performs none of those side effects and never sets paid state locally.

Without a session ID, a valid `orderId` is sufficient for server-backed verification. When the status response supplies an `orderId`, it is reused for the checkout-details query. Pending state shows `Betalingen er ikke fullført`, `Sjekk på nytt`, and `Gå til betaling`; unverified state never claims that payment failed. `alreadyConfirmed: true` is treated as a successful reconciliation result.

On server confirmation, the order and service become `paid`; payment records, chat system messages, notifications, and socket events remain backend-owned. The mobile app only invalidates checkout, applicant, overview, application, and provider-order caches.

Paid success uses SafePay step 3, the customer/provider-specific explanation, SafePay protection copy, and role-aware continuation: providers get `Gå til aktiv jobb`, customers wait while the order is `paid` or `in_progress`, and customers get approval-boundary actions only for `ready_for_review` or `completed`. The combined overview CTA selects `mine-søkere` for customers and `mine-søknader` for providers.

Stripe currently redirects to web URLs generated from `FRONTEND_URL`, not directly to Expo. The mobile checkout opens the backend URL externally; returning to the app refetches server state. No deep link or local payment success is invented. SafePay Approval remains a separate boundary.

## SafePay Approval

The canonical customer route is `app/(app)/safepay/approval/[orderId].tsx` and resolves to `/safepay/approval/:orderId` at runtime.

The detail query remains `GET /api/safepay-checkout/details/:orderId`, and the customer approval screen is server-driven. The customer sees provider proof-of-work before approval, including the completion note, before/after image grids, and safe PDF tiles that open via native URL handling. If there is no evidence at all, the screen shows the neutral empty-state copy while still allowing approval when the server status is `ready_for_review` and no active dispute exists.

Checklist edits are restricted to the exact backend lifecycle window: `paid`, `in_progress`, and `ready_for_review`, and they are locked while an active dispute exists. On a `409` conflict, the screen refetches the server order and surfaces the backend-safe lock message without keeping stale optimistic state.

The review form includes the full customer rating set: `overall` required, optional `punctuality`, `quality`, `communication`, and `tidiness`, with comment length capped at 1000 characters. `recommendWorker` remains user-editable via a native switch, and the final `approve` request sends Cloudinary review-photo URLs rather than base64. The final payload is:

```json
{
  "orderId": "...",
  "ratings": {
    "overall": 5,
    "punctuality": 4,
    "quality": 5,
    "communication": 4,
    "tidiness": 5
  },
  "comment": "...",
  "photos": ["https://..."],
  "recommendWorker": true
}
```

On successful approval, the screen presents either the normal payout success state (`Jobben er godkjent`) or the payout-warning state (`Godkjent — men utbetalingen stoppet`) with the backend warning text and the `Ikke utbetalt ennå` status label. Reopening an already-completed order renders the completed summary from the server status instead of relying on local mutation success.

### Final approval and payout result

**STATIC VERIFIED — MANUAL STRIPE/PAYOUT REQUIRED**

```text
Provider: ready_for_review
↓
Customer: SafePay Approval
↓
server proof-of-work and checklist data
↓
customer review and remote review-photo URLs
↓
POST /api/safepay-checkout/approve
↓
order.completed + service.completed
├── payout success → neutral completed state plus backend payout notification
└── payoutWarning → approval still completed, payout remains pending
```

The approval mutation invalidates `safepay.checkout(orderId)`, `providerOrders.detail/order`, `providerOrders.reviews`, `applicants.overview`, applicant detail, applications, and the auth profile key. A lost approval response refetches checkout details before deciding whether to show completed or leave a deliberate retry available; it never retries approval automatically. Both customer and provider final screens derive completion from the server order state.

## Provider Active Job / Provider Work

The existing provider-order boundary is now the real mobile Provider Work page:

```text
SafePay paid
↓
/provider/orders/:orderId
↓
useProviderOrder(orderId)
↓
GET /api/safepay/orders/:orderId
```

### Provider paid-to-review lifecycle

**STATIC VERIFIED — MANUAL DEVICE REQUIRED for image/PDF runtime upload**

| Transition         | Role     | Route                       | Endpoint                                                        | Server before                                | Server after                                             | Targeted invalidation                                                        |
| ------------------ | -------- | --------------------------- | --------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Start job          | Provider | `/provider/orders/:orderId` | `POST /api/safepay/orders/:orderId/start`                       | `paid`, payment `paid`                       | Order `in_progress`, service `in_progress`               | Provider order, checkout, applications, applicant detail, applicant overview |
| Provider checklist | Provider | `/provider/orders/:orderId` | `PATCH /api/safepay/orders/:orderId/provider-checklist/:itemId` | `paid`, `in_progress`, or `ready_for_review` | Server checklist fields updated                          | Same targeted lifecycle caches                                               |
| Evidence/note      | Provider | `/provider/orders/:orderId` | `POST /api/safepay/orders/:orderId/evidence`                    | `paid` or `in_progress`                      | Server evidence URLs and optional completion note        | Same targeted lifecycle caches                                               |
| Remove evidence    | Provider | `/provider/orders/:orderId` | `DELETE /api/safepay/orders/:orderId/evidence`                  | `paid` or `in_progress`                      | Server evidence URL removed                              | Same targeted lifecycle caches                                               |
| Ready for review   | Provider | `/provider/orders/:orderId` | `POST /api/safepay/orders/:orderId/ready-for-review`            | `in_progress`, payment `paid`                | Order `ready_for_review`, service `waiting_for_approval` | Same targeted lifecycle caches                                               |

The provider screen never assigns lifecycle status locally. Start, checklist, evidence, deletion, and ready-for-review mutations all refetch the server-owned provider order and invalidate the relevant application, applicant overview/detail, and SafePay checkout keys. The customer’s next server-backed action is `/safepay/approval/:orderId` once the order is `ready_for_review`.

Evidence uses React Native multipart parts with `{ uri, name, type }`. Picker selection is capped at 10 files per evidence type after accounting for existing server files; each file is checked against the 10 MB limit and JPEG, PNG, WebP, and PDF MIME types. Before and after counts remain independent. Evidence and destructive controls are hidden after review lock.

The page uses `queryKeys.providerOrders.detail(orderId)` and typed `ProviderOrderResponse` data containing `order`, `calculation`, `isProvider`, `isCustomer`, and `activeDispute`.

Lifecycle actions remain server-owned:

- `paid` → `POST /api/safepay/orders/:orderId/start` → `in_progress`
- `paid` / `in_progress` → `PATCH /api/safepay/orders/:orderId/provider-checklist/:itemId`
- `paid` / `in_progress` → `POST /api/safepay/orders/:orderId/evidence` with `before` or `after`
- `paid` / `in_progress` → `DELETE /api/safepay/orders/:orderId/evidence`
- `in_progress` → `POST /api/safepay/orders/:orderId/ready-for-review` → `ready_for_review`

The mobile page uses Expo Image Picker and Document Picker for native evidence selection. It sends real URI, filename, and MIME type values as multipart data, respects the backend’s 10 MB and 10-files-per-type limits, renders before/after evidence, and locks evidence after review starts. No browser `File`, `FileList`, object URLs, or local lifecycle status mutation is used.

Provider status copy matches the current web semantics: payment waiting, paid and ready to start, job in progress, reported finished, completed, disputed, refunded, and cancelled. Active disputes block start and ready-for-review and show the dispute state. Provider dispute creation uses `/api/safepay/contract/:orderId/dispute`. Completed orders expose the provider review form through `/api/orders/:orderId/review` and `/api/reviews`.

The canonical mobile provider route is `app/(app)/provider/orders/[orderId].tsx`, with public runtime URL `/provider/orders/:orderId`. SafePay Success, Checkout, and Mine søknader provider actions target this same route. Customer approval remains the next separate flow.

### Provider Work implementation map

- Route: `app/(app)/provider/orders/[orderId].tsx`
- Query/mutations: `src/hooks/useProviderOrder.ts`
- Service: `src/services/providerWork.service.ts`
- Types: `src/types/ProviderOrder.ts`
- Query keys: `queryKeys.providerOrders.detail`, `queryKeys.disputes.byOrder`, `queryKeys.providerOrders.reviews`
- Native dependencies: `expo-image-picker`, `expo-document-picker`

### SafePay Success implementation map

- Canonical route: `app/(app)/safepay/success.tsx`
- Legacy redirect: `app/(app)/safepay/success/[orderId].tsx`
- Hook: `src/hooks/useSafePayCheckout.ts`
- Service: `src/services/safepay.service.ts`
- Status key: `queryKeys.safepay.status(sessionId)`

## Job Details

Screen:
File: app/(app)/jobs/[id].tsx
Route: /(app)/jobs/[id]
Purpose: Display a single job/service page matching the responsive web Job Details implementation, with loading, error, not-found, and role-aware CTA states. This task is intentionally scoped to detail display only; the apply flow remains deferred.

Web source inspected:

- frontend/src/pages/JobListingDetailPage/JobListingDetailPage.tsx
- frontend/src/features/jobDetail/hook.ts
- frontend/src/features/jobDetail/jobApi.ts
- frontend/src/components/job/JobButton.tsx
- frontend/src/components/job/RelatedJobs.tsx

Responsive design source of truth:

- 360–430px mobile viewport behavior on the web Job Details page
- Section order and visual rhythm from the responsive desktop-to-mobile layout
- Norwegian labels, price and location presentation, CTA states, badge styling, and metadata rows

Component hierarchy:

- app/(app)/jobs/[id].tsx
  - LoadingIndicator / ErrorState / EmptyState
  - JobMetaRow
  - categoryIcons mapping for category chips
  - Job poster/customer card
  - CTA footer with login/owner/closed guard

Reusable mobile components used:

- src/components/JobCard.tsx
- src/components/domain/JobMetaRow.tsx
- src/components/ui/LoadingIndicator.tsx
- src/components/ui/ErrorState.tsx
- src/components/ui/EmptyState.tsx
- src/utils/categoryIcons.ts

Query hook:

- src/hooks/useJobDetails.ts

Hook implementation:

```ts
export function useJobDetails(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => jobsService.getJob(jobId),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
```

Query key:

- queryKeys.jobs.detail(jobId)

Service:

- src/services/jobs.service.ts

Endpoint and contract:

- METHOD: GET /api/services/:id
- Route from frontend: /api/services/${id}
- API client: src/api/client.ts
- Response is resolved as either `response.data.data`, `response.data.job`, or the raw response object, matching backend variations

Verified response fields used:

- _id
- userId
- title
- description
- price
- hourlyRate
- paymentType
- location
- duration
- categories
- images
- urgent
- promoted
- favCount
- status
- tags
- equipment
- createdAt
- updatedAt
- checklist
- fromDate / toDate

Authentication and CTA logic:

- Logged-out user: CTA directs to the login flow via router.push('/(auth)/login')
- Job owner: CTA is presented as owner state and disabled from applying
- Closed/completed/cancelled/expired job: CTA is disabled and shows closed state
- Non-owner and active job: CTA remains available for the next flow, but no apply request is executed in this task

Navigation relationships:

- Home -> JobCard -> /jobs/[id]
- Explore/Search -> JobCard -> /jobs/[id]
- Shared route: /(app)/jobs/[id]
- Not duplicated into home-only or explore-only detail routes

Future Apply boundary:

- The current Job Details task only prepares the correct action boundary, the route, and CTA guard states.
- The actual apply mutation/API is explicitly deferred until the Apply task.

### Job Details change history

- Verified the existing detail route and hook already existed in the mobile app.
- Audited the current implementation against the responsive web Job Details page rather than rebuilding from scratch.
- Reused the existing TanStack Query detail hook, service method, and query key structure.
- Kept the web’s visible structure: hero image/gallery, category/status badges, title, price, location, description, detail rows, poster card, CTA footer, and not-found/error/loading states.
- Kept JobCard route navigation centralized to the single shared dynamic job detail screen.
- Kept the apply action intentionally non-functional until the later Apply task.

---

## Login

Screen:
File: app/(auth)/login.tsx
Route: /(auth)/login
Purpose: Authenticate a returning Jobblo user with email and password, while matching the existing web login UX and validation rules.

Components:

- Wordmark
- SocialButton
- LoginScreen

Query/Mutation hooks:

- useLoginMutation

Services:

- auth.service.ts

API:
METHOD: POST /api/auth/login

Request:
{
email: string,
password: string
}

Response:
{
user: object,
accessToken: string
}

Authentication:

- Stores the JWT in AsyncStorage via the auth store
- Keeps the authenticated user object in persisted state
- Uses the centralized API client which adds the token to requests

Role:

- Public auth screen; no role gating for login itself

Navigation From:

- App entry / authenticated redirect route when the user is signed out

Navigation To:

- Redirects to the app home route after successful login

File relationships:
LoginScreen.tsx
↓
useLoginMutation.ts
↓
auth.service.ts
↓
api/client.ts
↓
POST /api/auth/login

Query:

- auth.profile

Used by:

- login success flow only

Invalidated by:

- login success

### Login change history

- built the native login UI to match the current web design
- connected the real email/password login endpoint
- added client-side validation matching the backend requirements
- added loading and error states
- persisted the access token and user in AsyncStorage
- verified the auth path uses the centralized API layer

## Home

Screen:
File: app/(app)/index.tsx
Route: /(app)/ (default tab route)
Purpose: Display the authenticated user's home feed with featured job listings, category browsing, and personalized greeting. Matches the web `/home` route which displays `JobListingPage`.

Components:

- HomeScreen (app/(app)/index.tsx) — main home screen with greeting, categories, and job list
- JobCard (src/components/JobCard.tsx) — reusable mobile job card displaying photo, title, price, location
- CategoryChip (src/components/CategoryChip.tsx) — reusable category filter chip with icon and label (shared with Explore)

Query/Mutation hooks:

- useJobs (src/hooks/useJobs.ts) — fetches jobs with optional filters and pagination
- useCategories (src/hooks/useCategories.ts) — fetches categories with icons from /api/filter/options

Services:

- jobs.service.ts — centralized API calls for job discovery
- categories.service.ts — fetches available categories with icons from /api/filter/options
- auth.service.ts — uses stored user data for personalization

API:
METHOD: GET /api/services

Query Parameters:

- page (number): pagination page, defaults to 1
- limit (number): items per page, defaults to 8 on Home
- category (string, comma-separated): filter by category names
- sort (string): sort key from ['newest', 'price_low', 'price_high']
- search (string): search query
- urgent (boolean): filter urgent jobs
- lat/lng/radius (number): geographic filtering

Request:
GET /api/services?page=1&limit=8&sort=newest

Response:
{
data: [
{
_id: string,
title: string,
description: string,
price: number,
location: { city: string, address: string, coordinates: [lng, lat] },
images: string[],
categories: string[],
urgent: boolean,
promoted: boolean,
status: 'open' | 'closed' | ...,
userId: string,
createdAt: string,
...
}
],
pagination: {
total: number,
totalPages: number,
page: number,
limit: number
}
}

Response fields used:

- _id: unique job identifier
- title: job title
- description: job brief
- price: fixed price (displayed as "X kr")
- location.city: city name for location badge
- images[0]: photo for card (4:5 aspect)
- categories: job category tags
- urgent: shows "Haster" badge in red
- promoted: shows "Sponset" badge in green
- status: determines if card shows "Lukket" overlay

Authentication:

- Home requires login; accessed via ProtectedRoute via the (app) Tabs layout
- User authentication state is checked in AppLayout before rendering tabs
- API calls include JWT token via axios interceptor from auth store

Role:

- Home respects auth state only; no role-specific filtering on the Home screen itself
- Job listing filters and display are role-agnostic

Navigation From:

- App entry point after successful login
- Login -> Home (redirect on success)
- Any authenticated app screen back to Home (Tabs bar at bottom)

Navigation To:

- Explore tab: router.push('/(app)/explore') — search/filter view
- Job Detail: JobCard press navigates to job detail (route not yet created)
- Post job empty state button opens the canonical mobile `/(app)/create-job` route.

## Post Job / Legg ut

**STATIC VERIFIED — MANUAL DEVICE TEST REQUIRED**

```text
Legg ut tab
↓
/(app)/create-job
↓
four-step native form
↓
native images + geocoded coordinates + location tree
↓
POST /api/services (multipart/form-data)
↓
server-created service.status = open
↓
invalidate Home/Explore job lists and applicant overview
↓
return to Home; provider can discover the service
```

Implementation map:

- Route/screen: `app/(app)/create-job.tsx`
- Hook: `src/hooks/useCreateJob.ts`
- Service: `src/services/createJob.service.ts`
- Endpoint: `POST /api/services`
- Location hook/service: existing `useLocationTree` and `locationService` → `GET /api/location-filter/tree`
- Category source: existing `useCategories` → `GET /api/filter/options`
- Draft key: `jobblo-create-job-draft`; auth storage is untouched

The multipart payload sends `location.coordinates` as `[longitude, latitude]`, checklist as a JSON string, repeated categories/tags, optional `contactPhone`/`contactEmail`, and native image parts `{ uri, name, type }`. The client never sends `userId` or `status`; the backend owns service ownership and `open` status. Failed publication retains the textual draft and best-effort image URI draft; durable image restoration across app restart is not claimed. Successful publication clears only the create-job draft after a valid `_id` response.

Sections:

1. Greeting Hero (green banner)
   - Time-of-day greeting (God morgen/ettermiddag/kveld)
   - User's first name
   - User's city/region (from postSted)
   - Seasonal tagline (hardcoded "Høst" for now)

2. Categories Pill List
   - Fetched from backend via useCategories hook
   - "Alle" button with Grid3x3 icon to clear filters
   - Clickable category chips with icons and labels
   - Each chip shows: icon (lucide-react-native), category name
   - Selected state: green background (#EAF1E9), green border (#2E6641)
   - Unselected state: white background, grey border (#E6E7E1)
   - Updates job list on selection

3. Jobs Section
   - Sort dropdown (Nyeste først, Laveste pris, Høyeste pris)
   - Grid of job cards (2 columns on mobile, 4+ on larger screens via CSS)
   - Each card shows: photo (4:5), title, price, location, urgent/promoted badges
   - Loading spinner while fetching
   - Error state with retry button
   - Empty state with "Se alle oppdrag" button

Theme colors (matching web brand):

- Page background: #EFF0EA
- Primary (brand green): #2E6641
- Text (ink): #0B0B0B
- Muted text: #63665F
- Border: #E6E7E1
- Surface (cards): #FFFFFF
- Hero accent (soft green): #8FBF9A
- Selected category bg: #EAF1E9
- Urgent badge: #E8A8A0
- Sponsored badge: #2E6641

Query key structure:

queryKeys.jobs.list({
page,
limit,
categories,
search,
sort,
urgent
})

Stale time: 5 minutes
Cache time (gcTime): 30 minutes

File relationships:

HomeScreen (app/(app)/index.tsx)
↓
CategoryChip (src/components/CategoryChip.tsx)
↓
getCategoryIcon (src/utils/categoryIcons.ts)

HomeScreen (app/(app)/index.tsx)
↓
useCategories (src/hooks/useCategories.ts)
↓
categories.service.ts
↓
apiClient (axios)
↓
GET /api/filter/options

HomeScreen (app/(app)/index.tsx)
↓
useJobs (src/hooks/useJobs.ts)
↓
jobs.service.ts
↓
apiClient (axios)
↓
GET /api/services

Query key:

- queryKeys.jobs.list(params)
- queryKeys.categories.all

Used by:

- HomeScreen (categories + jobs)
- Explore/Search screen (reuses same CategoryChip, getCategoryIcon, useCategories)

Invalidated by:

- Manual refetch (retry button)
- Navigation context changes (category/sort changes)

### Home change history

- created jobs.service.ts for centralized API calls to /api/services endpoint
- created useJobs hook using TanStack Query with proper query key structure
- created types/Jobs.ts with full Job and JobsResponse interfaces mirroring backend service model
- created JobCard mobile component matching web design (4:5 photo, text below, badges, price, location)
- created HomeScreen with greeting hero, category pills, job grid, sort dropdown
- added proper error/loading/empty states matching web UX
- used brand colors from theme/brand.ts
- verified TypeScript compilation passes
- home screen uses only real API endpoint (/api/services); no mock jobs
- added categories.service.ts to fetch categories from /api/filter/options
- added useCategories hook with 30-minute stale time (categories change rarely)
- created reusable CategoryChip component with icons for consistent category display
- implemented categoryIcons.ts mapping backend icon names to lucide-react-native components
- Home now fetches real categories from backend with icons instead of hardcoded list

## Runtime verification status

### Expo runtime result

- Verified via `npx expo start --port 8081 --web` from the app root
- Metro started successfully and served the project on `http://localhost:8082/`
- No Expo SDK startup error was emitted after the app root was corrected
- No NativeWind startup crash, Expo Router boot error, or provider boot error surfaced during startup
- Auth route files are present as normal files under `app/(auth)` and no accidental nested duplicate route files were found

### App runtime status

- ✅ Login route boots under Expo Router
- ✅ Register Step 1 route boots under Expo Router
- ✅ Register Step 2 route boots under Expo Router
- ✅ Forgot Password route boots under Expo Router
- ✅ Home screen (app/(app)/index.tsx) TypeScript compiles
- ✅ JobCard component TypeScript compiles
- ✅ jobs.service.ts and useJobs hook TypeScript compiles
- ✅ TypeScript compile gate passes: `npx tsc --noEmit`

### Remaining verification

- Browser/device automation is still required for full touch-level validation of category selection, sort dropdown, and job card press
- Job Detail route must be created to enable JobCard press navigation
- Backend service must be running and reachable to verify real API calls and data display
- Responsive layout must be tested on actual device widths (360-430px) to verify 2-column grid and text wrapping
- Home screens are verified at the code and Expo boot level but not yet validated against a physical device interaction pass in this environment

## Explore / Search

Screen:
File: app/(app)/explore.tsx
Route: /(app)/explore (tab route within authenticated app)
Purpose: Display searchable and filterable job discovery with real-time results. Matches web `/search/job` route which displays `ServiceListing.tsx` page.

Components:

- ExploreScreen (app/(app)/explore.tsx) — main explore screen with search input, category filter, sort dropdown, and job results
- JobCard (src/components/JobCard.tsx) — reused from Home; displays photo, title, price, location
- CategoryChip (src/components/CategoryChip.tsx) — reused from Home; displays category with icon and label (shared component)

Query/Mutation hooks:

- useInfiniteJobs (src/hooks/useInfiniteJobs.ts) — infinite query for pagination with TanStack Query's useInfiniteQuery
- useCategories (src/hooks/useCategories.ts) — fetches categories with icons from /api/filter/options (shared with Home)

Services:

- jobs.service.ts — centralized API calls for job discovery (same service as Home)
- categories.service.ts — fetches available categories with icons from /api/filter/options (shared with Home)

API:
METHOD: GET /api/services

Query Parameters:

- page (number): pagination page, defaults to 1
- limit (number): items per page, defaults to 16
- search (string): free-text search query (parameter name on backend: 'search', not 'q')
- category (string, comma-separated): filter by category names (backend expects singular 'category', not 'categories')
- sort (string): sort key from ['newest', 'price_low', 'price_high', 'relevant']
  - 'relevant': supported and safe; currently identical to 'newest' until relevance signal added
- urgent (boolean): filter to urgent jobs only
- minPrice/maxPrice (number): price range (not yet implemented on mobile)
- lat/lng/radius (number): geographic filtering (not yet implemented on mobile)

Request:
GET /api/services?search=maling&sort=relevant&category=Maling

Response:
(same as Home; see Home section)

Authentication:

- Explore requires login; accessed via ProtectedRoute via the (app) Tabs layout
- API calls include JWT token via axios interceptor from auth store

Role:

- Explore respects auth state only; no role-specific filtering
- Job listing filters and display are role-agnostic

Navigation From:

- Tabs bar: /(app)/explore tab
- Home: (not yet implemented) search hero button with search param: router.push({ pathname: '/(app)/explore', params: { search: 'query' } })

Navigation To:

- Job Detail: JobCard press navigates to job detail (route not yet created)
- Category filter: selecting a category updates local state and triggers new query

Sections:

1. Search Input
   - Text input with Search icon placeholder
   - Shows X clear button when text is present
   - Debounced onChange (500ms) to avoid query spam while typing
   - Resets pagination to page 1 on new search

2. Result Count & Sort Dropdown
   - Shows total job count (e.g., "42 resultater")
   - Dropdown with options: Nyeste først, Laveste pris, Høyeste pris, Mest relevant
   - 'Mest relevant' is a genuine supported sort value (currently behaves like 'newest')
   - Selecting sort resets pagination to page 1

3. Category Filter Chips
   - Fetched from backend via useCategories hook
   - "Alle" button with Grid3x3 icon to clear category filter
   - Each category displayed as CategoryChip: icon + label
   - Selected category highlighted with green background and border
   - Single-select: clicking a selected category deselects it; clicking a new category replaces the previous
   - Resetting pagination on category change

4. Results Grid
   - 2-column grid of JobCard components
   - **TanStack Query `useInfiniteQuery`** manages all pagination
   - Pages stored in TanStack Query's internal `data.pages` array
   - Results flattened on render: `allJobs = data?.pages.flatMap(page => page.data) ?? []`
   - onEndReached triggers `fetchNextPage()` when user scrolls to 50% threshold
   - `getNextPageParam` automatically determines next page from backend pagination metadata
   - `hasNextPage` prevents unnecessary requests; `isFetchingNextPage` prevents spam
   - Changing search/category/sort produces a new query key, naturally resetting the infinite query
   - No local `allJobs` state; TanStack Query is the single source of truth

5. Loading States
   - First page load (isLoading true): full-screen spinner with "Søker etter oppdrag..." message
   - Pagination load (isFetchingNextPage true): footer spinner while fetching next page

6. Error State
   - Card with error message and "Prøv igjen" retry button
   - Retry refetches current page and resets pagination

7. Empty State
   - Card with "Ingen oppdrag funnet" message
   - If search/filter is active: suggests modifying search/filter with "Fjern filtre" button
   - If no search/filter: generic "no jobs available" message

Theme colors:

- Same as Home (see Home section)
- Selected category bg: #EAF1E9
- Active category text/border: #2E6641

Query key structure:

queryKeys.jobs.infinite({
limit,
categories,
search,
sort,
urgent,
})

Stale time: 5 minutes
Cache time (gcTime): 30 minutes

File relationships:

ExploreScreen (app/(app)/explore.tsx)
↓
CategoryChip (src/components/CategoryChip.tsx)
↓
getCategoryIcon (src/utils/categoryIcons.ts)

ExploreScreen (app/(app)/explore.tsx)
↓
useCategories (src/hooks/useCategories.ts)
↓
categories.service.ts
↓
apiClient (axios)
↓
GET /api/filter/options

ExploreScreen (app/(app)/explore.tsx)
↓
useInfiniteJobs (src/hooks/useInfiniteJobs.ts) ← TanStack Query useInfiniteQuery
↓
jobs.service.ts
↓
apiClient (axios)
↓
GET /api/services

Query key:

- queryKeys.jobs.infinite(params) — unique to Explore; separate from Home's queryKeys.jobs.list(params)
- queryKeys.categories.all — shared with Home

Used by:

- ExploreScreen

Invalidated by:

- Search text change (debounced 500ms)
- Category selection change
- Sort selection change
- Manual refetch (retry button)

Local UI state (separate from server query):

- searchText: raw search input (updated on every keystroke; debounce only affects query key change)
- selectedCategory: active category filter
- sortValue: active sort option
- showSortDropdown: dropdown open/closed state

Server query state (managed by TanStack Query useInfiniteQuery):

- data.pages: array of JobsResponse objects (one per page fetched)
- isLoading: first page load in progress
- isError: query failed
- hasNextPage: determined by getNextPageParam; true if more pages exist
- isFetchingNextPage: subsequent page load in progress
- refetch(): manual retry on error

State synchronization:

- searchText updates → debounce 500ms → query key changes → TanStack Query automatically resets and fetches page 1
- selectedCategory updates → query key changes → TanStack Query automatically resets and fetches page 1
- sortValue updates → query key changes → TanStack Query automatically resets and fetches page 1
- onEndReached (scroll to 50%) → fetchNextPage() → getNextPageParam calculates next page → appends to data.pages array

### Explore / Search change history

- created ExploreScreen using useInfiniteJobs hook for TanStack Query pagination (no local allJobs state)
- implemented search input with 500ms debounce (query key change triggers refetch)
- added category chips using shared CategoryChip component with icons
- added sort dropdown with 4 options (newest, price_low, price_high, relevant)
- refactored to use **TanStack Query `useInfiniteQuery()`** for true architecture compliance
  - All job data managed by TanStack Query's internal pages array
  - Removed local useState for allJobs; only UI state (search, category, sort, dropdown) in React state
  - Query key: queryKeys.jobs.infinite(params) — separate from Home's queryKeys.jobs.list(params)
  - getNextPageParam uses backend pagination metadata to determine next page number
  - hasNextPage prevents requests past end; isFetchingNextPage prevents spam
  - Flattened for rendering: `allJobs = data?.pages.flatMap(page => page.data) ?? []`
  - Filter/search/sort changes produce new query key, naturally resetting the infinite query
- added useInfiniteJobs hook (src/hooks/useInfiniteJobs.ts) with full pagination metadata support
- updated queryKeys to add infinite query key structure
- verified Home remains unchanged (still uses normal useJobs for non-paginated queries)
- verified category icon system unchanged (CategoryChip, getCategoryIcon, useCategories all shared)
- TypeScript compilation passes: zero errors

---

## My Applications / Mine søknader

**Route**: `app/(app)/my-applications.tsx`

**Accessible from**: app tab bar as "Mine søknader"

### My Applications Flow Overview

```
Mine søknader tab
↓
useMyApplications (TanStack Query)
↓
applications.service.ts → getMyApplications()
↓
apiClient (axios) → GET /api/my-applications
↓
Backend: myApplicationsController.getMyApplications
↓
ApplicationCard + ApplicationStatusBadge + ApplicationFlowSteps
↓
optional withdraw via Dialog + useWithdrawApplicationMutation
↓
applications.service.ts → withdrawApplication()
↓
apiClient (axios) → DELETE /api/my-applications/:requestId
```

### My Applications API Contract

**Response**:

- `applications: MyApplication[]`
- `pagination: { page, limit, total, pages }`

**Important backend naming**:

- `customerId` on JobRequest is the applicant (worker)
- `providerId` is the job owner/poster

**Status filters**:

- `''` → Alle
- `pending` → Venter
- `accepted` → Valgt
- `declined` → Avslått

### Components

- `src/hooks/useMyApplications.ts`
- `src/components/domain/ApplicationCard.tsx`
- `src/components/domain/ApplicationStatusBadge.tsx`
- `src/components/domain/ApplicationFlowSteps.tsx`
- `src/components/ui/Dialog.tsx`

### Apply to Job

**Route**: `app/(app)/jobs/[id].tsx` (integrated into Job Details screen)

**Accessible from**: Job Details screen via "Søk på oppdraget" CTA button at bottom

### Apply Flow Overview

```
Job Details Screen
↓ (user clicks "Søk på oppdraget")
ApplyModal (centered modal dialog)
↓ (user enters optional message, clicks "Send forespørsel")
useApplyMutation (TanStack Query mutation)
↓
applications.service.ts → applyToJob()
↓
apiClient (axios) → POST /api/orders/request
↓
Backend: createJobRequest controller
↓ (success or error)
Cache invalidation (job detail + applications list)
↓
Modal closes, success/error message shown
```

### Apply Modal Component

**File**: `src/components/domain/ApplyModal.tsx`

**Props**:

- `visible: boolean` - modal open/closed state
- `onClose: () => void` - callback when closing
- `onSubmit: (payload) => void` - callback when submitting
- `jobTitle?: string` - job title for context display
- `isLoading?: boolean` - submission in progress
- `error?: string | null` - error message to display

**Features**:

- Centered modal card with dark backdrop overlay matching the web dialog
- Message field (textarea): optional, max 500 characters
- Character counter: "X/500"
- Simple inline job title text below the header, matching web
- Compact error block for validation/API errors
- Submit button: "Send forespørsel" (disabled while loading, when over char limit)
- Cancel button: "Avbryt" (disabled while loading)
- No visible Cmd/Ctrl helper text
- Built with reusable `Dialog` primitive and web-parity layout modeled on `frontend/src/components/job/OrderRequestModal.tsx`

### Apply Mutation Hook

**File**: `src/hooks/useApplyMutation.ts`

**Returns TanStack Query mutation with**:

- `mutate(payload)`: submit application
- `isPending`: submission in progress
- `isError`: submission failed
- `error`: error object (with response data)

**Cache invalidation on success**:

- Invalidates `queryKeys.applications.all` (my applications list)
- Invalidates `queryKeys.jobs.detail(jobId)` (job detail to update CTA state)

**Error handling** (in Job Details onError callback):

- 403 with isDelayed=true: cooldown timer message
- 402: contact limit message
- Other: generic error from response

### Applications Service

**File**: `src/services/applications.service.ts`

**Functions**:

1. **applyToJob(payload)**
   - POST /api/orders/request
   - Payload: `{ serviceId: string, message?: string }`
   - Returns: JobRequest with `chatId`
   - Auth: required (via apiClient interceptor)

2. **getMyJobRequests()**
   - GET /api/orders/requests/my
   - Returns: JobRequest[]
   - Not used in MVP but available for future My Applications screen

3. **updateJobRequestStatus(requestId, status)**
   - PATCH /api/orders/request/:id
   - Payload: `{ status: 'accepted' | 'declined' }`
   - For provider (job owner) only
   - Not called in mobile MVP (applies via web)

### Application Types

**File**: `src/types/Application.ts`

```typescript
interface JobRequest {
  _id: string;
  serviceId: string | { _id: string; title: string };
  customerId: string | { _id: string; name: string };
  providerId: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  chatId?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateJobRequestPayload {
  serviceId: string;
  message?: string;
}

interface ApplyError {
  error?: string;
  isDelayed?: boolean;
  unlockAt?: string;
  paymentRequired?: boolean;
  upgradeRequired?: boolean;
  limit?: number;
  usage?: number;
  perContactPrice?: number;
}
```

### Job Details Integration

**File**: `app/(app)/jobs/[id].tsx`

**Changes**:

- Added `isApplyModalOpen` state to track modal visibility
- Added `applyError` state to track submission errors
- Added `useApplyMutation` hook call with error handler
- Modified `handlePrimaryAction` to open ApplyModal instead of deferring
- Added `handleApplySubmit` to pass payload to mutation
- Added `<ApplyModal>` component before closing SafeAreaView

**CTA Button Logic**:

- Logged out: "Logg inn for å søke" → navigates to /login
- Job owner: "Dette er ditt oppdrag" → disabled
- Job closed: "Oppdraget er lukket" → disabled
- Normal provider: "Søk på oppdraget" → opens ApplyModal

**Error Handling**:

- 403 cooldown: Shows "Du må vente X minutter..." message in modal
- 402 contact limit: Shows upgrade message in modal
- Other errors: Shows generic error message
- User can dismiss modal and try again

### API Endpoint

**Backend**: POST /api/orders/request

**Middleware**:

- `authenticate`: Validates JWT token
- `checkSubscription`: Handles contact limit logic, cooldown timer, free job bypass

**Validation**:

- serviceId required, valid ObjectId
- Service must exist and be "open" status
- No active order/contract for service
- Cannot apply to own service (providerId !== customerId)
- No duplicate pending request (unique partial index on serviceId, customerId, status=pending)

**Response (201)**:

```json
{
  "_id": "...",
  "serviceId": "...",
  "customerId": "...",
  "providerId": "...",
  "status": "pending",
  "message": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "chatId": "..."
}
```

**Errors**:

- 400: Service not found, invalid status, already applied, own service, closed job
- 402: Contact limit reached (paymentRequired: true)
- 403: Cooldown active (isDelayed: true, unlockAt: timestamp)
- 500: Server error

### Query Keys

**File**: `src/queryKeys.ts`

Added to queryKeys object:

```typescript
applications: {
  all: ['applications', 'all'],
  detail: (requestId: string) => ['applications', 'detail', requestId],
}
```

### Apply Behavior & Restrictions

**Who can apply**:

- Authenticated provider (any user role)
- NOT job owner (cannot apply to own job)
- NOT non-authenticated user (redirects to login)

**When can't apply**:

- Job status not "open" (completed, in_progress, closed, cancelled, expired, draft, waiting_for_approval)
- Already applied with pending status (duplicate guard)
- Monthly free contacts exhausted (402 error with payment info)
- Still on cooldown from last application (403 error with cooldown minutes)
- Active order/contract already exists for this job

**After successful apply**:

- Modal closes automatically
- Job Details re-fetches to update CTA state
- CTA button changes to reflect pending application status (if implemented)
- Chat is created or found (direction-agnostic matching)
- Provider (job owner) receives notification
- Application appears in provider's "Forespørsler" list

### Duplicate Application Prevention

**Backend Logic** (MongoDB unique partial index):

- Unique on (serviceId, customerId) where status='pending'
- Allows re-apply after decline or withdrawal
- No concurrent duplicate creation (MongoDB enforces atomically)

**Frontend Logic**:

- Disable submit button if message over limit
- Show error if already applied
- Don't allow rapid re-submission (mutation isPending disables button)

### Contact Limit & Cooldown

**Handled by backend checkSubscription middleware**:

1. Monthly free contacts per plan (Standard has X, Pro has Y, etc.)
2. If quota exhausted:
   - Check cooldown time: last application + ContactUnlock minutes
   - If cooldown active: return 403 with unlockAt timestamp
   - If cooldown passed: return 402 with contact upgrade option
3. Free job bypass: jobs under 10k NOK bypass quota for private users (if enabled)

**Mobile shows**:

- Error message with countdown if on cooldown
- Error message with upgrade option if limit reached
- Button/UI remains disabled during cooldown

### Cache Invalidation Strategy

**After successful apply**:

- Invalidate `queryKeys.applications.all` (my applications list for future My Applications screen)
- Invalidate `queryKeys.jobs.detail(jobId)` (specific job detail to refresh CTA state)
- Does NOT invalidate job list (Explore/Home) because listing order/count doesn't change until provider accepts

**Rationale**:

- Job detail updates immediately to show "Forespørsel sendt" state
- Full invalidation avoided to preserve search/filter pagination state
- My Applications query can be added later without changing Apply flow

### Success Behavior

**Current (Mobile MVP)**:

- Modal closes automatically
- Job Details refetches
- CTA state updates (visual feedback of successful apply)

**Future (with notifications)**:

- Success toast: "Forespørsel sendt! Venter på godkjenning."
- Navigate to chat (optional)

### Error UX

**Three error scenarios**:

1. **Cooldown (403 with isDelayed)**
   - Message: "Du må vente X minutter mellom hver forespørsel. Neste åpner om Y minutter."
   - Modal stays open, user can read and wait
   - Timer counts down (client-side calculation from unlockAt timestamp)
   - User can manually close and reopen modal later

2. **Contact Limit (402 with paymentRequired)**
   - Message: "Du har nådd din månedlige grense for kontakter. Oppgrader planen din for å søke videre."
   - Modal stays open
   - Could show upgrade CTA button (future enhancement)
   - User closes modal to access settings/billing (not implemented in MVP)

3. **Validation/Other (400, 409, 500)**
   - Message: Generic backend error message
   - Modal stays open
   - User can dismiss and potentially try again
   - Examples: "Service not found", "You have already applied", "Server error"

### Loading & Submit Behavior

**While submitting** (mutation isPending = true):

- Submit button: disabled, shows "Sender..." text
- Cancel button: disabled
- Message field: disabled (non-editable)
- Modal cannot close (handleClose checks isLoading)
- Prevents duplicate submission by second click

**After error**:

- Buttons re-enabled immediately
- Modal stays open so user can correct and retry
- Error persists until next submit attempt or manual close

### Mobile Responsive Sizes

Tested at: 360, 375, 390, 393, 414, 430 dp

**Considerations**:

- Sheet slides from left (drawer pattern)
- ScrollView handles tall/keyboard scenarios
- TextArea multiline with 6 default rows
- Character counter always visible
- Buttons stack vertically (full width)
- Padding consistent with Jobblo design system (16px sides)

### Regression Checks

✅ Job Details page loads (not broken by new code)
✅ Apply CTA button renders and enables correctly
✅ Login redirect works when not authenticated
✅ Owner cannot apply (button disabled, no modal)
✅ Closed job shows correct state (button disabled)
✅ ApplyModal opens/closes properly
✅ Message input accepts typing
✅ Character count updates in real-time
✅ Error messages display properly
✅ Loading state prevents duplicate submission
✅ TypeScript: zero errors

### Not Implemented in MVP

- My Applications screen (can fetch via getMyJobRequests())
- Application status updates (accept/decline happen via provider on web)
- Contact limit/cooldown UI bypass options
- "Already applied" check (backend prevents duplicate, shows error if attempted)
- Application withdrawal/cancellation
- Rich text or file attachments in message
- Address validation (just freeform text like web)

### Files Created

- `src/types/Application.ts` - JobRequest, CreateJobRequestPayload, ApplyError types
- `src/services/applications.service.ts` - applyToJob(), getMyJobRequests(), updateJobRequestStatus()
- `src/hooks/useApplyMutation.ts` - TanStack Query mutation with cache invalidation
- `src/components/domain/ApplyModal.tsx` - Apply modal UI component

### Files Modified

- `app/(app)/jobs/[id].tsx` - Added ApplyModal state, mutation, CTA logic, error handling
- `src/queryKeys.ts` - Added applications query keys

### Implementation Status

✅ Web Apply flow inspected and documented
✅ Backend Apply endpoint reviewed and understood
✅ Apply modal component created
✅ Applications service created
✅ useApplyMutation hook created
✅ Job Details CTA wired to Apply modal
✅ Error handling for all scenarios
✅ Cache invalidation targeted
✅ TypeScript compilation: PASSED
✅ MOBILE_FLOW.md updated with Apply documentation
❌ My Applications screen (not in scope)
❌ Application status (provider-side, not in MVP scope)

### Change History

- created src/types/Application.ts with JobRequest, CreateJobRequestPayload, ApplyError types
- created src/services/applications.service.ts with applyToJob(), getMyJobRequests(), updateJobRequestStatus() functions
- created src/hooks/useApplyMutation.ts with TanStack Query mutation and cache invalidation
- created src/components/domain/ApplyModal.tsx with message input, character count, error display
- updated app/(app)/jobs/[id].tsx to add ApplyModal state, useApplyMutation, error handling, CTA logic
- updated src/queryKeys.ts to add applications.all and applications.detail query keys
- verified no regression to Job Details page, Home, Search, all filters
- TypeScript validation: zero errors

## Payout / Stripe Connect settings

The route is `/(app)/profile/settings/payout`, reached from the now-enabled `Utbetalinger` row in `Innstillinger → Betaling`, and from the navigation-only payout card at the bottom of SafePay History. The screen is display-and-launch only: it shows server-truth Stripe Connect status and opens Stripe-hosted onboarding. It never collects bank account numbers, identity documents, or verification documents inside Jobblo — those belong to Stripe's hosted flow.

Data flows `PayoutSettingsScreen → usePayout hooks → payout.service.ts → api/client.ts → backend`. No Axios or `fetch` call is made from the screen. The query key is `queryKeys.payout.status` (`['payout', 'status']`).

### Endpoints

Three existing authenticated endpoints are used, all mounted in `backend/routes/connect.js` behind `authenticate` and resolving the user from `req.userId`:

`GET /api/connect/status` returns `{ hasAccount, payoutOnboardingStatus, payoutEnabled, chargesEnabled, detailsSubmitted, connectedAt, lastRefreshed }`. `POST /api/connect/account-link` returns `{ url }` and auto-creates the Stripe Express account when the user has none, so mobile deliberately does not call `POST /api/connect/account`; no separate mobile account-creation flow exists. `POST /api/connect/refresh` re-retrieves the account from Stripe, syncs `payoutOnboardingStatus`, `payoutEnabled`, `chargesEnabled`, and `detailsSubmitted` onto the user, and returns those four fields.

### Status mapping

`payoutOnboardingStatus` is a Mongoose enum in `backend/models/User.js` with values `none`, `started`, `restricted`, `enabled`, and `pending_verification`. The backend helper `_syncAccountFields` currently only ever writes `enabled` (details submitted and payouts enabled), `pending_verification` (details submitted, payouts not enabled), or `started` (account exists). `restricted` is reachable in the schema but is not produced by current sync logic, and `none` is the default for users with no account.

The screen derives four UI states from server fields only. `ready` requires `payoutEnabled === true` and `payoutOnboardingStatus === 'enabled'`, showing `Klar for utbetalinger` with CTA `Oppdater eller endre Stripe-opplysninger`. `pending_verification` requires `detailsSubmitted === true` and `payoutEnabled === false`, showing `Verifisering kreves` with CTA `Fullfør verifisering i Stripe`. `started` covers an existing account whose details are not yet submitted, showing `Onboarding startet` / `Ufullstendig` with CTA `Fortsett Stripe-onboarding`; this state deliberately does not claim Stripe is verifying anything, because nothing has been submitted. Otherwise the state is `not_configured` (`hasAccount === false` or status `none`), showing `Ikke satt opp` with CTA `Start Stripe-onboarding`. Because `restricted` never satisfies the ready or pending checks, it falls through to an account-exists state rather than being reported as ready — no invented status label is displayed.

Payout readiness is derived exclusively from Stripe Connect status. Order completion and SafePay transaction status are never used as payout proof, preserving existing payout-warning semantics elsewhere in the app.

### Opening Stripe onboarding

`expo-web-browser` is not a dependency of this project, so no browser library was added. The screen uses the established `Linking.openURL` approach already used by SafePay checkout and login, opening the Stripe URL in the system browser. A fresh account link is requested on every CTA press because Stripe account links are short-lived and single-use; no link URL is cached or reused. Mobile never constructs Stripe URLs, never sends an account ID, and holds no Stripe secret key.

### Return behaviour and the current gap

There is currently **no automatic mobile return or deep link** back into the app after Stripe onboarding. `backend/controllers/stripeConnectController.js` builds the account link with web-only destinations, `refresh_url` `<FRONTEND_URL>/settings/payout?refresh=1` and `return_url` `<FRONTEND_URL>/settings/payout?success=1`. A repository audit found no existing server-side mobile redirect allow-list, no `jobblo://` handling in backend code, and no mobile-aware return parameter on any Stripe URL builder. The Expo scheme `jobblo` is configured in `app.json`, but scheme configuration alone is not a secure server-controlled return flow.

Because the preconditions for a safe server-controlled mobile destination did not already exist, that infrastructure was **not** built in this task and **the backend was not modified**. Accepting an arbitrary client-supplied `returnUrl` was explicitly rejected as an open-redirect risk. Existing web return behaviour is therefore fully preserved, and there is no new redirect surface to protect.

The consequence, stated plainly: when a provider finishes Stripe onboarding in the browser, Stripe lands them on the **web** return URL, not back in the app. The user returns to Jobblo manually by switching apps.

To keep state correct despite that, the screen refreshes from the server on resume. The screen tracks whether it actually launched onboarding via an `onboardingLaunched` ref, set only after a successful `Linking.openURL` and cleared if the open throws. An `AppState` listener fires on transition to `active`, and only when that flag is set does it `POST /api/connect/refresh`, then clear the flag. This prevents refreshing Stripe on every unrelated app foreground, avoiding excessive Stripe API calls. If the refresh call fails, the listener falls back to refetching `GET /api/connect/status`. The listener is subscribed once for the screen's lifetime; the latest mutation and refetch callbacks are held in refs so react-query's per-render object identity does not cause repeated re-subscription.

On a successful refresh, `queryKeys.payout.status` and `queryKeys.auth.profile` are both invalidated. The profile key is included because `payoutEnabled` and related Stripe fields are part of the profile projection and can surface elsewhere. Invalidation is targeted; no global cache clear is performed, so SafePay History and other screens keep their own server truth.

### Errors and security

Loading uses `LoadingIndicator`; failures render `ErrorState` with a `Prøv igjen` action that refetches status. Status `401` shows `Pålogging kreves`, `500` shows a generic Norwegian server-error message, and network failures show a connection message. Account-link failures surface the backend's Norwegian `error` string when present, otherwise a generic fallback. Stripe account IDs, raw Stripe errors, stack traces, and configuration details are never shown. A failed status or account-link call does not sign the user out; the shared 401 token-clearing behaviour in `api/client.ts` is unchanged and no new logout path was introduced.

All ownership remains server-side: every connect endpoint keeps its `authenticate` middleware, the account is resolved from `req.userId`, Stripe metadata stays server-owned, and the client never selects or transmits a Stripe account.

### Verification status

`tsc --noEmit` passes with zero errors. Stripe onboarding has **not** been runtime-tested on a real device; launching the hosted flow, completing verification, and confirming the resume-refresh path require manual testing with real Stripe credentials.

### Change History

- added `payout.status` to src/queryKeys.ts
- created src/services/payout.service.ts with getConnectStatus(), createAccountLink(), refreshAccountStatus() and response types
- created src/hooks/usePayout.ts with useConnectStatus(), useCreateAccountLinkMutation(), useRefreshStatusMutation() including payout + auth profile invalidation
- created app/(app)/profile/settings/payout.tsx with four truthful status states, fresh-link CTA, Linking launch, and gated AppState refresh
- updated app/(app)/profile/settings/index.tsx to enable the `Utbetalinger` row
- updated app/(app)/profile/settings/safepay.tsx to replace the deferred payout placeholder with a navigation-only link
- backend unchanged: no Stripe return-URL or redirect changes were made
- TypeScript validation: zero errors

## Membership / plan selection and purchase

The mobile route is `/(app)/profile/membership`, enabled from the `Medlemskap` row in the Betaling group. This screen owns exactly one job: browse plans, pick one, optionally apply a coupon, and start a Stripe subscription checkout. It is deliberately not a subscription manager — status, renewal, cancel and resume all stay in `/(app)/profile/settings/subscription`.

### Endpoints

Plans come from `GET /api/plans` via `plans.service.getPlans` and `usePlans` on `queryKeys.plans.all`. Two properties of that endpoint matter and are handled in the hook rather than the screen: the controller responds with a bare array rather than `{ plans }`, and it returns inactive plans too because the same route serves the admin UI, so `isActive` is filtered client-side and plans are sorted cheapest-first. The endpoint is public and needs no token. That client-side filter is a catalogue-display convenience only and is not the rule: `POST /api/stripe/create-checkout-session` independently rejects `plan.isActive !== true` with `plan_inactive`, so neither a cached list nor a hand-made request carrying a retired plan's Mongo ID can buy it. `GET /api/plans` itself was deliberately left returning everything, because the admin plan editor reads the same public route and needs the inactive rows.

Coupon validation is `POST /api/coupons/validate` with `{ code, planId }` through `useValidateCouponMutation`. It requires authentication and takes the owning user from the token, so mobile never sends a user ID. It is intentionally a mutation and never cached, because a coupon's validity depends on expiry and usage limits and a stale "valid" answer would mislead.

Checkout is `POST /api/stripe/create-checkout-session` with `{ planId, couponCode? }` through `useCreateCheckoutSessionMutation`, returning a Stripe-hosted `url`. The endpoint refuses before it touches Stripe in five distinct ways, each with a stable `code` the client can branch on:

| Status | `code`                           | Meaning                                                                                                          |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 400    | `plan_inactive`                  | The plan exists but `isActive !== true`.                                                                         |
| 400    | `plan_is_free`                   | The plan costs nothing; there is no Stripe subscription to create.                                               |
| 400    | `zero_total_subscription`        | A coupon reduced the total below 1 øre, which Stripe cannot bill recurringly.                                    |
| 409    | `active_subscription_exists`     | The account already holds a Stripe subscription that can still bill it.                                          |
| 409    | `checkout_in_progress`           | The same `{ user, plan, coupon }` request was already submitted inside the current 60-second idempotency window. |
| 500    | `subscription_check_unavailable` | Stripe could not be reached to verify the existing subscription, so nothing was created.                         |

Every one of these is decided server-side and none of them depends on a client guard. The mobile screen mirrors some of them for a better first-attempt experience, but the server is what enforces them.

### Plan shape

The types in `plans.service.ts` mirror `backend/models/SubscriptionPlan.js` and nothing more: `_id`, `name`, `price`, `type` (`private` | `business`), `entitlements`, `featuresText`, `isActive`. The web client's `Plan` type additionally declares `features`, `freeViews` and `pricePerExtraView`; those fields do not exist on the model and are always undefined at runtime, so they are omitted here on purpose. `featuresText` is the real feature list. When a plan has an empty `featuresText`, the screen derives a short list from the entitlements it can actually read (`freeContact`, `radius`, `perContactPrice`, `hasBadge`, `hasAnalytics`) instead of inventing copy.

Note also that `plan.autoRenew` is read into checkout session metadata by the backend but does not exist on the plan model, so it is always undefined. That is a pre-existing backend quirk and was left untouched.

### Private and business

The Privatperson/Bedrift switcher is real, not decorative: plans carry a `type` and the backend applies no role restriction when creating a checkout session, so either catalogue can genuinely be purchased. The default tab comes from the server's `subscription.planType` when a subscription row exists, falling back to the auth-store role (`company` → business). Switching tabs clears the selected plan and any applied coupon, because a coupon is validated against one specific plan.

### Current plan detection

The screen prefers `subscription.planId` from `GET /api/stripe/subscription` and only falls back to matching `subscription.plan` by name for older rows written before `planId` was stored. The matched plan shows a `Din plan` badge, and selecting it yields a static "Dette er planen du har nå" instead of a purchase button.

Whether the user holds a _paid_ subscription is a separate question from whether a subscription row exists. Every account gets a free subscription row at signup via `utils/subscription.ensureDefaultSubscription`, so existence proves nothing. The signal used is the presence of `stripeSubscriptionId`, combined with a status that is not one of `canceled`/`cancelled`/`incomplete_expired`/`expired`. A subscription flagged `cancelAtPeriodEnd` still counts as paid, because it is still active and still billing until the period ends.

This list intentionally matches the server's own settled set in `services/stripe/subscriptionState.js` and no longer includes `unpaid`. An `unpaid` Stripe subscription has failed its invoices but has not been closed out; depending on the account's dunning settings it can still be recovered and resume billing, so treating it as finished on mobile while the server treats it as live would have shown a purchase button that always returned `409`.

### Free plan

A free plan never contacts Stripe. `POST /api/stripe/create-checkout-session` explicitly rejects a zero-price plan with `plan_is_free`, and there is no backend endpoint that activates a free plan, because `ensureDefaultSubscription` has already given every user one. So the free tier shows an explanatory panel and no call: for a user with no paid subscription it simply states that no payment is required, and for a user with a paid subscription it says the paid subscription must be ended under Abonnementer first. The screen never claims a downgrade happened and never writes a plan locally.

### Plan switching: still deliberately not offered, now also refused by the server

This was audited before any "Bytt plan" affordance was considered, and the conclusion was that the backend was not safe for plan changes: `createCheckoutSession` contained no check for an existing subscription and created a brand-new Stripe subscription unconditionally, `utils/subscription.upsertSubscription` then overwrote `currentPlan` wholesale including `stripeSubscriptionId`, the previous Stripe subscription was never cancelled so it kept billing, and because its ID had been overwritten it was no longer reachable from `cancelMySubscription`. Buying a second plan meant silent double billing with no in-app way to stop the first charge. Mobile hid the affordance; the web page did not, so the path was reachable in production.

That hole is now closed on the server, which is the only place it could be closed properly. `createCheckoutSession` refuses a second paid checkout with `409 active_subscription_exists` before it resolves a Stripe customer or creates a session, so a refusal leaves nothing behind at Stripe. The refusal applies to the same plan and to a different plan alike — a different plan is not a bypass, because a different plan is exactly the case that produced two live subscriptions.

**Plan switching remains intentionally unsupported.** Nothing about proration, mid-period credit, or switch-at-period-end was implemented, and no Stripe Customer Portal was introduced. The intended business behaviour for a plan change is still not determinable from the existing code, so the safeguard blocks rather than guesses. To move between paid plans a user cancels under `Abonnementer` and purchases the new plan once the period has ended.

What "already holds a subscription" means is decided in `backend/services/stripe/subscriptionState.js`, shared by checkout and provisioning so the two cannot drift apart. Mongo is not trusted on its own: the stored `currentPlan.stripeSubscriptionId` is retrieved from Stripe and the live `status` decides. Statuses treated as still able to bill, and therefore blocking, are `active`, `trialing`, `past_due`, `unpaid`, `incomplete` and `paused`. Only `canceled` and `incomplete_expired` are treated as settled, along with a stored ID Stripe no longer recognises (`resource_missing`) — the same reasoning `resolveStripeCustomer` already applies to a stale `cus_…` left behind by a test/live mode switch. `cancelAtPeriodEnd` needs no special case: Stripe still reports such a subscription as `active`, so it blocks on its own until the period genuinely ends.

If Stripe cannot be reached for that check, checkout fails closed. No session is created and the response is `500 subscription_check_unavailable` with a generic Norwegian retry message; the raw Stripe error, code and account identifiers are not exposed. Failing open would mean creating a second live subscription during exactly the outage in which nobody can see it happening.

### Zero-total coupons are now rejected server-side

`createCheckoutSession` rejected a zero-price _plan_ but applied the coupon afterwards and never re-checked the discounted total, so a percentage-100 or fixed-amount-at-or-above-price coupon reached Stripe as `unit_amount: 0`, which Stripe will not accept for a recurring line item. The guard now runs on the integer amount actually sent: the øre value is computed once, and anything below 1 øre or non-finite returns `400 zero_total_subscription` before the session is created.

No "activate a free subscription instead" path was invented. There is no server-side operation for that — `ensureDefaultSubscription` already gives every account a free row at signup — so pretending a 100% coupon grants a paid tier would have been a fabricated entitlement. The request is refused and explained instead.

The mobile guard on `finalPrice <= 0` is kept, because refusing locally gives a clearer message than a round trip, but it is now a convenience rather than the rule. The web coupon flow no longer advertises a zero-total checkout as purchasable either.

### Provisioning will not orphan a live subscription

Blocking checkout removes the cause but not every route to the effect: a checkout session created before the guard existed can still be paid, a Stripe checkout link can sit in a browser tab for hours, and two simultaneous unpaid sessions can still both be completed. `provisionSubscriptionFromSession` therefore checks, before writing, whether the stored `stripeSubscriptionId` names a _different_ subscription that Stripe still reports as billing-capable. If it does, the write is refused and the function returns `{ ok: false, reason: 'conflicting_live_subscription' }`, logging both subscription IDs so the duplicate can be found and cancelled manually. Stripe secrets and customer identifiers are not logged.

The transaction is still recorded first, because the customer really was charged and withholding the receipt would make the payment invisible to anyone reconciling or refunding it. A same-ID replay, a first purchase, a `canceled`/`incomplete_expired` predecessor and an unrecognised stored ID all provision normally, so ordinary re-subscription is untouched. If Stripe cannot answer during that check the error propagates, which matches the webhook dispatcher's documented contract — throwing releases the event claim so Stripe retries, whereas returning a conflict would permanently strand a paying customer.

### Residual risk: two simultaneous unpaid checkouts

The duplicate guard reads committed state, so it cannot see a checkout session that has been created but not yet paid. Two requests arriving close enough together can both pass it, and if both sessions are then paid the account ends up with two live subscriptions. No pending-checkout concept exists for subscriptions to reuse: the `StripeEvent` ledger only deduplicates delivered webhooks, and SafePay's `Order.checkoutSessionId` belongs to a different flow.

Rather than invent a checkout reservation system, the mitigation reuses the Stripe idempotency-key convention already established elsewhere in this codebase (`services/payout/releasePayoutToProvider.js`, `controllers/admin/disputesAdminController.js`). The key is derived server-side from the user, plan, coupon and a 60-second window, so a double tap or an impatient re-submit collapses onto one session, and a genuinely simultaneous collision returns `409 checkout_in_progress`. Two deliberate attempts more than a minute apart, both left unpaid and then both completed, remain possible. That case is **detected rather than prevented** — the provisioning guard above refuses the second write and logs it for manual review. This is a known, accepted residual risk, not a solved problem.

### `stripeStatus: 'unknown'`

`GET /api/stripe/subscription` reports `stripeStatus: 'unknown'` when its live Stripe lookup throws. That value is not a usable signal, so `hasPaidSubscription` treats it as inconclusive and falls back to the locally stored status. Where neither status is conclusive the subscription is treated as paid, which fails closed: it hides the purchase button rather than risking a duplicate charge during a Stripe outage.

### Security

Mobile sends only `planId` and an optional `couponCode`. It never sends price, `finalPrice`, `discountAmount`, `userId`, a Stripe customer ID, a Stripe subscription ID, success/cancel URLs, or session metadata — all of those are server-owned. The prices shown after coupon validation are display-only; the server re-reads the plan, re-validates the coupon against the authenticated user and recomputes the charged amount inside `createCheckoutSession`, so a coupon that expires between validation and checkout correctly fails at checkout.

The Stripe URL is opened exactly as returned and is never constructed client-side. No `returnUrl` is sent, so no open redirect is introduced. Errors surface `error`/`message` from the response only, never raw Stripe errors, account IDs or stack traces; `401` gets a sign-in message and `500` a generic retry message, and neither clears auth state — the Axios interceptor only drops stored credentials on a genuine `401`.

### How the screen reacts to a refusal

The screen's own gates are a first-attempt convenience; a stale cache, a purchase made in another client, or a race can still land a request on a refusal. Checkout's `onError` reads `response.data.code` and branches, in order: `401` keeps its sign-in message; `active_subscription_exists` refetches `queryKeys.subscription.current` and offers `Lukk` or `Administrer`, the latter routing to `/(app)/profile/settings/subscription` where cancel and resume already live; `plan_inactive` refetches the plan list so the retired plan disappears; `zero_total_subscription` and `checkout_in_progress` each explain themselves in Norwegian; anything else falls through to the existing generic message.

None of this reimplements the server's rules. The screen does not compute whether a subscription blocks, it reacts to being told that it does, and the refetch is what makes the UI agree with the server rather than local inference.

### Returning from checkout and why purchase is never assumed

There is no mobile-aware return URL. The backend points Stripe at the web pages derived from `FRONTEND_URL` (`/subscription/success?session_id=...` and `/membership`), and no deep-link scheme or redirect allow-list exists, so the app is never told the outcome. Accepting a client-supplied return URL was rejected as an open-redirect risk, and building deep-link infrastructure is out of scope for this screen.

The fallback is the same pattern used by SafePay checkout and Payout: a `checkoutLaunched` ref records that _this_ screen opened Stripe, and only then does an `AppState` transition to `active` refetch `queryKeys.subscription.current`. The listener subscribes once and reads the refetch function from a ref, so react-query's per-render object identities do not cause it to resubscribe.

Purchase is never inferred from `Linking.openURL` succeeding or from the browser closing. Provisioning is done by the Stripe webhook through `services/stripe/provisioning.provisionSubscriptionFromSession`, and the screen only re-reads server state. `GET /api/stripe/checkout-session/:sessionId` exists and enforces that `session.metadata.userId` matches `req.userId`, but mobile cannot obtain a session ID without parsing it out of a Stripe redirect URL it never sees, so that endpoint is not used here. Because provisioning is asynchronous, the screen states plainly that activation can take a few seconds after returning.

### Web membership page

The same endpoint backs `frontend/src/pages/MembershipPage/MembershipPage.tsx`, which used to offer "Bytt til denne planen" to a paying subscriber and would now walk them into a `409`. It received the smallest truthful adjustment rather than a redesign: a `hasPaidSubscription` check derived from `stripeSubscriptionId` plus the same settled-status list the server uses, a `couponMakesFree` check on the displayed total, and a `canCheckout` predicate that both the CTA and `handleCheckout` respect. A paying subscriber now sees an explanation pointing at the subscription-management card that already exists further up the same page instead of a button that cannot succeed, and the label is plain "Start abonnement" — the old label branched on the plan _name_, which told free-tier users they were "switching". On `active_subscription_exists` the page invalidates `['my-subscription']` and on `plan_inactive` it refetches the catalogue, since `usePlans` there holds plans with `staleTime: Infinity`. Cancel and resume on that page were not touched.

### Verification status

TypeScript validation passes with zero errors. The backend guards are covered by `backend/__tests__/subscriptionCheckoutGuards.test.js` and `backend/__tests__/subscriptionProvisionConflict.test.js`, written in the existing jest style; note that the backend jest suite cannot execute in the Linux development sandbox because jest 30 resolves through `unrs-resolver` and only the Windows native binding is installed — this affects pre-existing tests identically and is a sandbox limitation, not a test failure. The plan list, coupon validation, the paid-subscription gate, the duplicate-subscription refusal and the checkout launch have **not** been exercised against real Stripe on a device; live subscription purchase and the `409` path remain manually unverified.

### Change History

- added `queryKeys.plans.all`
- created `src/services/plans.service.ts` typed against the real `SubscriptionPlan` model, handling the bare-array response and inactive plans
- created `src/services/membership.service.ts` for coupon validation and subscription checkout, sending only `planId` and `couponCode`
- created `src/hooks/useMembership.ts` with `usePlans`, `useValidateCouponMutation`, `useCreateCheckoutSessionMutation`
- created `app/(app)/profile/membership.tsx` with type switcher, plan cards, coupon handling that resets on plan/type change, summary, and a purchase gate for existing paid subscribers
- reused `useCurrentSubscription` and `subscription.service.ts` rather than reimplementing subscription reads
- updated `app/(app)/profile/settings/index.tsx` to enable the `Medlemskap` row
- treated `stripeStatus: 'unknown'` as inconclusive in the paid-subscription check so a Stripe outage fails closed

Subsequent backend hardening pass, after the double-billing gap above was documented rather than fixed:

- created `backend/services/stripe/subscriptionState.js` as the single definition of a subscription that can still bill, shared by checkout and provisioning
- `createCheckoutSession` now refuses a second paid checkout with `409 active_subscription_exists`, before any Stripe call
- `createCheckoutSession` now rejects `isActive !== true` with `plan_inactive` and a coupon-zeroed total with `zero_total_subscription`, and passes a server-derived Stripe idempotency key
- `provisionSubscriptionFromSession` refuses to overwrite a different still-live `stripeSubscriptionId`, returning `conflicting_live_subscription` and logging both IDs
- exported `isResourceMissing` from `services/stripe/customers.js` so the missing-subscription check has one definition
- aligned the mobile settled-status list with the server's and taught the screen the new refusal codes
- adjusted the web membership CTA so a paying subscriber is directed to subscription management instead of a checkout that returns `409`
- `GET /api/plans` deliberately unchanged: the admin plan editor shares that public route and needs inactive plans, so the rule is enforced at checkout instead
- plan switching, proration and the Stripe Customer Portal remain intentionally unimplemented

## Active sessions / Aktive økter

The mobile route is `/(app)/profile/settings/sessions`, enabled from the previously deferred `Aktive økter` row in `Innstillinger → Konto`. No other deferred settings row was enabled. The screen does exactly three things: list the account's live login sessions, revoke one other session, and revoke all other sessions. It is not a device manager, it does not rename devices, and it cannot log out the device it is running on.

Data flows `ActiveSessionsScreen → useSessions hooks → auth.service.ts → api/client.ts → backend`. The screen contains no Axios or `fetch` call. Session APIs are mounted on the auth router server-side, so they were added to the existing `auth.service.ts` rather than a new duplicate API layer. The query key is `queryKeys.auth.sessions` (`['auth', 'sessions']`), nested under `auth` on purpose — see the account-isolation notes below.

### Endpoints

Three existing authenticated endpoints in `backend/routes/auth.js`, all behind `authenticate`:

`GET /api/auth/sessions` lists the caller's sessions. `DELETE /api/auth/sessions/:sessionId` revokes one. `DELETE /api/auth/sessions/revoke-others` revokes every session except the caller's own.

Route declaration order matters and is already correct in the repository, with an explanatory comment: `revoke-others` is declared **before** `/sessions/:sessionId`. If reversed, Express would match `revoke-others` as a `sessionId` parameter and the bulk revoke would silently degrade into a failed single-session delete. The order was left untouched.

### Response shape

`GET /api/auth/sessions` returns a **bare array**, not `{ sessions: [...] }`, already sorted `lastUsed` descending. `authController.getSessions` queries with `.select('-refreshToken -oldRefreshToken -__v')` and then passes each document through `sanitizeSession`, which deletes `refreshToken`, `oldRefreshToken` and `__v` a second time before spreading. Token material is therefore excluded twice, at the query level and at the serialisation level; this was verified to still hold and no change was needed.

Each element carries `_id`, `userId`, `ip`, `location`, `userAgent`, `device`, `browser`, `os`, `lastUsed`, `expiresAt`, `createdAt`, `updatedAt` and the computed `isCurrent`. The mobile `ActiveSession` type deliberately declares only the subset the screen actually renders: `_id`, `isCurrent`, `device`, `browser`, `os`, `location`, `ip`, `lastUsed`. `userId` is the caller's own id and has no purpose here; `userAgent` is the raw UA string; `expiresAt`, `createdAt` and `updatedAt` are refresh-token TTL bookkeeping. None of those four are displayed on the existing web Sessions view, so omitting them from the type keeps them out of the mobile UI by construction and mobile exposes no session metadata beyond what web already exposes. No field in the type is invented — every one is genuinely returned.

`DELETE /api/auth/sessions/:sessionId` returns `{ message }`. `DELETE /api/auth/sessions/revoke-others` returns `{ message, count }`, and `count` is used for the confirmation feedback text.

### Ownership enforcement

Mobile never sends a `userId`, a session owner, or any token as authority. The single revoke sends only the public session `_id` in the path.

The backend derives the user from the authenticated request (`req.user?._id || req.userId`) and the current session from the `sid` claim of the presented JWT (`req.sessionId`, set by `middleware/auth.js`). Both revoke handlers were audited:

`revokeSession` runs `Session.deleteOne({ _id: sessionId, userId })`. The delete is constrained by **both** the session id and the owner, so User A supplying User B's session id deletes nothing and receives `404`. A non-existent session and a foreign session are deliberately indistinguishable to the client, which avoids using the endpoint as an existence oracle.

`revokeAllOtherSessions` runs `Session.deleteMany({ userId, _id: { $ne: currentSessionId } })`. The current session is excluded **server-side**, so preserving it does not depend on mobile filtering. This was the specific property checked before exposing the bulk button, and it already held.

The static audit found **no sessions security defect**, so the backend was not modified in this task. `routes/auth.js`, `controllers/authController.js`, `middleware/auth.js`, `models/Session.js`, `utils/tokenUtils.js`, `models/PushToken.js`, `controllers/pushTokenController.js` and `sockets/chat.socket.js` are all unchanged.

### Identifying the current session

`isCurrent` is computed server-side in `sanitizeSession` by comparing each session `_id` against the `sid` claim of the token used to make the request. The screen treats that flag as the only source of truth and renders a `Nåværende` badge from it. Current-session identity is never inferred from device name, IP address, platform, `lastUsed` recency, or position in the list — any of those would be spoofable or simply wrong when two similar devices are logged in.

The current session shows no `Logg ut` action. Ending the current session belongs to the ordinary logout flow on the profile screen, which also runs the full teardown (push-token deactivation, query-cache disposal, chat-socket destruction). The screen never calls `DELETE /api/auth/sessions/:currentSessionId`; the backend would technically permit it, but exposing it here would leave the app holding a token whose session row is gone, without the teardown, so it is intentionally not surfaced.

Server ordering is preserved. The list is only re-sorted client-side to lift the current session to the top for readability; the backend `sort({ lastUsed: -1 })` was not changed for visual reasons.

### Revocation is immediate, not deferred to token expiry

`middleware/auth.js` re-validates the session on **every** authenticated request: it reads `decoded.sid`, rejects a token without one, then runs `Session.findOne({ _id: sessionId, userId: decoded.id })`. If the row is gone it clears the auth cookies and responds `401` with `code: 'SESSION_REVOKED'`.

So deleting the row is immediately effective — the revoked device loses access on its very next API call, regardless of the access token's remaining 1-hour lifetime. UI copy reflects exactly that ("mister tilgangen umiddelbart ved sitt neste kall mot Jobblo") and deliberately does **not** claim the device stays logged in until the token expires, which would be false.

The same middleware refreshes `lastUsed` on each authenticated request, which is why `lastUsed` is labelled `Sist aktiv` and formatted in Norwegian locale (`toLocaleString('nb-NO', …)`, e.g. `25. aug. 2026, 18:30`). It is **not** a presence signal. The backend has no presence state, so no "online now" indicator is rendered and a recent `lastUsed` is never presented as proof that a device is currently connected.

### Device, location and IP are diagnostics only

The device icon is chosen from a lowercased join of `device`, `os` and `browser`: tablet or iPad maps to a tablet icon, mobile/android/iphone/ios to a phone icon, everything else to a desktop icon. Tablet is tested first because Android tablets report both `android` and `tablet`. This inference is cosmetic and carries no security weight.

`device` is built server-side in `utils/tokenUtils.createSession` as `` `${os} ${formFactor}` `` from `express-useragent` (`app.use(useragent.express())` is applied in `app.js`, so `req.useragent` is genuinely populated), with `formFactor` one of `Mobile`, `Tablet`, `Desktop`. Unresolved fields default to the literal string `Unknown`. The screen therefore filters those literals out and titles each row `browser · os` — matching the web view — falling back to `Ukjent enhet` / `Ukjent mobil` / `Ukjent nettbrett` rather than rendering `Unknown · Unknown`.

`location` is coarse and IP-derived: `getGeoLocation` returns `'Localhost'` for `::1` and `127.0.0.1`, otherwise `"City, Country"` from ip-api.com, otherwise `'Unknown'`. It is presented as approximate diagnostic information; the security note states explicitly that place and IP are derived from the network and are not precise position. Nothing on the screen claims GPS accuracy. A missing or `Unknown` location renders `Ukjent sted`, and loopback addresses (`::1`, `127.0.0.1`, `::ffff:127.0.0.1`) render as `Lokal tilkobling` instead of a raw `::1`.

### Revoking

Both actions require confirmation through the shared `Dialog` component. Single revoke asks `Er du sikker på at du vil logge ut denne enheten?` plus the device label; bulk revoke asks `Er du sikker på at du vil logge ut alle andre enheter?` and states that the current device stays logged in. The bulk button only renders when `otherSessionsCount > 0`, labelled `Logg ut alle andre (N)`.

Each action is a single `useMutation` call. Every revoke control is disabled while either mutation is pending, which prevents duplicate taps and prevents a single revoke racing the bulk revoke.

On completion, only `queryKeys.auth.sessions` is invalidated, from `onSettled` so that a failure also resyncs the list. The QueryClient is never globally cleared and `authStore` is never touched: another device being revoked says nothing about this device's auth state, and clearing auth here would log the user out of the phone in their hand. The current session remains valid through both operations.

### Errors

All user-facing failure text is fixed local Norwegian copy; no server-provided string is passed through. This is deliberate — `sendServerError` returns `error.message` outside production, which can contain Mongo or driver internals, so mapping to local copy makes it impossible for a stack trace or raw DB error to reach the UI.

A failed initial load renders `ErrorState` with `Prøv igjen`, distinguishing `401` (`Pålogging kreves`), `5xx` (generic server error), and no-response network failure. Revoke failures render an inline banner: `404` is treated as neutral information (`Denne økten var allerede logget ut. Listen er oppdatert.`) because it means the session was already revoked elsewhere or expired via the TTL index on `Session.expiresAt`, and the list has just been refetched; `403` reports missing access; `5xx` and network failures report generically. Neither a network failure nor a `500` clears auth.

If **this** session receives `401 SESSION_REVOKED` — the user revoked this device from another device — the existing centralized handling stays authoritative. The `api/client.ts` response interceptor clears the stored `token` and `user` on any `401`; no logout logic is duplicated inside the screen, which only shows `Økten din er ikke lenger gyldig. Logg inn på nytt.` A pre-existing limitation worth recording: that interceptor does not itself call `useAuthStore.logout()`, so the Zustand `isAuthenticated` flag stays `true` until the next `hydrate()` and the app can briefly render authenticated UI whose requests all fail. That is existing centralized behaviour affecting every endpoint, not something introduced or worked around here.

An empty array renders a truthful empty state, `Ingen aktive økter funnet`. No local "this device" row is manufactured to fill the gap — if the server reports no sessions, the screen says so.

### Cache and account isolation

Session data lives **only** in the TanStack server cache. It is never written to AsyncStorage, never put in Zustand, and never persisted, so there is no separately persisted session state that could outlive an account.

The existing isolation architecture in `src/store/authStore.ts` already covers the User1 → User2 case. `clearAuthenticatedSession()` runs `deactivateRegisteredPushToken()`, `queryClient.cancelQueries()`, `queryClient.removeQueries()` and `destroyChatSocket()`. It is called from `logout()`, and also from `login()` when the incoming user id differs from the stored one, so the cache is disposed whether or not User1 logged out cleanly first. Because `queryKeys.auth.sessions` is an ordinary query key it is removed by that blanket `removeQueries()`, and because the query uses `staleTime: 0` with `refetchOnMount: 'always'` the screen always refetches on entry. User2 therefore cannot momentarily see User1's session list. No new teardown logic was added and the existing logout teardown was not modified.

### Known gaps — push tokens, open sockets and mobile logout

Three limitations were found by static audit and are documented rather than silently patched, because fixing any of them would mean inventing cross-table cleanup, new realtime infrastructure, or a logout contract change that current architecture does not support.

**Push tokens survive session revocation.** `models/PushToken.js` stores `token`, `userId`, `platform`, `deviceId`, `active` and `lastSeenAt`. There is no `sessionId` field and `controllers/pushTokenController.js` contains no reference to `Session` at all — `register` upserts by `{ token }` and `deactivateCurrent` matches `{ token, userId }`. Session and PushToken ownership are simply not connected in the schema. Consequently, revoking a session does **not** deactivate that device's push token: the revoked device keeps `active: true` and can still receive push notifications until it next calls the deactivate endpoint itself. The Sessions screen does not touch another device's push token, since there is no ownership link that would make such a write correct.

**Already-open sockets are not force-disconnected.** `sockets/chat.socket.js` verifies the JWT at handshake, then loads `Session.findById(decoded.sid)` and rejects the connection when the session is missing or its `userId` does not match the token's `id`. That blocks a revoked session from opening a **new** socket, but there is no session-targeted revocation channel to terminate a socket that is already connected, so an open chat connection belonging to a revoked session can persist until it disconnects for other reasons. The mobile screen does not attempt to disconnect another device's socket and no realtime infrastructure was added. There is no automatic realtime logout of other devices — only the immediate `SESSION_REVOKED` rejection on the next HTTP request described above.

**Mobile logout does not end the server session.** `src/store/authStore.ts logout()` is entirely local: it deactivates the push token, cancels and removes all TanStack queries, destroys the chat socket, and clears `token`/`user` from storage. It never calls the backend. `authController.logout` is the only code path that deletes a `Session` row on sign-out, and it needs the `refreshToken` cookie — which the mobile client never sends, because mobile does not use `/auth/logout` or `/auth/refresh-token` at all. The consequence for this screen is that logging out of the app on a phone leaves that phone's `Session` row in place, so it keeps appearing in Aktive økter until the 7-day TTL on `Session.expiresAt` removes it. Revoking it from this screen is therefore a real, useful action rather than a no-op. The screen's copy for the current session avoids claiming that profile logout ends the server session.

### Secrets

No access token, refresh token, old refresh token, JWT `sid`, or raw authorization header is displayed, logged, or stored by this feature. The only identifier used is the public session `_id`, and only as the path parameter of the revoke endpoint.

### Verification status

The official TypeScript 7 compiler cannot run in the Linux development sandbox: `npx tsc --noEmit` fails with `Unable to resolve @typescript/typescript-linux-x64`, because TS7 ships platform-specific native compilers and only the Windows package is installed, which is correct for the developer machine. The official typecheck is therefore **not** claimed to have passed here. The JS-based fallback compiler was run instead — `node ../frontend/node_modules/typescript/lib/_tsc.js --noEmit --project tsconfig.json` — which exits 0 with zero errors across the project. No `node_modules` were modified. No backend JavaScript changed, so no `node --check` run was required.

The screen has **not** been runtime-verified. Rendering the list on a device, confirming the `Nåværende` badge against a real second login, and observing the `SESSION_REVOKED` response on a revoked device all require manual testing by the developer. Expo was not started or restarted.

### Change History

- added `queryKeys.auth.sessions` (`['auth', 'sessions']`), nested under `auth` so existing logout teardown disposes of it
- extended `src/services/auth.service.ts` with the `ActiveSession` type plus `getActiveSessions()`, `revokeSession(sessionId)` and `revokeOtherSessions()`, typed to actually-returned fields only and sending no `userId`
- created `src/hooks/useSessions.ts` with `useActiveSessions()`, `useRevokeSessionMutation()`, `useRevokeOtherSessionsMutation()`, each invalidating only the sessions key
- created `app/(app)/profile/settings/sessions.tsx` with server-truth `isCurrent` badge, no revoke action on the current session, `Dialog` confirmations, pending-tap protection, and truthful empty/error states
- updated `app/(app)/profile/settings/index.tsx` to enable only the `Aktive økter` row
- backend unchanged: the static audit found ownership constraints, current-session exclusion, token exclusion and route order all already correct
- documented the push-token and open-socket revocation gaps instead of inventing cross-table cleanup or realtime revocation

## Delete Account / Slett profil

Screen:
File: `app/(app)/profile/settings/delete-account.tsx`
Route: `/(app)/profile/settings/delete-account` (Expo Router push from Settings row `Slett profilen min`)
Purpose: Irreversible anonymisation (soft delete) of the currently signed-in user's profile, with server-side eligibility validation (active orders, active Stripe subscription), stable machine-readable error codes, SLETT-typed confirmation, local security teardown and router reset to the signed-out boundary.

Settings row (File: `app/(app)/profile/settings/index.tsx`):
Title: `Slett profilen min`
Subtitle: `Denne handlingen kan ikke angres`
Icon: `Trash2` (lucide-react-native)
Treatment: `danger` (destructive)
onPress: `router.push('/profile/settings/delete-account')` — was previously disabled / "Kommer"; now the only row enabled for deferred settings screens.

### Route, endpoint and ownership

Mobile route: `/profile/settings/delete-account` (file-based: `app/(app)/profile/settings/delete-account.tsx`)
Backend endpoint: `DELETE /api/users/:id`
Request body: **empty** (DELETE body is not used — mobile sends no fields. The web frontend historically sent `{ feedback?: string }` but the backend `deleteUser` handler has never read `req.body.feedback`; mobile therefore omits the field and does not tell the user feedback was accepted.)

Authorization / ownership is enforced **server-side only** and authoritatively:

- Route requires a valid JWT (middleware `auth`), then `authorizeUser(req, id)` (file `backend/routes/users.js`) succeeds only when `req.user.role === 'superAdmin'` **or** `req.userId === targetId`. Changing the URL `:id` to another user never allows deletion.
- Mobile always calls `DELETE /api/users/${currentUser.id}` using the id stored in authStore after login — the URL id is informational, the backend sid→userId binding is the guard.

### Confirmation UX

Confirmation word: `SLETT`
Comparison: `confirmText.trim().toUpperCase() === 'SLETT'` (case-insensitive after trim, leading/trailing whitespace ignored)
The destructive delete button is **disabled** until the comparison returns true **and** a current userId exists. No single-tap delete. Button shows loading spinner and is disabled during the mutation.

### Explanatory copy (Norwegian, truthful)

The screen renders in this order before the confirmation input:

1. Title: `Slett profilen din`
2. Three paragraphs:
   - **Irreversible:** `Denne handlingen kan ikke angres. Når profilen er slettet, kan den ikke gjenopprettes.`
   - **All devices logged out:** `Du blir logget ut fra alle enheter som er innlogget med denne kontoen.`
   - **Active jobs + subscription first:** `Avventende, betalte eller pågående oppdrag (SafePay) må løses først, og et aktivt medlemskap må si opp og nå slutten av perioden før sletting er mulig.`
   - **Completed records retained anonymised:** `Fullførte finansielle poster (fakturaer, utbetalinger, ordrehistorikk) beholdes i henhold til bokføringsloven, men uten personlig profilidentitet (navn, e-post, profilbilde osv.).`

Four informative cards follow (lucide icons + muted text):

- ShieldAlert: `Aktivt medlemskap blokkerer sletting`
- AlertTriangle: `Pågående oppdrag / betalinger må ferdigstilles først`
- LogOut: `Alle økter avsluttes umiddelbart`
- Trash2: `Profilbilde, banner, sertifikater og personlige felt fjernes`

### Server eligibility checks (order of execution in `backend/controllers/userController.js deleteUser`)

deleteUser runs these gate checks **before** any write:

1. **Live SafePay orders — 409 `active_orders_exist`**
   Query: `Order.find({ $or: [{customerId:id},{providerId:id}], status: { $in: ['awaiting_payment','paid','in_progress','ready_for_review','disputed'] } })`
   Non-empty → 409 `{ error: 'Du har aktive oppdrag eller betalinger. Vennligst vent til disse er fullført før du sletter kontoen.', code: 'active_orders_exist' }`
   This list (`awaiting_payment, paid, in_progress, ready_for_review, disputed`) is the verbatim existing list — not modified, only a stable `code` field added for machine readability (previously the web frontend matched on text only).
   Mobile shows an amber AlertTriangle card with the server message. No deep-link CTA is rendered (no canonical active-jobs route contract was given; user navigates back manually).

2. **Active Stripe subscription — 409 `active_subscription_exists`**
   Uses the shared helper `findBillingCapableSubscription(stripe, userId)` from `backend/services/stripe/subscriptionState.js`.
   Billing-capable (deletion-blocking) Stripe statuses from the shared enum:
   - `active`
   - `trialing`
   - `past_due`
   - `unpaid`
   - `incomplete`
   - `paused`
   - **PLUS any subscription with `cancel_at_period_end === true` whose `status` is still one of the above.** Cancel-at-period-end is NOT treated as already cancelled — the period must genuinely end and Stripe report a settled status before deletion is allowed (because an invoice can still be generated mid-period).
     If helper returns `{ blocking: true }`:
   - 409 `{ error: 'Du har et aktivt abonnement. Si opp abonnementet og vent til abonnementsperioden er avsluttet før du sletter profilen.', code: 'active_subscription_exists' }`
     Mobile shows a red ShieldAlert card + CTA: `Gå til abonnement → onPress: router.push('/profile/settings/subscription')` — user cancels there and waits; the delete flow never cancels or prorates automatically, never calls `stripe.subscriptions.update({ cancel_at_period_end })`.
     If the Stripe API/key/config cannot be reached: `findBillingCapableSubscription` throws `{ code: 'subscription_check_unavailable' }`, which deleteUser converts into **503**:
   - `{ error: 'Kunne ikke verifisere abonnementsstatus akkurat nå. Prøv igjen litt senere.', code: 'subscription_check_unavailable' }`
     Fail-closed: when status is unknown, deletion blocks. No silent fallback. Stripe is loaded via try-catch `require('../config/stripe')` so a missing env doesn't crash the whole handler; if stripe module is unavailable the guard is skipped (deploy-without-Stripe case only).

3. **Other error codes**
   - 400 / 403: ownership failure → generic "Kan ikke slette denne kontoen." (do not clear auth, remain signed in)
   - 404: user already deleted → same treatment, `isDeleted` guard redirects mobile to login on load anyway
   - network error / timeout: show inline error, allow retry
   - 500: generic "Noe gikk galt. Prøv igjen senere."

### Anonymisation vs hard deletion

The user row is **not** removed from Mongo. It is updated with `{ isDeleted: true, accountStatus: 'deactivated', deletedAt: new Date(), ...anonymisedFields }`. Reasons:

- Norwegian bokføringsloven requires 5-year retention of financial records (Order, Payment, Payout) that reference User via `customerId` / `providerId` ObjectId foreign keys.
- Hard-deleting the row would break those foreign keys, orphan the historical records and prevent future customer service audits / tax inspection.

Deleted account login is blocked on all paths (see OAuth / login section below). A deleted account is **not** resurrectable by the user through any supported flow, including password reset (accountStatus check returns 401 before any OTP).

### Server-side cleanup cascade (inside deleteUser, after all guards pass, single `try/catch` per subsystem so partial failure doesn't prevent completion)

1. **User field anonymisation** — entire schema audited. Fields explicitly cleared:
   - Identity/name: `firstName`, `lastName`, `name`
   - Contact: `email` → unique placeholder `slettet+${user._id}@jobblo.invalid`, `phone` null
   - Location/address: `street`, `city`, `state`, `zip`, `country`, `location.coordinates`
   - Personal: `birthDate`, `gender`
   - Company: `company`, `orgNumber`, `orgType`, `vatNumber`, `website`
   - Profile content: `bio`, `about`, `tagline`, `role`, `profileCompleted` → false, `profileCompletionSteps` → {}, `skills` → [], `tags` → []
   - Locations/rates: `locations` → [], `hourlyRate` null, `serviceArea` null
   - Media URLs: `avatarUrl`, `bannerUrl`, `portfolio` → [], `previousProjects` → [], `certifications` → [], `experience` → []
   - Social/identity: `oauthProviders` → [], `identityVerification` → {} (all fields nulled, including `subject`, `idpMetadata`, `method`)
   - Availability: `availability` → [], `availabilityText` null
   - Social graph: `blockedUsers` → [], `favorites` → []
   - Loyalty/usage: `pointsBalance` → 0, `pointsHistory` → [], `monthlyContactUsage` → { count: 0, resetAt: null }
   - Auth: `password` overwritten with bcrypt of 32 random bytes (password login impossible, even if the accountStatus check were bypassed), `resetPasswordToken`, `resetPasswordExpires`, `otpSecret`, `otpEnabled`, `emailVerificationToken`, `verificationToken`, `verificationExpires` nulled.

   Fields intentionally retained (not modified) — explained in Retained identifiers section below:
   - `_id`, `createdAt`, `updatedAt`, `deletedAt`, `isDeleted`, `accountStatus`
   - `role` (historical job records still refer to role context)
   - `subscription`, `planType`, `verified`, `isTrusted`, `lastLogin`
   - `averageRating`, `reviewCount`, `completedJobs` (public historical reputation signals that remain truthful even after profile erased)
   - **Stripe:** `stripeCustomerId`, `stripeCustomerIdTest`, `stripeConnectAccountId`, `payoutOnboardingStatus`, `payoutEnabled`, `chargesEnabled`, `detailsSubmitted`, `connectAccountCreatedAt`, `payoutMethod`
   - **Financial aggregates:** `earnings`, `spending`
   - Payout fields (`bankAccountNumber`, `iban`, `bicSwift`, `vippsHandle`) — these are `select: false` in schema so they're not normally returned to clients; their values are untouched but effectively inaccessible.

2. **Sessions deleted.** `Session.deleteMany({ userId: id })` — existing behavior, preserved. Because `middleware/auth.js` re-loads `Session.findById(sid)` on every authenticated HTTP request and returns `SESSION_REVOKED` when the sid row is missing, **every device** immediately loses API auth on their next call, regardless of whether the device has ever opened logout. No replacement sessions are created.

3. **Push tokens deleted (SERVER-SIDE, all devices).** `PushToken.deleteMany({ userId: id })` — **NEW** (this was the bug: previously only the current device's logout call ran `deactivateCurrent`, leaving tokens on other devices indefinitely active if that app never opened again). Now deleteUser unconditionally removes every PushToken document owned by the user — no other device will ever deliver a Jobblo push for this userId again, because push service lookups match by `{ userId, active: true }` and the documents no longer exist.

4. **IdentityClaim documents deleted.** `IdentityClaim.deleteMany({ userId: id })` — **NEW.** BankID/Idura stores identity claims in a SEPARATE collection (not only under `user.identityVerification.subdoc`) with `_id = IdentityClaim.keyFor('idura','no_bankid', subject)` (unique index). If we only nulled the subdoc, the same BankID person trying to register a new Jobblo account later would hit unique-key collision on the claim `_id`. Deleting the claims fully removes the dead-user binding from the Idura namespace.

5. **Uploaded assets / Cloudinary deletion.** `Promise.allSettled` (never let Cloudinary/CDN failure prevent account completion) on every object whose schema actually stores a **publicId** (vs only imageUrl string):
   - `user.avatarPublicId` → `cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })`
   - `user.bannerPublicId` → same
   - `user.certifications[].publicId` → each non-null one destroyed
     **NOT deleted (no reliable publicId):** `portfolio[].imageUrl`, `previousProjects[].imageUrl`. The schema stores these as plain URL strings with no `{url, publicId}` sub-object, so the uploader's destination is ambiguous across local disk, Azure blob storage, and Cloudinary. URL-parsing a resource path from the CDN hostname would be unreliable across providers. The portfolio/previous-project arrays themselves are emptied (null content), so the URLs are no longer reachable through the Jobblo API even though the raw underlying blobs may remain in storage. This gap is explicitly stated: do not advertise "all uploaded files permanently deleted" to the user.

   SafePay financial evidence (Order.invoiceUrl, Payment.receiptUrl, etc.) is intentionally untouched. We do not have a clear business/legal retention policy that would allow destroying transaction evidence; it is left in place, and the anonymised userId foreign key is the only link back.

6. **Socket disconnect — best effort.** `deleteUser` iterates the current Node process' connected Server Sockets:
   ```js
   try {
     for (const sock of io.sockets.sockets.values())
       if (sock.userId && sock.userId.toString() === id.toString()) sock.disconnect(true);
   } catch {}
   ```
   Forcible close (`true`) of each socket whose handshake-auth matched this userId. **Residual gaps documented below.**

### Local teardown (mobile client, after DELETE 2xx returns)

The backend has already removed all Session rows by the time the HTTP 2xx response returns. So:

- We **do NOT** call `POST /api/auth/logout` — it would only 401 and add nothing.
- We **do NOT** wait for an authenticated push-token deactivation call — the server already `PushToken.deleteMany`-ed every token for this user. The logout helper's `deactivateRegisteredPushToken()` still runs but its 401 is swallowed inside a `.catch(() => undefined)`.

Mutation `onSuccess` path:

```js
onSuccess: async () => {
  try {
    await authStore.getState().logout();
  } finally {
    router.replace('/login');
  }
};
```

`authStore.logout()` → `clearAuthenticatedSession()` (already existed, reused — no new teardown abstraction):

1. `await deactivateRegisteredPushToken()` (best-effort, catch-swallowed 401 — server already did the real cleanup)
2. `queryClient.cancelQueries()` (abort all in-flight private requests — prevents User2 ever seeing User1 stale responses mid-flight)
3. `queryClient.removeQueries()` (drop ALL cached server state)
4. `destroyChatSocket()` (close THIS device's authenticated chat socket, send 'disconnect' event, release resources)
5. `storage.removeItem(authTokenKey)` + `storage.removeItem(userKey)` (only account-specific persisted keys — **NOT** `AsyncStorage.clear()`, never wipe unrelated app state)

`router.replace('/login')` uses Expo Router replace semantics so the device Back button cannot reopen authenticated Profile/Delete-Account screens. The navigation stack is reset to the signed-out boundary.

### Deleted-account login prevention on ALL auth paths (backend patches applied)

Before this change: password login had an accidental pseudo-block (random non-bcrypt password overwrite made bcrypt.compare fail), but ALL OAuth paths (Vipps, Google, BankID/Idura) completely bypassed password and happily called `createSession` on any user whose provider identity matched, including deleted ones. This was a resurrection bug.

Patches applied (guards inserted **between** user resolution and createSession — never after):

1. **Password login — `backend/controllers/authController.js login`**
   Between `isPasswordValid` success and `createSession`:

   ```js
   if (user.isDeleted || user.accountStatus === 'deactivated') {
     return res.status(401).json({ error: 'Kontoen er deaktivert eller slettet.' });
   }
   ```

2. **Google OAuth callback — `backend/routes/auth.js /auth/google/callback`**
   Passport resolves → user object returned. Between `if (!user) redirect login` and `createSession` try:

   ```js
   if (user.isDeleted || user.accountStatus === 'deactivated') {
     return res.redirect(`${frontendBase}/login?error=account_deactivated`);
   }
   ```

3. **Vipps login callback — `backend/controllers/vippsController.js vippsLogin`**
   After switch-case resolves the user (login / linked / register + ensureDefaultSubscription), before `createSession`:

   ```js
   if (user.isDeleted || user.accountStatus === 'deactivated') {
     return res.redirect(frontendUrl(`/login?error=account_deactivated`));
   }
   ```

4. **Idura / BankID callback — `backend/controllers/iduraAuthcontroller.js authCallback`**
   On the returning-existing-user branch:
   ```js
   await applyVerification(existing._id, identity);
   if (existing.isDeleted || existing.accountStatus === 'deactivated') {
     return res.redirect(frontendUrl(`${failureTarget}?error=account_deactivated`));
   }
   ```
   (Note: on the _new-user_ branch of Idura, we never hit this — deleted users will never collide with new registration because `IdentityClaim.deleteMany({ userId: id })` removes their dead subject claim during deleteUser.)

All four paths are covered. Password reset is also blocked incidentally: the deleted account's email is overwritten to `slettet+id@jobblo.invalid`, so the user's real email no longer resolves to any user in `POST /forgot-password` → no reset email is ever sent for a deleted account (email equality is the only matching rule on that unauthenticated endpoint).

### Service + mutation architecture

Screen uses `useMutation` from `@tanstack/react-query` — no direct axios/fetch in screen, no inline fetch wrapper.

Service (File: `src/services/profile.service.ts` — added 4 lines, existing service reused, no new file):

```ts
export async function deleteCurrentUser(userId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/users/${userId}`);
  return response.data;
}
```

`apiClient` is the central axios instance from `src/services/api/client.ts` with JWT interceptor, baseURL, standard error normalizer — already used by every other service. Reuse, not duplicate.

### Retained financial/external identifiers

Truthful list of fields intentionally kept on the User row after deleteUser runs. **Do not claim full GDPR "right to be forgotten" — these identifiers are required for reconciliation or the foreign keys would break historical records:**

| Field                                                                                                                                | Why retained                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                                                                                                                                | Mongo primary key — `Order.customerId`, `Order.providerId`, `Payment.userId`, `Payout.userId`, `Review.revieweeId` all reference this. Removing orphans the records.             |
| `role`                                                                                                                               | Historical context for old jobs (provider vs customer behavior). Public enum value, no PII.                                                                                      |
| `averageRating`, `reviewCount`, `completedJobs`                                                                                      | Aggregate reputation numbers, not PII. Remaining truthful even after PII gone.                                                                                                   |
| `earnings`, `spending`                                                                                                               | Financial aggregates used for payout/accounting dashboards — bokføringsloven.                                                                                                    |
| `subscription`, `planType`                                                                                                           | Historical record of what plan was active.                                                                                                                                       |
| `stripeCustomerId`, `stripeCustomerIdTest`                                                                                           | External Stripe id needed if we later have to audit/lookup a Stripe customer for refunds/reconciliation. Not PII by itself, meaningless to anyone without Stripe account access. |
| `stripeConnectAccountId`, `payoutOnboardingStatus`, `payoutEnabled`, `chargesEnabled`, `detailsSubmitted`, `connectAccountCreatedAt` | Connect onboarding state. Needed for payout audit trail.                                                                                                                         |
| `verified`, `isTrusted`, `lastLogin`                                                                                                 | Status signals. Not PII.                                                                                                                                                         |
| `createdAt`, `updatedAt`, `deletedAt`                                                                                                | Timestamps, no PII.                                                                                                                                                              |

Payout fields (`bankAccountNumber`, `iban`, `bicSwift`, `vippsHandle`): schema is `select: false` so they are never returned by default queries. Not actively nulled by deleteUser because they are effectively inaccessible. An audit-only accessor that explicitly `select('+iban')` can still read them — that is the desired behavior for accounting inspection, NOT for normal API clients.

### Feedback field (web/mobile parity gap)

Web `DeleteAccountView.tsx` renders a `<textarea name="feedback">` and includes `{ feedback }` in the DELETE request body. Backend `deleteUser` handler **never reads** `req.body.feedback`. No `DeletionFeedback` model, no analytics write, no log line uses it. Mobile **omits the feedback UI entirely** rather than lie to the user that their input is recorded. The web frontend has an open cosmetic gap. This task deliberately does NOT invent a deletion-feedback subsystem to match web's vanity textarea.

### Unresolved / documented gaps (do not silently claim they are solved)

1. **Socket.IO per-event session re-auth — not implemented.**
   `sockets/chat.socket.js` handshake does `Session.findById(decoded.sid)` at connect time and rejects missing. But after the handshake succeeds, individual socket event handlers (chat message, typing, etc.) do **not** re-check the Session row. If deleteUser runs and another device already has an open authenticated socket on a DIFFERENT Node process or under a Socket.IO Redis adapter:
   - Our server-side `io.sockets.sockets.values()` loop only sees sockets in the **current process memory**.
   - Cross-process sockets won't be iterated and keep running until their next event triggers HTTP auth or they naturally disconnect.
     Result: for a brief window (< typical socket heartbeat interval, worst case a few minutes on idle), another device's open socket can still emit chat events even though its Session DB row is gone. The next HTTP call from that device still correctly gets SESSION_REVOKED — only the already-open socket path has residual auth. Fixing this correctly would require per-event session middleware on all socket handlers (expensive, ~roundtrip to Mongo every keystroke) or a Redis pub/sub "kick userId" broadcast channel that every Socket.IO worker subscribes to. Both are explicitly out of scope per the task spec ("do NOT build a large new realtime system"). Documented only.

2. **Portfolio and previous-project image blobs — not deleted from storage.**
   Schema only stores `imageUrl` string — no publicId. We cannot reliably know whether a URL points to Cloudinary, Azure Blob, local disk `/uploads/`, or a 3rd-party CDN the user pasted. Extracting the path and guessing the resource token is not safe (could delete wrong resource, or fail silently leaving garbage). We empty the arrays so the Jobblo API never serves the URLs again. The raw blobs may remain in their storage bucket. If you want this closed, the real fix is to upgrade portfolio/previousProject schemas to `{ url, publicId, storageProvider }` sub-objects at upload time, then the same destroyPublicId helper works. Not done in this task (would require an upload middleware + migration, outside scope).

3. **SafePay financial evidence — untouched by design.**
   Order.invoiceUrl, Payment.receiptUrl, any SafePay receipt PDFs — we don't have a business policy that allows destroying transaction evidence, even after profile erasure. They remain. The link back to the user is the anonymised User._id only (no name, email, phone left).

4. **Cross-user OAuth linking — not a gap, audited safe.**
   `utils/oauthLinking.js resolveOAuthLogin` already requires identity match on the OAuth provider's `subject` / `providerId` — it NEVER matches purely on email equality (takeover prevention already). Deleted accounts have `oauthProviders` array emptied AND IdentityClaim rows deleted. Even if someone attempted to re-trigger the same OAuth flow, the identity lookup fails cleanly and the user is directed to new registration, not resurrection of the deleted row.

### Verification status

Typecheck: `cd jobblo-app && npx tsc --noEmit` → exit 0, zero errors.
Backend syntax: `node --check backend/controllers/userController.js`, `node --check backend/controllers/authController.js`, `node --check backend/routes/auth.js`, `node --check backend/controllers/vippsController.js`, `node --check backend/controllers/iduraAuthcontroller.js` — all exit 0.
Runtime / device: not verified in this environment (user will perform manual device/Expo verification). Expo NOT started, Metro NOT restarted — honored per instruction.

### Change History (Delete Account section)

Backend:

- rewrote `backend/controllers/userController.js deleteUser`: added subscription guard via shared `findBillingCapableSubscription`, PushToken + IdentityClaim cleanup, Cloudinary avatar/banner/cert publicId destroy, full schema audit of anonymised fields, stable 409/503 codes `active_orders_exist` / `active_subscription_exists` / `subscription_check_unavailable`, best-effort same-process socket disconnect by userId
- patched `backend/controllers/authController.js login`: added isDeleted/accountStatus guard before createSession
- patched `backend/routes/auth.js Google callback`: same guard, redirect to `login?error=account_deactivated`
- patched `backend/controllers/vippsController.js vippsLogin`: same guard
- patched `backend/controllers/iduraAuthcontroller.js authCallback`: same guard on returning existing-user Idura path
  Mobile:
- added `deleteCurrentUser(userId)` to `src/services/profile.service.ts` (reused apiClient, no new fetch)
- created `app/(app)/profile/settings/delete-account.tsx`: Norwegian explanatory copy, SLETT confirmation, useMutation, distinct 409 UI blocks for active-orders and active-subscription (latter links to subscription), local teardown via authStore.logout + router.replace('/login') in finally-block
- enabled `Slett profilen min` Settings row (`app/(app)/profile/settings/index.tsx`) — only deferred row enabled; no other Settings screens touched
  Documentation:
- appended this section documenting exact behavior, gaps and retained identifiers; no GDPR overclaim

## Location settings / Lokasjon

Route: `app/(app)/profile/settings/location.tsx` → `/profile/settings/location`, reached from the `Lokasjon` row in the `Annet` group of `app/(app)/profile/settings/index.tsx`. That row was the only one enabled for this feature.

### Scope — profile country only

This screen manages exactly one field: the free-text `country` on the user's own profile. That is the entire scope of the web equivalent (`frontend/src/components/profile/SettingsViews/LocationView.tsx`), which renders one `Land` input and one `Oppdater lokasjon` button.

There is **no** GPS, no device-geolocation permission request, no map, no coordinates, no municipality search and no county selection here, because `models/User.js` stores none of those as user-profile settings. Nothing in this screen asks for or reads location permissions.

### Distinct from job location

A job's location is a separate domain, owned by the Create Job flow, and it uses `address`, `city`, `coordinates`, `countyCode`, `municipalityCode` and `areaCode`. None of that is touched here, and none of Create Job's geocoding logic is reused. The two are also distinct in the service layer: the pre-existing `src/services/location.service.ts` serves the **job** location tree (`queryKeys.locations.tree` / `locations.stats`, consumed by `useLocationTree`) and is deliberately not used by this screen. The screen's footer note states the split in Norwegian so the distinction is visible in the product, not only in code.

### Endpoint reused — no new API

No new endpoint and no new service were created, because profile country is simply another profile-field update:

```
LocationScreen
  → useProfile() / useUpdateProfile()          (src/hooks/useProfile.ts)
  → getCurrentProfile() / updateCurrentProfile() (src/services/profile.service.ts)
  → apiClient                                   (src/api/client.ts)
  → GET /api/auth/profile   /   PUT /api/users/:id
```

There is no Axios or `fetch` call inside the screen.

`country` was confirmed to be accepted by the existing update endpoint: it is present in the `allowedUpdates` allow-list of `updateUser` in `backend/controllers/userController.js`, so no backend change was needed. It is also present in `SAFE_BASE` in `backend/utils/userProjections.js`, which means it is included in `OWN_USER_SELECT` and therefore returned both by `GET /auth/profile` and in the `PUT /api/users/:id` response — the initial value and the post-save value both come from the server.

### The country field

`models/User.js` declares `country: { type: String }` — a plain string with no `enum`, no `required` and no ISO-code constraint. The mobile screen preserves that representation exactly: it sends human-readable text such as `Norge`, never a fabricated country code. The value is `.trim()`-ed before being sent.

The initial value is `profile.country ?? ''`, read from the `useProfile()` query rather than from the persisted Zustand user, so it is not stale. Nothing in the mobile app reads `country` off the auth store, so the established profile sync in `useUpdateProfile` (which mirrors only `_id`, `name`, `lastName`, `avatarUrl`, `companyName` into `authStore`) was left unchanged.

Submission happens only on the explicit `Oppdater lokasjon` press (or the keyboard's done key) — never on keystroke. The button is disabled while the trimmed draft equals the trimmed server value and while the mutation is pending, and its label becomes `Oppdaterer...` while pending. Because `country` is optional on the backend, an empty value is a legitimate way to clear the field and is not blocked; it is only submittable when it actually differs from the stored value.

### Ownership enforcement

Ownership is decided by the server, not by mobile. `updateUser` calls `authorizeUser(req, id)`, which compares the token-derived `req.userId` against the `:id` in the path and returns `403 { error: 'Not authorized' }` unless they match or the caller is `superAdmin`. The user id mobile puts in the path is taken from the authoritative profile response (`profile._id`), with the stored user as fallback, but that id carries no authority — supplying someone else's id yields 403, not an edit. No `userId` is sent in the request body.

### Query invalidation

The existing `useUpdateProfile` mutation handles cache updates: on success it writes the server response into `queryKeys.auth.profile` via `setQueryData`, then invalidates that same key, then syncs the small display subset into `authStore`. Only the profile query is invalidated — the QueryClient is never globally cleared, and no other feature's cache is touched. The screen additionally resets its own draft from the server response rather than from the local input.

### Errors

All messages are Norwegian and fixed in the client; no raw Mongo or Axios text is surfaced. Backend 400s from this endpoint are internal English strings (`Invalid user ID format`, `No valid fields provided for update`) and Mongo failures are funnelled through `sendMongoError`, so nothing from the server is echoed verbatim.

| Condition             | Message                                                      |
| --------------------- | ------------------------------------------------------------ |
| No response (network) | `Ingen nettforbindelse. Sjekk internett og prøv igjen.`      |
| 400 validation        | `Landet kunne ikke lagres. Kontroller feltet og prøv igjen.` |
| 401                   | `Økten din er ikke lenger gyldig. Logg inn på nytt.`         |
| 403 ownership         | `Du har ikke tilgang til å endre denne profilen.`            |
| 404                   | `Fant ikke profilen din. Prøv å laste inn siden på nytt.`    |
| 5xx                   | `Serverfeil. Prøv igjen litt senere.`                        |

Neither a network failure nor a 5xx clears auth or logs the user out — the screen only renders a banner and the draft is kept so the user can retry. Session expiry remains the responsibility of the centralized 401 handling in `src/api/client.ts`; no logout logic is duplicated here. A failed profile load renders the shared `ErrorState` with a `Prøv igjen` retry rather than an empty screen.

### Blocked Users — intentionally skipped

The `Blokkerte brukere` row in the `Personvern` group remains disabled and shows the `Kommer` marker. It was intentionally not built, because the normal user-side blocking and unblocking flow is not currently part of the mobile product scope. No blocking or unblocking behavior was added, and no other settings row was changed by this feature.

### Verification status

Typecheck: the official `npx tsc --noEmit` could not run in this sandbox — TypeScript 7 resolves a platform-specific native binary and only the Windows one is installed (`Unable to resolve @typescript/typescript-linux-x64`). `node_modules` was not modified to work around it. The fallback diagnostic used instead is the plain TypeScript 5.8.3 compiler present in `frontend/node_modules`, run against this project's own `tsconfig.json`; it reports zero errors, but it is not the project's official compiler and is reported as a fallback, not as a passing official typecheck. The user's Windows environment should run `npx tsc --noEmit` to confirm.

Backend: no backend file was changed by this feature, so no `node --check` was required. `country` was already accepted and already projected.

Runtime / device: not verified here — manual device verification will be performed by the user. Expo was not started, Metro was not restarted, and no port was changed.

### Change History (Location settings section)

Mobile:

- `src/services/profile.service.ts`: added `country?: string` to `CurrentProfile` and `country: string` to `ProfileUpdate` (the only change needed to type an already-supported field)
- created `app/(app)/profile/settings/location.tsx`: single `Land` field seeded from `useProfile()`, saved through the existing `useUpdateProfile()` mutation, trimmed before send, dirty/pending-gated `Oppdater lokasjon` CTA, Norwegian error banner, footer note separating profile country from job location
- `app/(app)/profile/settings/index.tsx`: enabled only the `Lokasjon` row → `/profile/settings/location`; `Blokkerte brukere` left disabled

Backend: unchanged — `country` is already in `allowedUpdates` and in `SAFE_BASE`/`OWN_USER_SELECT`, and ownership is already enforced by `authorizeUser`.

Documentation: appended this section, and added the third known gap (mobile logout never deletes the server `Session` row) to the Active sessions section.

## Email settings / E-postadresse

Route: `app/(app)/profile/settings/email.tsx` → `/profile/settings/email`, reached from the `E-postadresse` row in the `Konto` group of `app/(app)/profile/settings/index.tsx`. That row previously read `E-post og telefon` and was disabled; it now carries only the e-mail scope, because no phone settings screen exists. Phone remains unbuilt and was not added as a placeholder.

### Endpoint used — generic profile update, no dedicated email endpoint

```
EmailSettingsScreen
  → useProfile() / useUpdateProfile()            (src/hooks/useProfile.ts)
  → getCurrentProfile() / updateCurrentProfile() (src/services/profile.service.ts)
  → apiClient                                    (src/api/client.ts)
  → GET /api/auth/profile   /   PUT /api/users/:id
```

No `email.service.ts` was created and there is no Axios or `fetch` call inside the screen. `email` is present in the normal-user `allowedUpdates` allow-list of `updateUser` in `backend/controllers/userController.js`, and in `SAFE_BASE` in `backend/utils/userProjections.js`, so it is both accepted by the update and returned by `GET /auth/profile` and by the update response. No backend file was changed.

The request body contains exactly one field, `{ email }`. No `role`, `verified`, `subscription`, `password`, Stripe field, `phone`, other profile field, or whole user object is sent, and no `userId` is sent in the body.

### Email is the login identifier

`authController.login` resolves the account with `User.findOne({ email: normalizedEmail }).select('+password')`, so the e-mail edited on this screen **is** the login identifier. After a successful change the next password login must use the new address. Nothing else needs to happen for that to be true — there is no separate credential record keyed to the old address.

### Normalization

`models/User.js` declares `email: { type: String, unique: true, required: true, lowercase: true, trim: true, index: true }`, so the backend lowercases and trims on write. `login`, `register` and `forgotPassword` all resolve accounts by `String(email).trim().toLowerCase()`.

Mobile normalizes identically before sending — `trim()` then `toLowerCase()`, so `"  Test@Example.COM "` is sent as `test@example.com`. The "changed" comparison is also done on the normalized values, so re-typing the same address in different case does not enable the button or fire a pointless request. Web, mobile and backend therefore share one normalization rule.

Shape validation uses `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, the same expression already used by mobile `login.tsx`, `register.tsx`, `forgot-password.tsx` and by the backend's `forgotPassword`. It rejects `''`, `'abc'`, `'abc@'` and `'@example.com'`. It is deliberately not an RFC-complete validator; the backend stays authoritative.

### Ownership enforcement

`PUT /api/users/:id` is mounted as `router.put('/:id', authenticate, upload.fields([...]), userController.updateUser)`, and `updateUser` calls `authorizeUser(req, id)`, which compares the token-derived `req.userId` with the `:id` in the path and returns `403 { error: 'Not authorized' }` unless they match or the caller is `superAdmin`. A normal user cannot change another user's e-mail by editing the URL. Mobile takes the id from the authoritative profile response (`profile._id`), falling back to the stored user, but that id carries no authority. This check was not weakened.

### Unique email and duplicate handling

`email` is declared `unique: true` with `index: true`, and `db.js` does not set `autoIndex: false`, so Mongoose's default index build applies. `updateUser` performs no explicit pre-check for duplicates; the driver's duplicate-key error is translated in the catch block by `sendMongoError` → `translateMongoError`, which maps code `11000`/`11001` to `409 { error: 'E-postadressen er allerede i bruk.' }` using the curated `FIELD_LABELS` map. No `E11000`, index name, or collection name reaches the client — that leak is exactly what `utils/mongoErrors.js` was written to stop.

Mobile consumes that existing contract rather than inventing a new one: on 409 it shows the server's Norwegian message, guarded so that any string containing `E11000`, `index:`, `dup key` or `MongoError` is discarded in favour of the local fallback `Denne e-postadressen er allerede i bruk.`

Static audit cannot prove the unique index actually exists in the live database — only that the schema declares it and that the code path for a duplicate is handled safely if it fires.

### No email-change verification exists

A search for `change-email`, `send-email-otp`, `verify-email`, `emailVerified`, `verificationToken` and `emailVerification` across `routes/`, `controllers/`, `utils/`, `middleware/` and `models/` returns nothing. There is no email-change verification flow to reuse, and none was invented for this task.

Concretely, for a normal e-mail change:

- **no current password is required** — `updateUser` does not read or compare `password`
- **no OTP is sent to the old address**
- **no OTP is sent to the new address**, and no confirmation link exists
- **there is no `emailVerified` equivalent** on `models/User.js`

Two nearby fields are _not_ email verification and must not be presented as such: `verified` is an older admin/trust flag set by several unrelated paths, and `identityVerified` is derived from a BankID/Idura identity. Neither is read or reset when the e-mail changes. `verifiedWorkEmail` appears in the `SAFE_BASE` projection list but has no corresponding schema field at all, so it is dead configuration rather than a verification signal.

**Email changes are authenticated by the current session but are not separately verified.** The screen states this plainly — it tells the user the change takes effect immediately, that no confirmation link is sent, and that they should check the address. No `Verifisert` or `Bekreftet` badge is rendered, and no OTP is ever claimed to have been sent.

### Sessions are not affected

Access and refresh tokens are signed `{ id, sid }` (`utils/tokenUtils.js`) and `models/Session.js` stores `userId`, tokens, ip, location and user-agent — no e-mail anywhere. `middleware/auth.js` validates `Session.findOne({ _id: sessionId, userId: decoded.id })` per request. Changing the e-mail string therefore invalidates nothing, and the backend never returns `SESSION_REVOKED` for it.

The screen accordingly does **not** log the user out, clear auth, or touch other devices' sessions after a successful change; it refreshes profile state instead. Forcing reauthentication would not reflect any existing security design.

### Forgot-password impact

`forgotPassword` looks the account up with the same `trim().toLowerCase()` normalization and then mails the OTP to `user.email` — the stored value. After a successful change the reset code is therefore sent to the **new** address automatically, and requesting a reset for the old address returns `404 Vi fant ingen konto med denne e-postadressen.` once no account holds it. No client-side logic was added for this; it follows from the lookup already being by stored e-mail.

### Support impact

`supportController` accepts an `email` in the body but, for an authenticated caller, overwrites it with `User.findById(req.userId).select('email')`. Future support replies therefore go to the new stored address with no support-specific mutation and no client involvement, and mobile never sends the account e-mail as authoritative.

### OAuth audit — links survive an email change

`utils/oauthLinking.js resolveOAuthLogin` locates returning users by **provider subject id**, via `User.findOne({ oauthProviders: { $elemMatch: { provider, providerId } } })` — never by e-mail equality. Changing the local e-mail therefore does not break or duplicate an existing Google, Vipps or BankID/Idura link, because the link is keyed on the provider's `sub`.

E-mail is consulted in exactly one place: when a **new, unlinked** provider identity arrives at a plain "sign in with …" button, a matching `email` owner causes the flow to stop with `account_exists` rather than link or create. That refusal is the file's deliberate account-takeover defence, and `email_verified: false` removes the claim from consideration entirely. The observable consequence of an e-mail change is only that this refusal follows the address: if a user sets their Jobblo e-mail to an address a provider later presents from a not-yet-linked identity, that sign-in is refused instead of silently linked — the safe direction. No defect specific to e-mail update was found, so OAuth was not modified and no server fix was needed.

### Query invalidation

The existing `useUpdateProfile` mutation handles the cache: on success it writes the server response into `queryKeys.auth.profile` with `setQueryData`, invalidates that same key, then syncs the display subset (`_id`, `name`, `lastName`, `avatarUrl`, `companyName`) into `authStore`. Only the profile query is invalidated; the QueryClient is never globally cleared. The screen additionally reseeds its field from the server response, and the success banner `E-postadressen er oppdatert.` is shown only after the server confirms.

**Known gap — the persisted store copy of `email` goes stale.** `authStore`'s persisted `user` object is written at login and includes `email`, but the shared profile sync deliberately mirrors only the five display fields listed above, so it still holds the old address until the next login. This is currently invisible: a search across `jobblo-app/src` and `jobblo-app/app` finds no screen that reads `email` off the auth store — every consumer reads the profile query. The shared hook was left unchanged rather than widened for this one screen; a future screen that wants the e-mail must read `useProfile()`, not the store.

### Errors

| Condition             | Message                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| No response (network) | `Ingen nettforbindelse. Sjekk internett og prøv igjen.`                                        |
| 400 invalid email     | `E-postadressen ble ikke godtatt. Kontroller den og prøv igjen.`                               |
| 401                   | `Økten din er ikke lenger gyldig. Logg inn på nytt.`                                           |
| 403 ownership         | `Du har ikke tilgang til å endre denne e-postadressen.`                                        |
| 404                   | `Fant ikke profilen din. Prøv å laste inn siden på nytt.`                                      |
| 409 duplicate         | server's `E-postadressen er allerede i bruk.`, else `Denne e-postadressen er allerede i bruk.` |
| 5xx                   | `Serverfeil. Prøv igjen litt senere.`                                                          |
| Client-side shape     | `Skriv inn en gyldig e-postadresse.` shown under the field                                     |

Neither a network failure nor a 5xx clears auth or logs the user out; the draft is kept so the user can retry. Centralized 401 handling in `src/api/client.ts` remains authoritative and no logout logic is duplicated here. A failed profile load renders the shared `ErrorState` with a `Prøv igjen` retry.

### Save button and keyboard

The CTA `Oppdater e-post` is disabled while the normalized draft equals the normalized server value, while the shape is invalid, and while the mutation is pending; the pending label is `Oppdaterer...`. Nothing is submitted on keystroke — only the CTA or the keyboard's done key triggers the mutation. The field uses `keyboardType="email-address"`, `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}` and `textContentType="emailAddress"`, and the screen is wrapped in `KeyboardAvoidingView` with `keyboardShouldPersistTaps="handled"` so the CTA stays reachable with the keyboard open.

### Verification status

Typecheck: the official `npx tsc --noEmit` could not run in this sandbox — TypeScript 7 resolves a platform-specific native binary and only the Windows one is installed (`Unable to resolve @typescript/typescript-linux-x64`). `node_modules` was not modified. The fallback diagnostic is the plain TypeScript 5.8.3 compiler in `frontend/node_modules`, run against this project's own `tsconfig.json`; it is not the project's official compiler and is reported as a fallback only. The user's Windows environment should run `npx tsc --noEmit` to confirm.

Backend: no backend file was changed, so no `node --check` was required.

Runtime / device: not verified here — manual device verification will be performed by the user. Expo was not started, Metro was not restarted, and no port was changed.

### Change History (Email settings section)

Mobile:

- `src/services/profile.service.ts`: added `email?: string` to `CurrentProfile` and `email: string` to `ProfileUpdate`, with comments recording that the field is the login identifier and is unique/normalized server-side
- created `app/(app)/profile/settings/email.tsx`: single field seeded from `useProfile()`, `trim().toLowerCase()` before send, shared shape regex, dirty/valid/pending-gated `Oppdater e-post` CTA, 409-aware Norwegian error banner, truthful "no confirmation link is sent" copy
- `app/(app)/profile/settings/index.tsx`: enabled only the `E-postadresse` row → `/profile/settings/email` (renamed from the disabled `E-post og telefon`); `Søkemotorsynlighet` and `Blokkerte brukere` left disabled

Backend: unchanged — `email` is already in `allowedUpdates` and `SAFE_BASE`, ownership is already enforced by `authorizeUser`, and duplicates are already translated to a safe 409 by `sendMongoError`.

Documentation: appended this section, including the absence of any email verification flow and the stale-persisted-`email` gap.

## User Terms / Brukervilkår

The canonical route is `/(app)/profile/settings/terms`. Public URL path: `/profile/settings/terms`. It is reached from **Om Jobblo** (`/profile/settings/about`) via the **Vilkår for bruk** row, which is the only navigation entry; no second terms route exists and the Settings overview does not link terms directly.

Navigation chain: Settings overview → `Om Jobblo` row (group _Annet_) → About → `Vilkår for bruk` → Terms. The `Om Jobblo` row previously had no `onPress` and rendered as a disabled `Kommer` row; it now navigates. `about.tsx` did not exist in the mobile app and had to be created to host the link — it is a minimal screen (company card + `Juridisk` group + `Personvern` group), not a redesign of any existing screen.

### Static content, no data layer

The screen is read-only. There is **no** TanStack Query hook, no service file, no query key, no backend route, and no mutation. Nothing is fetched at runtime.

Legal text lives in `src/content/userTerms.ts` as a typed module:

```ts
export type TermsSection = { id: number; title: string; content: string };
export const userTerms = {
  title,
  lastUpdated,
  lastUpdatedDisplay,
  company,
  organisationNumber,
  intro,
  footer,
  sections,
};
```

`terms.tsx` imports `userTerms` and renders it; the document is not embedded in JSX. `about.tsx` also reads `userTerms.company`, `userTerms.organisationNumber` and `userTerms.lastUpdatedDisplay` so the org number and the "Sist oppdatert" date have exactly one source.

### Source of truth and fidelity

Mirrored from `frontend/src/pages/UserTerm/UserTerm.tsx` — the web `sections` array plus its intro paragraph and italic footer line. Preserved verbatim: all 7 sections and their numbering (`1. Din bruk av Jobblo` … `7. Kontaktinformasjon`), every bullet, the paragraph break inside section 3, `Jobblo AS`, `organisasjonsnummer 931684930`, and the update date `2026-01-08` (rendered as `8. januar 2026`).

Only the leading template-literal indentation from the web file was dropped, because the web source relies on `whiteSpace: 'pre-line'` and that indentation is an artifact of the JS source formatting, not the legal text. No sentence was reworded, softened, modernized, expanded or removed — no GDPR language, no SafePay promise, and no liability clause was touched.

Rendering: `renderParagraphs()` splits each section on blank lines, renders a block whose lines all start with `•` as aligned bullet rows, and everything else as a paragraph. Section titles at `1.0625rem` bold, body at `0.9375rem` with `leading-6`, `#EFF0EA` page, `#FFFFFF` cards, `#E6E7E1` borders, `#2E6641` accents, `#0B0B0B` body ink, `#63665F` muted, card radius `rounded-3xl`. Long-form text is single-column and wraps at 360 / 375 / 390 / 393 / 414 / 430 dp.

### No consent surface

There is deliberately no `Jeg godtar` checkbox, no Accept button, no signature and no consent mutation. The backend has no terms-acceptance field or endpoint, so acceptance state cannot be represented truthfully. The screen is informational only.

### Personvernerklæring

`Om Jobblo` links `Personvern og informasjonskapsler` to the pre-existing `/profile/settings/privacy` screen, which mirrors `frontend/src/pages/CookiePolicyPage/CookiePolicyPage.tsx` via `src/content/privacyPolicy.ts`. No standalone Personvernerklæring was written for this task: no authoritative web privacy-policy source exists in the repo, and a privacy policy must not be authored from general knowledge. A separate Personvernerklæring remains deferred until legal supplies the text.

### Audit — stale terminology and product mismatches (reported, not changed)

These are findings only. The legal text was **not** edited to resolve them; they require a decision by whoever owns the document.

1. **Employer/job-seeker framing vs. the actual marketplace.** Section 1 opens `"Jobblo er en digital markedsplass som kobler arbeidsgivere og jobbsøkere"` and section 4 repeats `"mellom en arbeidsgiver og en jobbsøker"`. The product is a task/oppdrag marketplace between a customer who posts a job and a provider who performs it — not employment. `arbeidsgiver` / `jobbsøker` carry employment-law connotations that do not match how the platform operates.

2. **Payment-settlement disclaimer vs. SafePay.** Section 4 states Jobblo `"er ikke ansvarlig for … betalingsoppgjør"`. The live product does take a role in settlement: `backend/controllers/SafePayCheckoutController.js`, `backend/services/order/orderState.js` and `backend/services/payout/releasePayoutToProvider.js` implement a held-funds flow where Jobblo charges the customer, retains `platformFee = Math.round(grossAmount * 0.03)`, and transfers `grossAmount - platformFee` to the provider's Stripe account. The blanket disclaimer is inconsistent with that.

3. **Desktop-layout language.** Section 1 describes `"Til venstre på siden finner du et filtreringspanel"` and `"Hoveddelen av siden"`. On mobile, filters are a sheet on Explore, not a left panel. The description is web-desktop specific.

4. **No terms-acceptance mechanism is described consistently.** The intro says using the platform constitutes being bound, and section 6 says continued use after publication counts as acceptance — but there is no acceptance record anywhere in the backend, and no change-notification mechanism for `"varslet på plattformen eller via e-post"` exists in code.

5. **Missing sections given current functionality.** The document has nothing on subscriptions/`Medlemskap` (Stripe subscriptions exist in `models/Subscription.js`), reviews, disputes/`disputed` order state, account deletion, or personal-data processing, all of which are live product surfaces.

6. **Footer compliance claim is inherited.** `"Dette dokumentet er utformet for å være i samsvar med norsk lovgivning og beste praksis."` is copied verbatim from the web source. It is the document's own assertion and is not a claim made or verified here.

**No legal review was performed.** The mobile screen reproduces existing text; it does not validate it.

### Verification status

Typecheck: `npx tsc --noEmit` in `jobblo-app` — exit code 0.

Backend: no backend file was changed, so no `node --check` was required.

Runtime / device: not verified here — manual device verification will be performed by the user. Expo was not started, Metro was not restarted, and no port was changed.

### Files for User Terms

**Created:**

- `src/content/userTerms.ts` — typed mirror of the web legal text
- `app/(app)/profile/settings/terms.tsx` — read-only Brukervilkår screen
- `app/(app)/profile/settings/about.tsx` — minimal Om Jobblo screen created to host the terms link (no About screen existed)

**Modified:**

- `app/(app)/profile/settings/index.tsx` — the `Om Jobblo` row gained `onPress` → `/profile/settings/about`

Backend: unchanged. No new dependency was added.

## Mine annonser / My Jobs

The canonical route is `app/(app)/my-jobs.tsx` → `/my-jobs`. It was created for this task; no `/mine-annonser`, `/jobs/mine` or partial My Jobs screen existed. It is registered in `app/(app)/_layout.tsx` as `<Tabs.Screen name="my-jobs" options={{ href: null }} />`, so it lives in the tab group without adding a sixth tab (same pattern as `explore` and `my-applications`).

Entry point: the **Mine annonser** row in the Profile menu card (`app/(app)/profile/index.tsx`), inserted directly below `Mine oppdrag og søknader`, `Megaphone` icon, `router.push('/my-jobs')`. That is the only entry point.

### Data layer

`Screen → useMyJobs → jobsService → api/client`. No axios/fetch in the screen.

- `GET /api/services/my-posted` via `jobsService.fetchMyJobs()`; returns a bare array, normalized with `Array.isArray(...) ? data : []`.
- `DELETE /api/services/:serviceId` via `jobsService.deleteMyJob(serviceId)`.
- Query key: `queryKeys.jobs.mine = ['jobs', 'mine']`.
- `useMyJobs()`: `staleTime: 30_000`, `refetchOnMount: 'always'`, plus pull-to-refresh through `refetch()` / `isRefetching`.
- Types extend the existing shared model — `MyJob extends Job` with `capabilities: ListingCapabilities` and the owner-only `contactPhone` / `contactEmail`; `JobStatus` covers all 11 backend enum values.

### Ownership audit — no defect, no backend change

- `getMyPostedServices` filters on `Service.find({ userId: req.userId })`. There is no `userId` query parameter anywhere in the path, so the listing set cannot be widened from the client.
- `getServiceById` computes `isOwner` from `req.userId` and returns **404** (not 403) for a non-public listing the viewer is not involved in, so it does not confirm existence to a stranger.
- `updateService` and `deleteService` both run the same ladder: invalid ObjectId → `404` when missing → `403 Unauthorized` when `service.userId.toString() !== req.userId` → `409` with `capabilities.blockedReason` when the capability check fails.
- Contact fields are `select: false` on the model and are only un-hidden with `.select('+contactPhone +contactEmail')` on this owner-scoped route.

No security gap was found, so no backend file was modified and no `node --check` was required.

### Capabilities, not status guessing

The server attaches `capabilities` (`canEdit`, `canDelete`, `blockedCode`, `blockedReason`, `blockingStatus`) to every listing, computed from the real `Order` rows rather than from `Service.status`. The card renders that decision: Slett is disabled (`opacity-60`) when `capabilities.canDelete === false`, and `blockedReason` is printed verbatim below the action row. The client never infers blockage from `status`.

### Status mapping

Six client-side buckets over the 11 statuses, with counts derived from the fetched array (no server status parameter, no fabricated numbers):

| Chip      | Statuses                                                                     |
| --------- | ---------------------------------------------------------------------------- |
| Alle      | all                                                                          |
| Aktive    | `open`                                                                       |
| Pågår     | `pending`, `awaiting_payment`, `paid`, `in_progress`, `waiting_for_approval` |
| Fullført  | `completed`                                                                  |
| Utkast    | `draft`                                                                      |
| Avsluttet | `closed`, `cancelled`, `expired`                                             |

Badge labels come from the shared `ServiceStatusBadge`, so the Norwegian status vocabulary is identical to the applicants screens.

### Search and sort

Search is local over the already-fetched array: `title`, service `_id` and `categories`, all lowercased against a trimmed query. Sort options: `Nyeste først` (default), `Eldste først`, `Høyest pris`, `Lavest pris`, rendered with the existing `Select` bottom sheet. Filtering and sorting run on a copy (`[...jobs]`) so the cached array is never mutated in place. The header shows `Viser {n} av {total}`.

States: `isLoading` → four `ApplicantOverviewSkeleton`; `isError` → `ErrorState` with `refetch()`; empty → `Ingen treff` (search active), `Du har ingen aktive annonser ennå` (no listings at all), `Ingen oppdrag i denne kategorien` (filter excluded everything). No demo or placeholder jobs.

### Navigation out

- Card tap → `/(app)/jobs/[id]` with `params: { id: job._id }` (existing job detail).
- `Se søkere` → `/(app)/job-applicants/[serviceId]` with `params: { serviceId: job._id }` (existing applicants screen).
- SafePay: `my-posted` returns **no** `orderId`, so the screen joins `useMyApplicantsOverview()` by `_id` — the only owner-side source that returns a real `order._id`. The SafePay strip and its button render only when that join yields an order. Routing mirrors the owner branch of `app/(app)/messages/[chatId].tsx`: `ready_for_review` / `completed` → `/safepay/approval/:orderId` (`Godkjenn arbeid`), paid or in progress → `/safepay/success?orderId=` (`Se SafePay-ordre`), otherwise `/safepay/checkout/:orderId` (`Betal med SafePay`).

No Create Job, Job Detail, Applicants or SafePay screen was duplicated.

### Applicant count

`my-posted` does not include an applicant count (`currentApplicants` is only computed in `getServiceById`). The count therefore comes from the same overview join, and `applicantCount` is passed as `undefined` until that query resolves, so the stat is omitted rather than shown as a false `0`.

### Delete

Two-step: pressing Slett opens a `Dialog` with `Slette annonsen?` / `Denne handlingen kan ikke angres.` / the listing title / `Avbryt` + `Slett annonse` (destructive `#B4544A`, spinner while pending). Nothing is sent before the second press.

409 handling: the server's `capabilities.blockedReason` is a finished Norwegian sentence. A local `getErrorMessage` reads `response.data.error ?? response.data.message` and the dialog shows it inline, verbatim. The generic `Kunne ikke slette annonsen. Prøv igjen.` is used only when the response carried no message at all.

### Edit — deferred

Not exposed. `PUT /api/services/:id` exists on the backend and `capabilities.canEdit` is returned, but the mobile app has no caller: `createJob.service.ts` is POST-only and there is no `apiClient.put`/`patch` to `/services/:id` anywhere in `jobblo-app`. Rendering an Edit button would lead nowhere, so it is deferred until a mobile edit form exists.

### Server draft vs local draft

Two unrelated things, kept separate:

- **Server draft** — a `Service` with `status: 'draft'`. It appears in the list under the `Utkast` chip with the `Utkast` badge and the note "Utkastet er lagret på serveren og er ikke synlig for andre."
- **Local draft** — the single AsyncStorage key `jobblo-create-job-draft` behind `src/utils/draftStorage.ts`, used only by the Create Job wizard. Mine annonser neither reads nor writes it.

### Invalidation and freshness

Delete success scope-invalidates `queryKeys.jobs.mine`, `queryKeys.jobs.list()`, `queryKeys.jobs.infinite()` and `queryKeys.applicants.overview`. No `queryClient.clear()` and no global reset. Freshness on the screen itself is `staleTime: 30_000` + `refetchOnMount: 'always'` + `RefreshControl`.

### Verification status

Typecheck: `npx tsc --noEmit` in `jobblo-app` — exit code 0.

Backend: no backend file was changed, so no `node --check` was required.

Runtime / device: not verified here — manual. Expo was not started, Metro was not restarted, no port was changed.

### Files for Mine annonser

**Created:**

- `app/(app)/my-jobs.tsx` — the owner listings screen

**Modified:**

- `app/(app)/_layout.tsx` — hidden `my-jobs` tab registration
- `app/(app)/profile/index.tsx` — `Mine annonser` row + `Megaphone` import
- `src/types/Jobs.ts` — `JobStatus`, `ListingCapabilities`, `MyJob`
- `src/queryKeys.ts` — `jobs.mine`
- `src/services/jobs.service.ts` — `fetchMyJobs`, `deleteMyJob`
- `src/hooks/useMyJobs.ts` — `useMyJobs`, `useDeleteMyJobMutation`
- `src/components/domain/ServiceStatusBadge.tsx` — all 11 statuses mapped (`Betalt`, `Ventende`, `Utkast`, `Utløpt`)

Backend: unchanged. No new dependency was added.
