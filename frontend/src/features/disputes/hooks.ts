import { useQuery } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';

export interface DisputeMessage {
  _id?: string;
  senderId?: string | { _id?: string };
  senderRole?: string;
  message?: string;
  createdAt?: string;
}

export interface Dispute {
  _id: string;
  status?: string;
  reasonCategory?: string;
  title?: string;
  description?: string;
  createdAt?: string;
  resolution?: { outcome?: string; note?: string };
  messages?: DisputeMessage[];
}

/**
 * Disputes used to be write-only for both parties: opening one produced a toast
 * and then nothing at all. `GET /api/safepay/contract/:orderId/dispute` and
 * `POST /api/safepay/disputes/:disputeId/message` were both routed and both
 * called from nowhere in the B2C frontend, so a customer who had escalated a
 * payment problem had no status, no thread and no way to add evidence.
 */
export const useDispute = (orderId?: string) =>
  useQuery<Dispute | null>({
    queryKey: ['dispute', orderId],
    enabled: !!orderId,
    retry: false,
    queryFn: async () => {
      try {
        const res = await mainLink.get(`/api/safepay/contract/${orderId}/dispute`);
        return res.data?.dispute ?? null;
      } catch (err) {
        // 404 is the ordinary "no dispute on this order" answer, not a failure.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return null;
        throw err;
      }
    },
  });
