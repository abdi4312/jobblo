export interface ExperienceItem {
  _id?: string;
  id?: string;
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface PublicUser {
  _id: string;
  name?: string;
  lastName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  role?: string;
  companyName?: string;
  orgNumber?: string;
  orgType?: string;
  website?: string;
  country?: string;
  address?: string;
  postNumber?: string;
  postSted?: string | { city?: string };
  averageRating?: number;
  reviewCount?: number;
  completedJobs?: number;
  skills?: string[];
  bio?: string;
  experience?: ExperienceItem[];
  hourlyRate?: number;
  availabilityText?: string;
  locations?: string[];
  portfolio?: { _id: string; title?: string; description?: string; link?: string; imageUrl?: string }[];
  previousProjects?: { _id: string; title?: string; description?: string; link?: string; imageUrl?: string }[];
  subscription?: string;
  createdAt?: string;
  identityVerified?: boolean;
  identityVerificationProvider?: string | null;
  identityVerifiedAt?: string | null;
  // computed by backend getUserById
  postedJobsCount?: number;
  totalJobRequests?: number;
  responseRate?: number;
  averageResponseTimeMinutes?: number;
  repeatCustomersCount?: number;
  hireRate?: number;
  completionRate?: number;
  jobsThisMonth?: number;
  totalApplicationsReceived?: number;
  reviews?: Review[];
}

export interface Review {
  _id: string;
  rating: number;
  comment?: string;
  revieweeRole?: string;
  createdAt?: string;
  reviewerId?: {
    _id: string;
    name?: string;
    lastName?: string;
    avatarUrl?: string;
  };
  serviceId?: {
    _id: string;
    title?: string;
  };
}

export interface PublicService {
  _id: string;
  userId?: string;
  title?: string;
  description?: string;
  price?: number;
  unit?: string;
  category?: string;
  subcategory?: string;
  imageUrl?: string;
  images?: string[];
  location?: string;
  createdAt?: string;
  [key: string]: unknown;
}
