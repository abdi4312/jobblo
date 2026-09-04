import apiClient from '../api/client';

export type CurrentSubscription = {
  hasPlan: boolean;
  plan: string | null;
  planName?: string | null;
  planType: 'private' | 'business';
  planId?: string | null;
  status: string;
  stripeStatus?: string;
  autoRenew: boolean;
  renewalDate?: string | null;
  currentPeriodEnd?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
  contacts: {
    includedLimit: number;
    includedUsed: number;
    includedRemaining: number;
    perContactPrice: number | null;
    contactUnlockMinutes: number | null;
    paidPurchased: number;
    paidUsed: number;
    paidAvailable: number;
    totalPaidForExtraContacts: number;
    currency: string;
  };
};

const EMPTY_CONTACTS: CurrentSubscription['contacts'] = {
  includedLimit: 0,
  includedUsed: 0,
  includedRemaining: 0,
  perContactPrice: null,
  contactUnlockMinutes: null,
  paidPurchased: 0,
  paidUsed: 0,
  paidAvailable: 0,
  totalPaidForExtraContacts: 0,
  currency: 'nok',
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
  const subscription = response.data.subscription;
  if (!subscription) return null;

  // Keep an older backend response render-safe during a rolling deployment. This is only a
  // compatibility default; entitlement and payment values come from the backend whenever
  // the normalized response is available.
  return { ...subscription, contacts: subscription.contacts ?? EMPTY_CONTACTS };
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
