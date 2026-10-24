import { useQuery } from '@tanstack/react-query';
import { getFilterOptions } from './jobListingAPI';

interface FilterOptionLocation {
  name: string;
  count?: number;
}

interface FilterOptionCategory {
  _id: string;
  name: string;
  count?: number;
  subcategories: Array<{
    _id: string;
    name: string;
    count?: number;
  }>;
}

interface FilterOptions {
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
    queryKey: ['filterOptions'],
    queryFn: getFilterOptions,
    staleTime: 1000 * 60 * 30, // 30 mins
  });
};
