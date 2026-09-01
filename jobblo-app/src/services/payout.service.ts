import apiClient from '../api/client';

export type PayoutOnboardingStatus = 'none' | 'started' | 'restricted' | 'enabled' | 'pending_verification';

export type ConnectStatusResponse = {
  hasAccount: boolean;
  payoutOnboardingStatus: PayoutOnboardingStatus;
  payoutEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  connectedAt?: string;
  lastRefreshed?: string;
};

export type AccountLinkResponse = {
  url: string;
};

export type RefreshStatusResponse = {
  payoutOnboardingStatus: PayoutOnboardingStatus;
  payoutEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
};

export async function getConnectStatus(): Promise<ConnectStatusResponse> {
  const response = await apiClient.get<ConnectStatusResponse>('/connect/status');
  return response.data;
}

export async function createAccountLink(): Promise<AccountLinkResponse> {
  const response = await apiClient.post<AccountLinkResponse>('/connect/account-link');
  return response.data;
}

export async function refreshAccountStatus(): Promise<RefreshStatusResponse> {
  const response = await apiClient.post<RefreshStatusResponse>('/connect/refresh');
  return response.data;
}
