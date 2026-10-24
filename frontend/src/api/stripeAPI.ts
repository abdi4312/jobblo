import mainLink from './mainURLs';

// ── Subscription (Stripe) ─────────────────────────────────────────────────────
export const getMySubscription = async () =>
  (await mainLink.get('/api/stripe/subscription')).data.subscription;

export const cancelSubscription = async () =>
  (await mainLink.post('/api/stripe/subscription/cancel')).data;

export const resumeSubscription = async () =>
  (await mainLink.post('/api/stripe/subscription/resume')).data;

export const cancelSubscriptionChange = async () =>
  (await mainLink.post('/api/stripe/subscription/change/cancel')).data;

export const openSubscriptionPortal = async () =>
  (await mainLink.post('/api/stripe/subscription/portal')).data;

export const getSubscriptionBillingHistory = async (mode = 'all') =>
  (await mainLink.get(`/api/stripe/subscription/billing-history?mode=${mode}`)).data;

export const previewSubscriptionChange = async (planId?: string) =>
  (await mainLink.post('/api/stripe/subscription/change/preview', { planId })).data;

export const changeSubscription = async (planId?: string) =>
  (await mainLink.post('/api/stripe/subscription/change', { planId })).data;

export const getSubscriptionInvoicePdf = async ({ id, mode }: { id: string; mode: string }) =>
  (await mainLink.get(`/api/stripe/subscription/invoices/${encodeURIComponent(id)}/pdf?mode=${mode}`)).data;

export const createCheckoutSession = async (planId: string) =>
  (await mainLink.post('/api/stripe/create-checkout-session', { planId })).data;

export const getCheckoutSession = async <T = unknown>(sessionId: string) =>
  (await mainLink.get<T>(`/api/stripe/checkout-session/${sessionId}`)).data;

export const getUserTransactions = async (page: number, limit = 5) =>
  (await mainLink.get(`/api/transactions/user?page=${page}&limit=${limit}`)).data;

// ── Contacts ──────────────────────────────────────────────────────────────────
export const getContactEntitlements = async () =>
  (await mainLink.get('/api/stripe/v2/entitlements')).data;

export const getExtraContactStatus = async (sessionId: string) =>
  (await mainLink.get<{ status: string }>(`/api/stripe/extra-contact-status/${sessionId}`)).data;

// ── Stripe Connect (payouts) ──────────────────────────────────────────────────
export const getConnectStatus = async <T = { payoutReady?: boolean }>() => (await mainLink.get<T>('/api/connect/status')).data;

export const refreshConnectStatus = async () => (await mainLink.post('/api/connect/refresh')).data;

export const createConnectAccountLink = async () =>
  (await mainLink.post<{ url?: string }>('/api/connect/account-link')).data;
