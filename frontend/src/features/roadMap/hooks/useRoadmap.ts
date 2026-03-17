import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roadmapApi } from "../api/roadmapApi";
import type { RoadmapFeatureInput } from "../types/roadmap";
import { toast } from "react-hot-toast";

export const useRoadmapFeatures = () => {
    return useQuery({
        queryKey: ["roadmap-features"],
        queryFn: roadmapApi.getFeatures
    });
};

export const useCreateRoadmapFeature = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: roadmapApi.createFeature,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roadmap-features"] });
            toast.success("Feature added successfully");
        }
    });
};

export const useUpdateRoadmapFeature = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: RoadmapFeatureInput }) => 
            roadmapApi.updateFeature(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roadmap-features"] });
            toast.success("Feature updated successfully");
        }
    });
};

export const useDeleteRoadmapFeature = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: roadmapApi.deleteFeature,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roadmap-features"] });
            toast.success("Feature deleted successfully");
        }
    });
};
