/**
 * Application/JobRequest types for applying to jobs.
 * Matches backend JobRequest schema.
 */

export type ApplicationStatus = 'pending' | 'accepted' | 'declined';
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'awaiting_payment'
  | 'paid'
  | 'in_progress'
  | 'ready_for_review'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled';

export interface JobRequest {
  _id: string;
  serviceId: string | {
    _id: string;
    title: string;
  };
  customerId: string | {
    _id: string;
    name: string;
  };
  providerId: string;
  status: ApplicationStatus;
  message?: string;
  favorite?: boolean;
  archived?: boolean;
  withdrawnAt?: string | null;
  chatId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobRequestPayload {
  serviceId: string;
  message?: string;
}

export interface ApplyError {
  error?: string;
  message?: string;
  isDelayed?: boolean;
  unlockAt?: string;
  paymentRequired?: boolean;
  upgradeRequired?: boolean;
  limit?: number;
  usage?: number;
  perContactPrice?: number;
  serviceStatus?: string;
}

export interface ApplyErrorResponse {
  status: number;
  error: ApplyError;
}

export interface ApplicationCustomerSummary {
  _id: string;
  name?: string;
  lastName?: string;
  avatarUrl?: string;
  averageRating?: number;
  isSafePayUser?: boolean;
}

export interface ApplicationServiceSummary {
  _id: string;
  title?: string;
  description?: string;
  location?: {
    city?: string;
    address?: string;
    country?: string;
  };
  price?: number;
  status?: string;
  fromDate?: string;
  customer?: ApplicationCustomerSummary | null;
}

export interface ApplicationChatSummary {
  _id: string;
  status?: string;
  lastMessage?: string | null;
}

export interface ApplicationOrderSummary {
  _id: string;
  status: OrderStatus;
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded';
  agreedPrice?: number;
  startedAt?: string | null;
  readyForReviewAt?: string | null;
  completedAt?: string | null;
  chatId?: string | null;
}

export interface MyApplication {
  _id: string;
  status: ApplicationStatus;
  message: string;
  appliedAt: string;
  service: ApplicationServiceSummary | null;
  order: ApplicationOrderSummary | null;
  chat: ApplicationChatSummary | null;
  nextAction: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface MyApplicationsResponse {
  applications: MyApplication[];
  pagination: PaginationMeta;
}

