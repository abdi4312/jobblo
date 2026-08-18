import apiClient from '../api/client';

export interface LocationNode {
  type: 'county' | 'municipality' | 'area';
  code: string;
  name: string;
  count?: number;
  children?: LocationNode[];
}

export interface LocationStats {
  counties: Record<string, number>;
  municipalities: Record<string, number>;
  areas: Record<string, number>;
}

/**
 * Location service layer for location filter APIs.
 * Provides county/municipality/area hierarchy for filtering jobs by region.
 */
export const locationService = {
  /**
   * Fetch the complete location tree: counties with nested municipalities and areas.
   */
  async getLocationTree(): Promise<LocationNode[]> {
    const response = await apiClient.get<LocationNode[]>('/location-filter/tree');
    return response.data;
  },

  /**
   * Fetch location statistics: job counts per county, municipality, and area.
   */
  async getLocationStats(): Promise<LocationStats> {
    const response = await apiClient.get<LocationStats>('/location-filter/stats');
    return response.data;
  },
};
