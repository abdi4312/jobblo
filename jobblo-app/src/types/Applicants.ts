export type ServiceStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_payment'
  | 'waiting_for_approval'
  | 'completed'
  | 'cancelled'
  | 'closed'
  | string;

export interface SelectedWorkerSummary {
  _id: string;
  name: string;
  avatarUrl?: string;
}

export interface ApplicantOverviewOrder {
  _id: string;
  status: string;
  paymentStatus?: string;
  agreedPrice?: number;
}

export interface ApplicantOverviewLocation {
  city?: string;
  address?: string;
  country?: string;
}

export interface ApplicantOverviewService {
  _id: string;
  title: string;
  price?: number;
  status: ServiceStatus;
  location?: ApplicantOverviewLocation;
  applicantCount: number;
  applicantAvatars: string[];
  createdAt: string;
  updatedAt: string;
  lastActivity?: string;
  categories?: string[];
  fromDate?: string;
  toDate?: string;
  selectedWorker: SelectedWorkerSummary | null;
  order: ApplicantOverviewOrder | null;
}

export type MyApplicantsOverviewResponse = ApplicantOverviewService[];

export interface ApplicantDetailService {
  _id: string;
  title: string;
  price?: number;
  location?: ApplicantOverviewLocation;
  status: ServiceStatus;
  date?: string;
  duration?: { value?: number; unit?: string } | null;
}

export interface ApplicantProfile {
  _id: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
  skills: string[];
  locations: string[];
  rating: number;
  reviewCount: number;
  completedJobs: number;
  responseRate?: string | null;
}

export interface ApplicantApplication {
  _id: string;
  status: string;
  message: string;
  appliedAt: string;
  favorite?: boolean;
  archived?: boolean;
  applicant: ApplicantProfile;
}

export interface ActiveApplicantOrder {
  _id: string;
  status: string;
}

export interface ApplicantsDetailResponse {
  service: ApplicantDetailService;
  applicants: ApplicantApplication[];
  activeOrder: ActiveApplicantOrder | null;
}