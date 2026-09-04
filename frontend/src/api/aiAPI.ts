import mainLink from './mainURLs';

export interface AISmartFillContext {
  /**
   * UI locale from LanguageContext. The backend answers in this language.
   * When omitted the backend sniffs the prompt text instead, so this is an
   * override rather than a requirement.
   */
  lang?: 'no' | 'en';
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
    /**
     * What the model chose to ASK about rather than invent. Empty when the
     * user's input was already complete enough.
     */
    openQuestions?: string[];
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

export interface AIImageJobResponse {
  success: boolean;
  data: {
    title: string;
    description: string;
    category: string;
    duration: AIDuration;
    durationRange: { min: number; max: number; unit: AIDuration['unit'] };
    suggestedPrice: number;
    priceMin: number;
    priceMax: number;
    hourlyRate: number;
    pricingReasoning: string;
    isEstimate: true;
  };
  error?: string;
  message?: string;
}

export const analyzeJobImage = async (
  image: File,
  lang?: 'no' | 'en'
): Promise<AIImageJobResponse> => {
  const formData = new FormData();
  formData.append('image', image);
  if (lang) formData.append('lang', lang);
  const response = await mainLink.post('/api/ai/analyze-job-image', formData);
  return response.data;
};

export const generateFullJobListing = async (
  prompt: string,
  ctx: AISmartFillContext = {}
): Promise<AIJobListingResponse> => {
  const response = await mainLink.post('/api/ai/generate-full-listing', {
    prompt,
    lang: ctx.lang,
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
