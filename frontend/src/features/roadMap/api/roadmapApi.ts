import mainLink from "../../../api/mainURLs";
import type { RoadmapFeature, RoadmapFeatureInput } from "../types/roadmap";

export const roadmapApi = {
    getFeatures: async (): Promise<RoadmapFeature[]> => {
        const response = await mainLink.get("/api/upcoming");
        return response.data;
    },
    
    createFeature: async (feature: RoadmapFeatureInput): Promise<RoadmapFeature> => {
        const response = await mainLink.post("/api/upcoming", feature);
        return response.data;
    },
    
    updateFeature: async (id: string, feature: RoadmapFeatureInput): Promise<RoadmapFeature> => {
        const response = await mainLink.put(`/api/upcoming/${id}`, feature);
        return response.data;
    },
    
    deleteFeature: async (id: string): Promise<void> => {
        await mainLink.delete(`/api/upcoming/${id}`);
    }
};
