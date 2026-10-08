import mainLink from '../mainURLs';
import type { ApiResponse } from '../../types/admin';

export interface Campaign {
  _id: string;
  name: string;
  enabled: boolean;
  startDate: string;
  endDate: string;
  bannerText: string;
  bannerCtaLabel: string;
  bannerCtaUrl: string;
  popupVersionA: string;
  popupVersionB: string;
  popupCtaLabel: string;
  popupCtaUrl: string;
  popupDelayMs: number;
  popupCooldownMs: number;
  termsLabel: string;
  termsUrl: string;
  disclaimer: string;
}

export interface CampaignAnalytics {
  total: { impressions: number; clicks: number; closes: number; ctr: number };
  variants: Record<'A' | 'B', { impressions: number; clicks: number; closes: number; ctr: number }>;
}

export const fetchCampaigns = async (): Promise<Campaign[]> => {
  const response = await mainLink.get<ApiResponse<{ campaigns: Campaign[] }>>('/api/admin/campaigns');
  return response.data.data.campaigns;
};

export const fetchCampaignDefaults = async (): Promise<Omit<Campaign, '_id'>> => {
  const response = await mainLink.get<ApiResponse<{ defaults: Omit<Campaign, '_id'> }>>(
    '/api/admin/campaigns/defaults'
  );
  return response.data.data.defaults;
};

export const createCampaign = async (payload: Omit<Campaign, '_id'>): Promise<Campaign> => {
  const response = await mainLink.post<ApiResponse<{ campaign: Campaign }>>('/api/admin/campaigns', payload);
  return response.data.data.campaign;
};

export const updateCampaign = async (campaign: Campaign): Promise<Campaign> => {
  const response = await mainLink.put<ApiResponse<{ campaign: Campaign }>>(
    `/api/admin/campaigns/${campaign._id}`,
    campaign
  );
  return response.data.data.campaign;
};

export const deleteCampaign = async (id: string): Promise<void> => {
  await mainLink.delete(`/api/admin/campaigns/${id}`);
};

export const fetchCampaignAnalytics = async (id: string): Promise<CampaignAnalytics> => {
  const response = await mainLink.get<ApiResponse<{ analytics: CampaignAnalytics }>>(
    `/api/admin/campaigns/${id}/analytics`
  );
  return response.data.data.analytics;
};
