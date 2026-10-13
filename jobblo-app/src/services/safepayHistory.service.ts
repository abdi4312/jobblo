import apiClient from '../api/client';

export type SafePayAmounts = {
  agreedPrice: number;
  fee: number;
  tax: number;
  totalCustomer: number;
  netProvider: number;
};

export type SafePayHistoryTransaction = {
  id: string;
  orderId?: string;
  serviceTitle: string;
  isProvider: boolean;
  customerName: string;
  providerName: string;
  paymentDate?: string;
  orderDate?: string;
  status: string;
  providerConnectStatus?: 'pending' | 'ready' | 'verification_retry';
  originalPaymentAmountMinor?: number;
  refundAmountMinor?: number;
  refundedAmountMinor?: number;
  refundStatus?: 'none' | 'pending' | 'succeeded' | 'failed' | 'reconciliation_required';
  refundReason?: string;
  cancellationReason?: string;
  stripePaymentIntentId?: string;
  stripeRefundId?: string;
  paymentMethodBrand?: string;
  paymentMethodLast4?: string;
  providerTransferAmountMinor?: number;
  hasVerifiedProviderTransfer?: boolean;
  providerTransferReversed?: boolean;
  payoutAmountMinor?: number;
  payoutStatus?: string;
  payoutFailureCode?: string | null;
  payoutFailureMessage?: string | null;
  stripeTransferId?: string | null;
  transferDate?: string | null;
  transferLivemode?: boolean;
  refundCompletedAt?: string;
  refundFailedAt?: string;
  providerConnectDeadlineAt?: string;
  transactionId?: string;
  amounts: SafePayAmounts;
};

export type SafePayHistoryResponse = {
  history: SafePayHistoryTransaction[];
  summary: {
    totalEarned: number;
    totalSpent: number;
    totalFees: number;
    totalTax: number;
    transactionCount: number;
  };
};

export async function getSafePayHistory(): Promise<SafePayHistoryResponse> {
  const response = await apiClient.get<SafePayHistoryResponse>('/safepay/history');
  return response.data;
}
