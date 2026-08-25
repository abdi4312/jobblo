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

export async function getCurrentSubscription(): Promise<CurrentSubscription | null> {
  const response = await apiClient.get<{ subscription: CurrentSubscription | null }>('/stripe/subscription');
  return response.data.subscription;
}

export async function cancelCurrentSubscription() {
  const response = await apiClient.post('/stripe/subscription/cancel');
  return response.data as { message?: string; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null };
}

export async function resumeCurrentSubscription() {
  const response = await apiClient.post('/stripe/subscription/resume');
  return response.data as { message?: string; cancelAtPeriodEnd?: boolean };
}
