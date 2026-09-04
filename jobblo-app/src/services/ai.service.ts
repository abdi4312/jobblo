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

export interface ImageAnalysisResult {
  title: string;
  description: string;
  category: string;
  duration: { value: number; unit: 'minutes' | 'hours' | 'days' };
  durationRange: { min: number; max: number; unit: 'minutes' | 'hours' | 'days' };
  suggestedPrice: number;
  priceMin: number;
  priceMax: number;
  hourlyRate: number;
  pricingReasoning: string;
}

export async function analyzeJobImage(
  imageUri: string,
  imageName: string,
  imageType: string,
): Promise<ImageAnalysisResult> {
  const formData = new FormData();
  formData.append('image', { uri: imageUri, name: imageName, type: imageType } as unknown as Blob);
  formData.append('lang', 'no');
  const response = await apiClient.post<{ success: boolean; data: ImageAnalysisResult; error?: string }>(
    '/ai/analyze-job-image',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  if (!response.data.success || !response.data.data) throw new Error(response.data.error ?? 'Kunne ikke analysere bildet');
  return response.data.data;
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
