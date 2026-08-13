import mainLink from '../../api/mainURLs';
import type { Jobs } from './types';
import type { Tab } from '../../types/tabs';

interface FetchJobsParams {
  page?: number;
  limit?: number;
  categories?: string[];
  locations?: string[];
  countyCodes?: string[];
  municipalityCodes?: string[];
  areaCodes?: string[];
  search?: string;
  sort?: string;
  userId?: string;
  urgent?: boolean;
  minPrice?: number;
  maxPrice?: number;
  tab?: Tab;
  lat?: number;
  lng?: number;
  radius?: number;
}

export interface JobsResponse {
  data: Jobs[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export const fetchJobs = async ({
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
  tab = 'Discover',
  lat,
  lng,
  radius,
}: FetchJobsParams): Promise<JobsResponse> => {
  // Use the main services endpoint
  const url = '/api/services';

  const res = await mainLink.get(url, {
    params: {
      page,
      limit,
      category: categories.length ? categories.join(',') : undefined,
      location: locations.length ? locations.join(',') : undefined,
      countyCodes: countyCodes.length ? countyCodes.join(',') : undefined,
      municipalityCodes: municipalityCodes.length ? municipalityCodes.join(',') : undefined,
      areaCodes: areaCodes.length ? areaCodes.join(',') : undefined,
      search: search || undefined,
      sort: sort || undefined,
      userId: userId || undefined,
      urgent: urgent || undefined,
      minPrice: minPrice !== undefined ? minPrice : undefined,
      maxPrice: maxPrice !== undefined ? maxPrice : undefined,
      lat: lat !== undefined ? lat : undefined,
      lng: lng !== undefined ? lng : undefined,
      radius: radius !== undefined ? radius : undefined,
    },
  });

  const responseData = res.data;

  let rawList: Jobs[] = [];
  if (Array.isArray(responseData)) {
    rawList = responseData;
  } else if (Array.isArray(responseData?.data)) {
    rawList = responseData.data;
  } else if (Array.isArray(responseData?.services)) {
    rawList = responseData.services;
  }

  const pagination = responseData?.pagination || {
    total: responseData?.count || rawList.length,
    totalPages: Math.max(1, Math.ceil((responseData?.count || rawList.length) / limit)),
    page: Number(page),
    limit: Number(limit),
  };

  return {
    data: rawList,
    pagination,
  };
};
