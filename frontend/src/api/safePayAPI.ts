import mainLink from './mainURLs';

export const createContract = async (data: {
  serviceId: string;
  applicantId: string;
  requestId?: string;
}) => {
  const res = await mainLink.post('/api/safepay/create-contract', data);
  return res.data;
};

export const getContract = async (orderId: string) => {
  const res = await mainLink.get(`/api/safepay/contract/${orderId}`);
  return res.data;
};

export const startJob = async (orderId: string) => {
  const res = await mainLink.post(`/api/safepay/contract/${orderId}/start`);
  return res.data;
};

export const completeJobAndPayout = async (orderId: string) => {
  const res = await mainLink.post(`/api/safepay/contract/${orderId}/complete`);
  return res.data;
};

export const getSafePayHistory = async (userId: string) => {
  const res = await mainLink.get(`/api/safepay/history/${userId}`);
  return res.data;
};
