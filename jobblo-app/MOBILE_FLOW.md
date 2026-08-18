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
- ⬜ Post Job Step 1
- ⬜ Post Job Step 2
- ⬜ Remaining Post Job Steps
- ⬜ My Jobs
- ⬜ Job Management
- ⬜ Applicants
- ⬜ Applicant Details
- ⬜ Select Provider
- ⬜ Chat List
- ⬜ Chat Conversation
- ⬜ Notifications
- ⬜ Contract
- ⬜ SafePay
- ⬜ Payment Success / Failure
- ⬜ Active Job
- ⬜ Checklist
- ⬜ Work Progress
- ⬜ Completion
- ⬜ Review
- ⬜ Dispute List
- ⬜ Dispute Details / Thread
- ⬜ Create Dispute
- ⬜ Profile
- ⬜ Edit Profile
- ⬜ Settings
- ⬜ Account
- ⬜ Support

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
- Post job empty state button: disabled until Post tab is implemented

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
