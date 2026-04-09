import { useQuery } from "@tanstack/react-query";
import mainLink from "../../api/mainURLs";

export interface FilterOptionLocation {
    name: string;
    count?: number;
}

export interface FilterOptionCategory {
    _id: string;
    name: string;
    count?: number;
    subcategories: Array<{
        _id: string;
        name: string;
        count?: number;
    }>;
}

export interface FilterOptions {
    categories: FilterOptionCategory[];
    locations: FilterOptionLocation[];
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
