import type { SafePayCalculation, SafePayOrder, SafePayParty, SafePayService } from './SafePay';

export interface ProviderChecklistItem {
  id: string;
  text: string;
  checked?: boolean;
  providerCompleted?: boolean;
  customerConfirmed?: boolean;
}

export interface ProviderOrderHistoryItem {
  _id?: string;
  action?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

export interface ProviderOrder extends Omit<SafePayOrder, 'serviceId' | 'customerId' | 'providerId' | 'checklist'> {
  serviceId: SafePayService | null;
  customerId: SafePayParty | null;
  providerId: (SafePayParty & { completedJobs?: number }) | null;
  checklist: ProviderChecklistItem[];
  beforeImages?: string[];
  afterImages?: string[];
  completionNote?: string;
  history?: ProviderOrderHistoryItem[];
  chatId?: string | null;
  startedAt?: string | null;
  readyForReviewAt?: string | null;
}

export interface ActiveDisputeSummary {
  _id: string;
  status?: string;
  reasonCategory?: string;
  title?: string;
  openedAt?: string;
}

export interface ProviderOrderResponse {
  order: ProviderOrder;
  calculation: SafePayCalculation;
  isCustomer: boolean;
  isProvider: boolean;
  activeDispute: ActiveDisputeSummary | null;
}