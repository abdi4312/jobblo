import mainLink from './mainURLs';

export const getApplicants = async (serviceId: string, sort?: string, filter?: string) => {
  const params: any = {};
  if (sort) params.sort = sort;
  if (filter) params.filter = filter;
  const res = await mainLink.get(`/api/applicants/${serviceId}`, { params });
  return res.data;
};

export const getMyApplicantsOverview = async () => {
  const res = await mainLink.get('/api/applicants/my/overview');
  return res.data;
};

/** Provider: all services they applied to, with full order/chat/status */
export const getMyApplicationsOverview = async (status?: string) => {
  const params: any = {};
  if (status) params.status = status;
  const res = await mainLink.get('/api/my-applications', { params });
  return res.data;
};

export const withdrawMyApplication = async (requestId: string) => {
  const res = await mainLink.delete(`/api/my-applications/${requestId}`);
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

export const toggleApplicantFavorite = async (requestId: string) => {
  const res = await mainLink.patch(`/api/applicants/${requestId}/favorite`);
  return res.data;
};

export const toggleApplicantArchive = async (requestId: string) => {
  const res = await mainLink.patch(`/api/applicants/${requestId}/archive`);
  return res.data;
};

export const declineApplicant = async (requestId: string, archive = false) => {
  const res = await mainLink.patch(`/api/applicants/${requestId}/decline`, { archive });
  return res.data;
};
