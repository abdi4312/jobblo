import apiClient from '../api/client';
import type { SafePayApprovalResponse } from '../types/SafePay';

type ReactNativeFilePart = { uri: string; name: string; type: string };

function requireId(value: string, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Mangler gyldig ${name}`);
  return value.trim();
}

export async function updateCustomerChecklist(orderId: string, itemId: string, checked: boolean) {
  const response = await apiClient.put(`/safepay-checkout/contract/${requireId(orderId, 'orderId')}/checklist/${requireId(itemId, 'itemId')}`, { checked });
  return response.data;
}

export async function uploadReviewPhotos(orderId: string, photos: Array<{ uri: string; name: string; type: string }>) {
  const safeOrderId = requireId(orderId, 'orderId');
  if (photos.length > 6) throw new Error('Maksimalt 6 bilder kan lastes opp');
  const formData = new FormData();
  photos.forEach((photo) => {
    const part: ReactNativeFilePart = { uri: photo.uri, name: photo.name, type: photo.type };
    (formData as FormData & { append(name: string, value: ReactNativeFilePart): void }).append('photos', part);
  });
  const response = await apiClient.post<{ urls: string[] }>(`/safepay-checkout/review-photos/${safeOrderId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return response.data;
}

export async function approveSafePayJob(payload: {
  orderId: string;
  ratings: { overall: number; punctuality?: number; quality?: number; communication?: number; tidiness?: number };
  comment: string;
  photos: string[];
  recommendWorker: boolean;
}): Promise<SafePayApprovalResponse> {
  const response = await apiClient.post<SafePayApprovalResponse>('/safepay-checkout/approve', { ...payload, orderId: requireId(payload.orderId, 'orderId') });
  return response.data;
}