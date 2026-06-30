import mainLink from './mainURLs';

export interface LocationNode {
  type: 'county' | 'municipality' | 'area';
  code: string;
  name: string;
  children?: LocationNode[];
}

export interface LocationStats {
  counties: Record<string, number>;
  municipalities: Record<string, number>;
  areas: Record<string, number>;
}

export const getLocationTree = async (): Promise<LocationNode[]> => {
  const response = await mainLink.get('/api/location-filter/tree');
  return response.data;
};

export const getLocationStats = async (): Promise<LocationStats> => {
  const response = await mainLink.get('/api/location-filter/stats');
  return response.data;
};
