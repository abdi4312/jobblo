import mainLink from '../../api/mainURLs';
import type { LocationNode, LocationStats } from '../../api/locationAPI';

export async function getLocationTree() {
  const res = await mainLink.get('/api/location-filter/tree');
  return res.data as LocationNode[];
}

export async function getLocationStats() {
  const res = await mainLink.get('/api/location-filter/stats');
  return res.data as LocationStats;
}
