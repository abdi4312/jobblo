import apiClient from '../api/client';

export type CurrentSubscription = {
  plan: string;
  planType: 'private' | 'business';
  planId?: string | null;
  status: string;
  stripeStatus?: string;
  autoRenew: boolean;
  renewalDate?: string | null;
  currentPeriodEnd?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
};

export type PurchaseStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type PurchaseType = 'subscription' | 'extra_contact';

export type PurchaseHistoryItem = {
  _id: string;
  planName?: string | null;
  planType?: string | null;
  amount?: number;
  currency?: string;
  status?: PurchaseStatus;
  type?: PurchaseType;
  createdAt?: string;
};

export async function getCurrentSubscription(): Promise<CurrentSubscription | null> {
  const response = await apiClient.get<{ subscription: CurrentSubscription | null }>('/stripe/subscription');
  return response.data.subscription;
}

/**
 * GET /api/transactions/user — the authenticated user's persisted purchase rows.
 * The backend writes these via `upsertTransaction` on every subscription purchase,
 * renewal (`invoice.paid`) and failed-charge; `stripeSessionId` stays server-side
 * and is never surfaced.
 */
export async function getPurchaseHistory(): Promise<PurchaseHistoryItem[]> {
  const response = await apiClient.get<{ transactions?: PurchaseHistoryItem[] }>('/transactions/user');
  return response.data.transactions ?? [];
}

export async function cancelCurrentSubscription() {
  const response = await apiClient.post('/stripe/subscription/cancel');
  return response.data as { message?: string; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null };
}

export async function resumeCurrentSubscription() {
  const response = await apiClient.post('/stripe/subscription/resume');
  return response.data as { message?: string; cancelAtPeriodEnd?: boolean };
}
