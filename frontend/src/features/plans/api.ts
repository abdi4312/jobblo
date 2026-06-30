import mainLink from '../../api/mainURLs';

export const getPlans = async () => {
  const res = await mainLink.get('/api/plans');
  return res.data;
};

export const updatePlan = async (id: string, data: any) => {
  const res = await mainLink.put(`/api/plans/${id}`, data);
  return res.data;
};

export const createPlan = async (data: any) => {
  const res = await mainLink.post('/api/plans', data);
  return res.data;
};

export const getConfigs = async () => {
  const res = await mainLink.get('/api/config');
  return res.data;
};

export const getConfigByKey = async (key: string) => {
  const res = await mainLink.get(`/api/config/${key}`);
  return res.data;
};

export const updateConfig = async (key: string, value: any) => {
  const res = await mainLink.post('/api/config/update', { key, value });
  return res.data;
};

export const initializeConfigs = async () => {
  const res = await mainLink.post('/api/config/initialize');
  return res.data;
};
