import mainLink from './mainURLs';

export const getPublicStats = async () => {
  const res = await mainLink.get('/api/public/stats');
  return res.data;
};
