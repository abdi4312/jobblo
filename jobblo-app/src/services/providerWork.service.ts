import apiClient from '../api/client';
import type { ProviderOrderResponse } from '../types/ProviderOrder';

type ReactNativeFilePart = { uri: string; name: string; type: string };

function requireId(value: string, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Mangler gyldig ${name}`);
  return value.trim();
}

export async function getProviderOrder(orderId: string): Promise<ProviderOrderResponse> {
  const response = await apiClient.get(`/safepay/orders/${requireId(orderId, 'orderId')}`);
  return response.data;
}

export async function startProviderJob(orderId: string) {
  const response = await apiClient.post(`/safepay/orders/${requireId(orderId, 'orderId')}/start`);
  return response.data;
}

export async function updateProviderChecklist(orderId: string, itemId: string, providerCompleted: boolean) {
  const response = await apiClient.patch(`/safepay/orders/${requireId(orderId, 'orderId')}/provider-checklist/${requireId(itemId, 'itemId')}`, { providerCompleted });
  return response.data;
}

export async function uploadProviderEvidence(
  orderId: string,
  evidenceType: 'before' | 'after',
  files: Array<{ uri: string; name: string; type: string }>,
  completionNote?: string,
) {
  const safeOrderId = requireId(orderId, 'orderId');
  if (!files.length && !completionNote?.trim()) throw new Error('Minst én fil eller et notat kreves');
  const formData = new FormData();
  files.forEach((file) => {
    const part: ReactNativeFilePart = { uri: file.uri, name: file.name, type: file.type };
    (formData as FormData & { append(name: string, value: ReactNativeFilePart): void }).append('files', part);
  });
  formData.append('evidenceType', evidenceType);
  if (completionNote?.trim()) formData.append('completionNote', completionNote.trim());
  const response = await apiClient.post(`/safepay/orders/${safeOrderId}/evidence`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteProviderEvidence(orderId: string, url: string, evidenceType: 'before' | 'after') {
  const response = await apiClient.delete(`/safepay/orders/${requireId(orderId, 'orderId')}/evidence`, { data: { url, evidenceType } });
  return response.data;
}

export async function markProviderReadyForReview(orderId: string) {
  const response = await apiClient.post(`/safepay/orders/${requireId(orderId, 'orderId')}/ready-for-review`);
  return response.data;
}

export async function getProviderDispute(orderId: string) {
  try {
    const response = await apiClient.get(`/safepay/contract/${orderId}/dispute`);
    return response.data?.dispute ?? null;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404) return null;
    throw error;
  }
}

export async function openProviderDispute(orderId: string, payload: { reasonCategory: string; title: string; description: string }) {
  const response = await apiClient.post(`/safepay/contract/${orderId}/dispute`, payload);
  return response.data;
}

export async function getProviderOrderReviews(orderId: string) {
  const response = await apiClient.get(`/orders/${orderId}/review`);
  return Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
}

export async function createProviderReview(payload: { orderId: string; serviceId: string; revieweeId: string; rating: number; comment: string }) {
  const response = await apiClient.post('/reviews', { ...payload, revieweeRole: 'seeker' });
  return response.data;
}