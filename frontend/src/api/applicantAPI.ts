import mainLink from './mainURLs';

export const getApplicants = async (serviceId: string) => {
  const res = await mainLink.get(`/api/applicants/${serviceId}`);
  return res.data;
};

export const getMyApplicantsOverview = async () => {
  const res = await mainLink.get('/api/applicants/my/overview');
  return res.data;
};

export const createSafePayContract = async (data: {
  serviceId: string;
  applicantId: string;
  requestId: string;
}) => {
  const res = await mainLink.post('/api/safepay/create-contract', data);
  return res.data;
};
