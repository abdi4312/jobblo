import apiClient from '../api/client';
import type { Job, JobsResponse, FetchJobsParams, MyJob } from '../types/Jobs';

/**
 * Jobs service layer for API calls to /api/services endpoint.
 *
 * All job discovery and listing API interactions go through this module.
 * This centralizes the endpoint, params normalization, and error handling.
 */

export const jobsService = {
  /**
   * Fetch all services/jobs with optional filters and pagination.
   *
   * Maps to GET /api/services on the backend.
   *
   * @param params - Query parameters for filtering and pagination
   * @returns JobsResponse with data array and pagination info
   */
  async fetchJobs(params: FetchJobsParams): Promise<JobsResponse> {
    const {
      page = 1,
      limit = 16,
      categories = [],
      locations = [],
      countyCodes = [],
      municipalityCodes = [],
      areaCodes = [],
      search = '',
      sort = '',
      userId = '',
      urgent = false,
      minPrice,
      maxPrice,
      lat,
      lng,
      radius,
    } = params;

    // Build query params object, filtering out undefined values
    const queryParams: Record<string, any> = {
      page,
      limit,
    };

    if (categories.length > 0) queryParams.category = categories.join(',');
    if (locations.length > 0) queryParams.location = locations.join(',');
    if (countyCodes.length > 0) queryParams.countyCodes = countyCodes.join(',');
    if (municipalityCodes.length > 0) queryParams.municipalityCodes = municipalityCodes.join(',');
    if (areaCodes.length > 0) queryParams.areaCodes = areaCodes.join(',');
    if (search) queryParams.search = search;
    if (sort) queryParams.sort = sort;
    if (userId) queryParams.userId = userId;
    if (urgent) queryParams.urgent = urgent;
    if (minPrice !== undefined) queryParams.minPrice = minPrice;
    if (maxPrice !== undefined) queryParams.maxPrice = maxPrice;
    if (lat !== undefined) queryParams.lat = lat;
    if (lng !== undefined) queryParams.lng = lng;
    if (radius !== undefined) queryParams.radius = radius;

    const response = await apiClient.get<JobsResponse>('/services', {
      params: queryParams,
    });

    // Normalize response — backend may return different shapes
    let rawList = response.data.data ?? response.data;
    if (!Array.isArray(rawList)) {
      rawList = [];
    }

    const pagination = response.data.pagination || {
      total: rawList.length,
      totalPages: 1,
      page: Number(page),
      limit: Number(limit),
    };

    return {
      data: rawList,
      pagination,
    };
  },

  /**
   * Get a single job/service by ID.
   * @param jobId - The job ID to fetch
   */
  async getJob(jobId: string): Promise<Job> {
    const response = await apiClient.get<{ data?: Job; job?: Job }>(`/services/${jobId}`);
    return (response.data?.data ?? response.data?.job ?? response.data) as Job;
  },

  /**
   * Fetch the listings posted by the authenticated user.
   *
   * Maps to GET /api/services/my-posted. Ownership comes from the token on the
   * server (req.userId) — never send a userId param here. The response is a bare
   * array of listings, each with a server-computed `capabilities` object.
   */
  async fetchMyJobs(): Promise<MyJob[]> {
    const response = await apiClient.get<MyJob[]>('/services/my-posted');
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Delete one of the authenticated user's listings.
   *
   * Maps to DELETE /api/services/:serviceId. The server answers 403 when the
   * caller is not the owner and 409 with a human-readable Norwegian `error`
   * when an active order blocks deletion — callers must surface that text.
   */
  async deleteMyJob(serviceId: string): Promise<void> {
    if (!serviceId.trim()) throw new Error('Mangler gyldig annonse-ID');
    await apiClient.delete(`/services/${serviceId.trim()}`);
  },
};
