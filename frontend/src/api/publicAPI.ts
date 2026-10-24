import mainLink from './mainURLs';

export const getPublicStats = async () => {
  const res = await mainLink.get('/api/public/stats');
  return res.data;
};

// Called imperatively from ErrorBoundary (class component + route error element): no hooks there.
export const postClientError = (payload: Record<string, unknown>) =>
  mainLink.post('/api/errors/client', payload);
