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
  serviceTitle: string;
  isProvider: boolean;
  customerName: string;
  providerName: string;
  paymentDate?: string;
  status: string;
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
