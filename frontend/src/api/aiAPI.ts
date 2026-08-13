import mainLink from './mainURLs';

export interface AISmartFillContext {
  existingTitle?: string;
  existingDescription?: string;
  existingCategory?: string;
  existingPaymentType?: 'Timepris' | 'Fastpris' | 'Anbud';
  existingDuration?: { value: number | string; unit: 'minutes' | 'hours' | 'days' };
  existingCity?: string;
  existingCounty?: string;
  existingCountyCode?: string;
  existingEquipment?: string;
  existingUrgent?: boolean;
}

export interface AIDuration {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface AIJobListingResponse {
  success: boolean;
  data: {
    title: string;
    description: string;
    category: string;
    skills: string[];
    duration: AIDuration;
    locationRelevance: 'on-site' | 'remote';
    priceRange: { min: number; max: number };
    hourlyRate?: number;
    suggestedPrice?: number;
    priceMin?: number;
    priceMax?: number;
    estimatedPrice?: number;
    pricingReasoning?: string;
    paymentType: 'Timepris' | 'Fastpris' | 'Anbud';
    isEstimate: boolean;
  };
  error?: string;
  message?: string;
  validationErrors?: string[];
}

export const generateFullJobListing = async (
  prompt: string,
  ctx: AISmartFillContext = {}
): Promise<AIJobListingResponse> => {
  const response = await mainLink.post('/api/ai/generate-full-listing', {
    prompt,
    existingTitle: ctx.existingTitle,
    existingDescription: ctx.existingDescription,
    existingCategory: ctx.existingCategory,
    existingPaymentType: ctx.existingPaymentType,
    existingDuration: ctx.existingDuration,
    existingCity: ctx.existingCity,
    existingCounty: ctx.existingCounty ?? ctx.existingCountyCode,
    existingEquipment: ctx.existingEquipment,
    existingUrgent: ctx.existingUrgent,
  });
  return response.data;
};
