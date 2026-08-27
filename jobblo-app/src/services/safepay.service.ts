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
  const response = await apiClient.post('/safepay-checkout/create-session', {
    orderId: requireId(orderId, 'orderId'),
    // A closed enum, not a URL. The server owns both return URLs; all this says is "the
    // caller is the app", which makes Stripe return through the HTTPS bridge that hands off
    // to `jobblo://safepay/success`. Sending URLs from here would be an open redirect with
    // Stripe as the referrer, so the API does not accept them.
    platform: 'mobile',
  });
  return response.data;
}

export async function getSafePaySessionStatus(sessionId: string): Promise<SafePaySessionStatusResponse> {
  const response = await apiClient.get(`/safepay-checkout/status/${requireId(sessionId, 'sessionId')}`);
  return response.data;
}