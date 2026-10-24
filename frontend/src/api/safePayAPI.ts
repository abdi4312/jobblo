import mainLink from './mainURLs';

// ── Checkout (customer) ───────────────────────────────────────────────────────
export const getCheckoutDetails = async (orderId: string) =>
  (await mainLink.get(`/api/safepay-checkout/details/${orderId}`)).data;

export const createCheckoutSession = async (orderId?: string) =>
  (await mainLink.post('/api/safepay-checkout/create-session', { orderId })).data;

export const getCheckoutStatus = async (sessionId: string) =>
  (await mainLink.get(`/api/safepay-checkout/status/${sessionId}`)).data;

export const approveCheckout = async (payload: Record<string, unknown>) =>
  (await mainLink.post('/api/safepay-checkout/approve', payload)).data;

export const updateCheckoutChecklistItem = async (orderId: string, itemId: string, checked: boolean) =>
  (await mainLink.put(`/api/safepay-checkout/contract/${orderId}/checklist/${itemId}`, { checked })).data;

// The multipart header override is required: mainLink defaults to JSON, and axios 1.x would
// serialise the FormData to `{}` under a JSON content type.
export const uploadReviewPhotos = async (orderId: string, body: FormData): Promise<{ urls?: string[] }> =>
  (await mainLink.post(`/api/safepay-checkout/review-photos/${orderId}`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;

export const reconcileOrderPayment = async (orderId: string) =>
  (await mainLink.post(`/api/safepay/orders/${orderId}/reconcile-payment`)).data;

// ── Provider order work ───────────────────────────────────────────────────────
export const getProviderOrder = async (orderId: string) =>
  (await mainLink.get(`/api/safepay/orders/${orderId}`)).data;

export const startProviderOrder = (orderId: string) => mainLink.post(`/api/safepay/orders/${orderId}/start`);

export const markOrderReadyForReview = (orderId: string) =>
  mainLink.post(`/api/safepay/orders/${orderId}/ready-for-review`);

export const updateProviderChecklistItem = (orderId: string, itemId: string, providerCompleted: boolean) =>
  mainLink.patch(`/api/safepay/orders/${orderId}/provider-checklist/${itemId}`, { providerCompleted });

export const uploadOrderEvidence = (orderId: string, fd: FormData) =>
  mainLink.post(`/api/safepay/orders/${orderId}/evidence`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const removeOrderEvidence = (orderId: string, url: string, evidenceType: string) =>
  mainLink.delete(`/api/safepay/orders/${orderId}/evidence`, { data: { url, evidenceType } });

// ── Disputes ──────────────────────────────────────────────────────────────────
export const getOrderDispute = async (orderId: string) =>
  (await mainLink.get(`/api/safepay/contract/${orderId}/dispute`)).data;

export const openOrderDispute = async (
  orderId: string,
  payload: { reasonCategory: string; title: string; description: string }
) => (await mainLink.post(`/api/safepay/contract/${orderId}/dispute`, payload)).data;

export const postDisputeMessage = (disputeId: string | undefined, message: string) =>
  mainLink.post(`/api/safepay/disputes/${disputeId}/message`, { message });

// ── Finance history (provider: /api/safepay/finance, admin: /api/admin/safepay/finance) ──
const financeRoot = (admin: boolean) => (admin ? '/api/admin/safepay/finance' : '/api/safepay/finance');

export const getFinanceList = async <T>(admin: boolean, listPath: string, query: URLSearchParams) =>
  (await mainLink.get<T>(`${financeRoot(admin)}/${listPath}?${query.toString()}`)).data;

export const getFinanceSummary = async <T>(admin: boolean, mode: string) =>
  (await mainLink.get<T>(admin ? `${financeRoot(true)}/summary?mode=${mode}` : `${financeRoot(false)}/summary`)).data;

export const reconcileFinance = async (payload: { mode: string; limit: number; cursorProviderId?: string }) =>
  (await mainLink.post(`${financeRoot(true)}/reconcile`, payload)).data;
