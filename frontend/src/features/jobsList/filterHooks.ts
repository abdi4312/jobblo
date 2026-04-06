import { useQuery } from "@tanstack/react-query";
import mainLink from "../../api/mainURLs";

export interface FilterOptions {
    categories: Array<{
        _id: string;
        name: string;
        subcategories: Array<{
            _id: string;
            name: string;
        }>;
    }>;
    locations: string[];
    priceRange: {
        min: number;
        max: number;
    };
    sortOptions: Array<{
        label: string;
        value: string;
    }>;
}

export const useFilterOptions = () => {
    return useQuery<FilterOptions>({
        queryKey: ["filterOptions"],
        queryFn: async () => {
            const res = await mainLink.get("/api/filter/options");
            return res.data.filters;
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};
