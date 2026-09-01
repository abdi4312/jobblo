import apiClient from '../api/client';
import type { FilterOptions } from '../types/Category';

/**
 * Categories service layer for API calls to /api/filter/options endpoint.
 *
 * Fetches available categories and filter options from the backend.
 */

export const categoriesService = {
  /**
   * Fetch all available filter options including categories with icons, sort options, etc.
   *
   * Maps to GET /api/filter/options on the backend.
   *
   * @returns FilterOptions with categories (with icon field), locations, sort options, etc.
   */
  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const response = await apiClient.get('/filter/options');

      // Handle both response.data.filters and direct response.data
      const data = response.data.filters || response.data;

      return {
        categories: data.categories || [],
        locations: data.locations || [],
        urgentCount: data.urgentCount || 0,
        priceRange: data.priceRange || { min: 0, max: 100000 },
        sortOptions: data.sortOptions || [],
        types: data.types || [],
      };
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
      throw error;
    }
  },
};
