/**
 * Job/Service types mirroring the Jobblo backend service model.
 * Used for home page job listings and discovery.
 */

export type JobStatus = 'open' | 'closed' | 'awaiting_payment' | 'paid' | 'in_progress' | 'completed' | 'pending' | 'waiting_for_approval' | 'cancelled' | 'expired' | 'draft';

export type Equipment = 'utstyrfri' | 'delvis utstyr' | 'trengs utstyr';

export interface JobPoster {
  _id?: string;
  name?: string;
  companyName?: string;
  avatarUrl?: string;
  averageRating?: number;
  verified?: boolean;
  role?: string;
  orgNumber?: string;
  completedJobs?: number;
}

export interface JobLocation {
  type: string;
  coordinates: [number, number];
  address: string;
  city: string;
}

export interface JobDuration {
  value?: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface TimeEntry {
  userId: string;
  hours: number;
  date: string;
  note: string;
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  _id: string;
  userId: JobPoster | string | null;
  title: string;
  description: string;
  price: number;
  hourlyRate?: number;
  paymentType?: string;
  location: JobLocation;
  countyCode?: string;
  municipalityCode?: string;
  areaCode?: string;
  duration: JobDuration;
  categories: string[];
  images: string[];
  urgent: boolean;
  promoted?: boolean;
  favCount?: number;
  status: JobStatus;
  tags: string[];
  maxApplicants?: number;
  currentApplicants?: number;
  isLimitReached?: boolean;
  equipment: Equipment;
  checklist?: Array<{ id: string; text: string; checked: boolean; checkedBy?: { name?: string }; checkedAt?: string }>;
  createdAt: string;
  updatedAt: string;
  fromDate?: string;
  toDate?: string;
  views?: number;
  timeEntries?: TimeEntry[];
}

/**
 * Server-computed owner permissions for a listing.
 * Produced by backend/utils/listingCapabilities.js — the client renders this
 * decision instead of inferring it from `status`, because Service.status has
 * historically drifted from the Order status that actually blocks the action.
 */
export interface ListingCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  blockedCode: string | null;
  blockedReason: string | null;
  blockingStatus: string | null;
}

/** A listing as returned by GET /api/services/my-posted (owner-scoped). */
export interface MyJob extends Job {
  capabilities: ListingCapabilities;
  contactPhone?: string;
  contactEmail?: string;
}

export interface JobsResponse {
  data: Job[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface FetchJobsParams {
  page?: number;
  limit?: number;
  categories?: string[];
  locations?: string[];
  countyCodes?: string[];
  municipalityCodes?: string[];
  areaCodes?: string[];
  search?: string;
  sort?: string;
  userId?: string;
  urgent?: boolean;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  radius?: number;
}
