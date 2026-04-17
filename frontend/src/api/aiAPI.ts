import mainLink from "./mainURLs";

export interface AIJobListingResponse {
  success: boolean;
  data: {
    title: string;
    description: string;
    category: string;
    skills: string[];
    duration: {
      value: number;
      unit: "minutes" | "hours" | "days";
    };
    locationRelevance: "on-site" | "remote";
    priceRange: {
      min: number;
      max: number;
    };
    pricingReasoning: string;
  };
}

export const generateFullJobListing = async (
  prompt: string,
): Promise<AIJobListingResponse> => {
  const response = await mainLink.post("/api/ai/generate-full-listing", {
    prompt,
  });
  return response.data;
};
