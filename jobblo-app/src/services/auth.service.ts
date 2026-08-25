import apiClient from '@/api/client';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  lastName: string;
  email: string;
  password: string;
  role?: string;
  companyName?: string;
  orgNumber?: string;
};

export type AuthUser = {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role?: string;
  [key: string]: unknown;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
};

export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return response.data;
}

export async function registerUser(payload: RegisterRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/register', payload);
  return response.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return response.data;
}

export async function verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
  const response = await apiClient.post<{ resetToken: string }>('/auth/verify-otp', {
    email,
    otp,
  });
  return response.data;
}

export async function resetPassword(
  resetToken: string,
  password: string
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/reset-password', {
    resetToken,
    password,
  });
  return response.data;
}

export async function changePasswordSendOtp(currentPassword: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/change-password/send-otp', { currentPassword });
  return response.data;
}

export async function changePasswordVerifyOtp(otp: string, newPassword: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/change-password/verify-otp', { otp, newPassword });
  return response.data;
}

/* ------------------------------------------------------------------ *
 * Active login sessions
 *
 * Session APIs live on the auth router server-side (`/api/auth/sessions`)
 * and are therefore kept in this service rather than a duplicate API layer.
 *
 * The user is ALWAYS derived server-side from the authenticated request
 * (`req.user` / `req.userId`) and the current session from the JWT's `sid`
 * claim. Nothing here sends a userId, a session owner or any token — doing so
 * would make the client the authority over whose sessions get listed or
 * destroyed. `revokeSession` passes only the public session `_id`, and the
 * backend still constrains the delete by `{ _id, userId }` so one account can
 * never revoke another account's session by supplying a foreign id.
 * ------------------------------------------------------------------ */

/**
 * One row of `GET /api/auth/sessions`.
 *
 * These are the fields the backend actually returns. `authController.getSessions`
 * selects `-refreshToken -oldRefreshToken -__v` and `sanitizeSession` deletes the
 * same three again before spreading the document, so no token material reaches
 * the client. `isCurrent` is computed server-side by comparing the session `_id`
 * against the `sid` claim of the presented access token.
 *
 * Deliberately NOT typed here even though the endpoint returns them:
 *   - `userId`   – the caller's own id, no purpose on this screen
 *   - `userAgent`– the raw UA string; the web Sessions view does not show it and
 *                  this screen must not expose more session metadata than web
 *   - `expiresAt` / `createdAt` / `updatedAt` – refresh-token TTL bookkeeping,
 *                  also not shown on web
 * Omitting them from the type keeps them out of the UI by construction.
 */
export type ActiveSession = {
  _id: string;
  /** Server-computed. The ONLY trustworthy way to identify this device. */
  isCurrent: boolean;
  /** Coarse label built server-side as `${os} ${Mobile|Tablet|Desktop}`. */
  device: string;
  browser: string;
  os: string;
  /** Approximate, IP-derived. `'Localhost'` for loopback, `'Unknown'` if lookup failed. */
  location?: string;
  ip: string;
  /** ISO timestamp, refreshed by the auth middleware on each authenticated request. */
  lastUsed: string;
};

/**
 * GET /api/auth/sessions — every live session for the authenticated user.
 * Responds with a BARE ARRAY (not `{ sessions: [...] }`) already sorted
 * `lastUsed` descending. The `Array.isArray` guard keeps a malformed or
 * proxy-wrapped response from throwing inside the render tree.
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const response = await apiClient.get<ActiveSession[]>('/auth/sessions');
  return Array.isArray(response.data) ? response.data : [];
}

/**
 * DELETE /api/auth/sessions/:sessionId — revoke a single session.
 * Deleting the row is immediately effective: `middleware/auth.js` re-checks
 * `Session.findOne({ _id: sid, userId })` on every authenticated request, so the
 * revoked device gets 401 `SESSION_REVOKED` on its very next API call.
 * Returns 404 when the session is already gone or is not owned by the caller —
 * the two cases are deliberately indistinguishable to the client.
 */
export async function revokeSession(sessionId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
  return response.data;
}

/**
 * DELETE /api/auth/sessions/revoke-others — revoke every session EXCEPT this one.
 * The exclusion is enforced server-side (`_id: { $ne: currentSessionId }`), not by
 * client filtering, so the caller's own session always survives.
 *
 * Note this route must stay declared BEFORE `/sessions/:sessionId` on the backend
 * router, otherwise Express matches `revoke-others` as a `sessionId` param.
 */
export async function revokeOtherSessions(): Promise<{ message: string; count: number }> {
  const response = await apiClient.delete<{ message: string; count: number }>(
    '/auth/sessions/revoke-others'
  );
  return response.data;
}
