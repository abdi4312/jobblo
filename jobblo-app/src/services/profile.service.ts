import apiClient from '../api/client';

export type CurrentProfile = {
  _id?: string;
  name?: string;
  lastName?: string;
  /**
   * The account's login e-mail, returned by GET /auth/profile because `email` is
   * part of the backend OWN_USER_SELECT projection. There is no separate
   * verification field on the User model, so nothing here indicates a verified
   * address — `verified` and `identityVerified` below are unrelated flags
   * (admin trust and BankID respectively).
   */
  email?: string;
  companyName?: string;
  role?: string;
  avatarUrl?: string;
  verified?: boolean;
  identityVerified?: boolean;
  bio?: string;
  skills?: string[];
  availabilityText?: string;
  locations?: string[];
  address?: string;
  postNumber?: string;
  postSted?: string | { city?: string };
  /**
   * Free-text country on the user profile (backend `User.country` is a plain
   * `String` with no enum and no ISO-code constraint), returned by
   * GET /auth/profile because `country` is part of the backend OWN_USER_SELECT
   * projection. This is the profile's own country — unrelated to a job's
   * location fields (address/city/coordinates/countyCode/municipalityCode).
   */
  country?: string;
  orgNumber?: string;
  website?: string;
  averageRating?: number;
  reviewCount?: number;
  completedJobs?: number;
  postedJobsCount?: number;
  responseRate?: number;
  averageResponseTime?: number;
  repeatCustomersCount?: number;
  createdAt?: string;
  [key: string]: unknown;
};

export async function getCurrentProfile(): Promise<CurrentProfile> {
  const response = await apiClient.get<CurrentProfile>('/auth/profile');
  return response.data;
}

export type ProfileUpdate = Partial<{
  name: string;
  lastName: string;
  /**
   * Login identifier. Backend `User.email` is `unique`, `required`, `lowercase`
   * and `trim`-ed, and `authController.login` looks the account up by it, so it
   * must always be sent already normalized (`trim().toLowerCase()`). It is
   * present in normal-user `allowedUpdates` in updateUser; a collision surfaces
   * as 409 `E-postadressen er allerede i bruk.` via sendMongoError.
   */
  email: string;
  bio: string;
  skills: string[];
  availabilityText: string;
  address: string;
  postNumber: string;
  postSted: string;
  /** Accepted by backend updateUser's `allowedUpdates`; stored as free text. */
  country: string;
  companyName: string;
  orgNumber: string;
  website: string;
}>;

export async function updateCurrentProfile(userId: string, data: ProfileUpdate | FormData): Promise<CurrentProfile> {
  const response = await apiClient.put<CurrentProfile>(`/users/${userId}`, data);
  return response.data;
}

export async function deleteCurrentUser(userId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/users/${userId}`);
  return response.data;
}
