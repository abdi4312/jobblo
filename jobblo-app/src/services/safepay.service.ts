import apiClient from '../api/client';
import type { SafePayCheckoutResponse, SafePaySessionResponse, SafePaySessionStatusResponse } from '../types/SafePay';

function requireId(value: string, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Mangler gyldig ${name}`);
  return value.trim();
}

export async function getSafePayCheckout(orderId: string): Promise<SafePayCheckoutResponse> {
  const response = await apiClient.get(`/safepay-checkout/details/${requireId(orderId, 'orderId')}`);
  return response.data;
}

export async function createSafePaySession(orderId: string): Promise<SafePaySessionResponse> {
  const response = await apiClient.post('/safepay-checkout/create-session', { orderId: requireId(orderId, 'orderId') });
  return response.data;
}

export async function getSafePaySessionStatus(sessionId: string): Promise<SafePaySessionStatusResponse> {
  const response = await apiClient.get(`/safepay-checkout/status/${requireId(sessionId, 'sessionId')}`);
  return response.data;
}