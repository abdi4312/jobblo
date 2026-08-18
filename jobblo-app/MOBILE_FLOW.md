# Jobblo Mobile Flow

## Implementation status

- ✅ Foundation
- ✅ TypeScript
- ✅ NativeWind
- ✅ TanStack Query
- ✅ Login
- ✅ Register Step 1
- ✅ Register Step 2
- ✅ Forgot Password
- ⬜ Session restoration
- ⬜ Logout
- ⬜ Home
- ⬜ Explore / Search
- ⬜ Search Filters
- ⬜ Job Details
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

## Runtime verification status

### Expo runtime result

- Verified via `npx expo start --port 8081 --web` from the app root
- Metro started successfully and served the project on `http://localhost:8082/`
- No Expo SDK startup error was emitted after the app root was corrected
- No NativeWind startup crash, Expo Router boot error, or provider boot error surfaced during startup
- Auth route files are present as normal files under `app/(auth)` and no accidental nested duplicate route files were found

### Auth runtime status

- ✅ Login route boots under Expo Router
- ✅ Register Step 1 route boots under Expo Router
- ✅ Register Step 2 route boots under Expo Router
- ✅ Forgot Password route boots under Expo Router
- ✅ TypeScript compile gate passes: `npx tsc --noEmit`

### Remaining auth issues

- Browser/device automation is still required for full touch-level validation of input focus, keyboard overlap, and mobile-width visual checks on a real device or emulator
- Actual backend credential testing still requires the backend service to be running and reachable from the mobile app environment
- The auth screens are verified at the code and Expo boot level but not yet validated against a physical device interaction pass in this environment
