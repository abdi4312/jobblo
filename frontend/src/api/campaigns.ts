import mainLink from './mainURLs';
import type { ApiResponse } from '../types/admin';

export interface PublicCampaign {
  id: string;
  name: string;
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
}

export interface CampaignAssignment {
  variant: 'A' | 'B';
  token: string;
}

export interface PublicCampaignData {
  campaign: PublicCampaign | null;
  assignment?: CampaignAssignment;
}

const newId = () => {
  if (window.crypto.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const getVisitorId = () => {
  const key = 'jobblo:campaign:visitor';
  try {
    let visitorId = window.localStorage.getItem(key);
    if (!visitorId) {
      visitorId = newId();
      window.localStorage.setItem(key, visitorId);
    }
    return visitorId;
  } catch {
    return newId();
  }
};

export const fetchPublicCampaign = async (): Promise<PublicCampaignData> => {
  const response = await mainLink.get<ApiResponse<PublicCampaignData>>('/api/campaigns/public', {
    params: { visitorId: getVisitorId() },
  });
  return response.data.data;
};

export const fetchCampaignTerms = async (): Promise<{ name: string; disclaimer: string }> => {
  const response = await mainLink.get<ApiResponse<{ name: string; disclaimer: string }>>('/api/campaigns/terms');
  return response.data.data;
};

export const trackCampaignEvent = async (
  assignmentToken: string,
  eventType: 'impression' | 'click' | 'close',
  closeMethod?: 'button' | 'backdrop' | 'escape'
) => mainLink.post('/api/campaigns/events', {
  eventId: newId(),
  assignmentToken,
  eventType,
  ...(closeMethod ? { closeMethod } : {}),
});
