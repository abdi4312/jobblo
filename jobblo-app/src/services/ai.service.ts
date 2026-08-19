import apiClient from '../api/client';

export interface SmartFillResult {
  title: string;
  description: string;
  category: string;
  skills: string[];
  duration: { value: number; unit: 'minutes' | 'hours' | 'days' };
  hourlyRate?: number;
  suggestedPrice?: number;
  estimatedPrice?: number;
  paymentType: 'Timepris' | 'Fastpris' | 'Anbud';
}

export async function generateFullJobListing(prompt: string, context: {
  title?: string;
  description?: string;
  category?: string;
  paymentType?: 'Timepris' | 'Fastpris' | 'Anbud';
  duration?: { value: string; unit: 'minutes' | 'hours' | 'days' };
  city?: string;
  countyCode?: string;
  equipment?: string;
  urgent?: boolean;
}): Promise<SmartFillResult> {
  const response = await apiClient.post<{ success: boolean; data: SmartFillResult; error?: string }>('/ai/generate-full-listing', {
    prompt,
    lang: 'no',
    existingTitle: context.title,
    existingDescription: context.description,
    existingCategory: context.category,
    existingPaymentType: context.paymentType,
    existingDuration: context.duration,
    existingCity: context.city,
    existingCountyCode: context.countyCode,
    existingEquipment: context.equipment,
    existingUrgent: context.urgent,
  });
  if (!response.data.success || !response.data.data) throw new Error(response.data.error ?? 'Kunne ikke fylle ut oppdraget');
  return response.data.data;
}
