import apiClient from '../api/client';
import type { Dispute, OpenDisputeInput, OpenDisputeResponse } from '../types/Dispute';
import { httpStatus } from '../utils/disputeError';

function requireId(value: string, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Mangler gyldig ${name}`);
  return value.trim();
}

/**
 * GET /api/safepay/contract/:orderId/dispute — newest dispute for the order.
 * The API filters internal admin messages server-side; `stripInternalMessages`
 * mirrors that here so malformed payloads can never reach the thread UI.
 * 404 ("Ingen tvist funnet.") is a normal "no dispute yet" answer, not an error.
 */
export async function getDisputeByOrder(orderId: string): Promise<Dispute | null> {
  try {
    const response = await apiClient.get(`/safepay/contract/${requireId(orderId, 'orderId')}/dispute`);
    const dispute = (response.data?.dispute ?? null) as Dispute | null;
    return dispute ? stripInternalMessages(dispute) : null;
  } catch (error) {
    if (httpStatus(error) === 404) return null;
    throw error;
  }
}

/**
 * POST /api/safepay/contract/:orderId/dispute
 * Body is exactly { reasonCategory, title, description } — the backend derives
 * customer/provider/openedBy from the order, so no participant IDs are sent.
 */
export async function openDispute(orderId: string, payload: OpenDisputeInput): Promise<OpenDisputeResponse> {
  const response = await apiClient.post(`/safepay/contract/${requireId(orderId, 'orderId')}/dispute`, {
    reasonCategory: payload.reasonCategory,
    title: payload.title,
    description: payload.description,
  });
  return response.data ?? {};
}

/** POST /api/safepay/disputes/:disputeId/message — body is exactly { message }. */
export async function addDisputeMessage(disputeId: string, message: string) {
  const response = await apiClient.post(`/safepay/disputes/${requireId(disputeId, 'disputeId')}/message`, { message });
  return response.data;
}

export function stripInternalMessages(dispute: Dispute): Dispute {
  if (!Array.isArray(dispute.messages)) return { ...dispute, messages: [] };
  return { ...dispute, messages: dispute.messages.filter((m) => m?.isInternal !== true) };
}
