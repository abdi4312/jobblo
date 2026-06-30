import mainLink from '../../api/mainURLs';
import type { UserUpdatePayload } from './types/user';

export const updateUser = async (userId: string, data: UserUpdatePayload) => {
  const response = await mainLink.put(`/api/users/${userId}`, data);
  return response.data;
};

export const getUserProfile = async (userId: string) => {
  const response = await mainLink.get(`/api/users/${userId}`);
  return response.data;
};

export const blockUser = async (userId: string) => {
  const response = await mainLink.post(`/api/users/${userId}/block`);
  return response.data;
};

export const getBlockedUsers = async (page = 1, limit = 10) => {
  const response = await mainLink.get('/api/users/blocked', {
    params: { page, limit },
  });
  return response.data;
};

export const searchUsers = async (query?: string) => {
  const response = await mainLink.get('/api/users/search', {
    params: { query },
  });
  return response.data;
};

export const getTopUsers = async () => {
  const response = await mainLink.get('/api/users/top');
  return response.data;
};

export const searchAll = async (query: string, type?: string, page?: number, limit?: number) => {
  const response = await mainLink.get('/api/users/search-all', {
    params: { query, type, page, limit },
  });
  return response.data;
};

export const getUserReviews = async (userId: string, role?: string) => {
  const response = await mainLink.get(`/api/users/${userId}/reviews`, {
    params: { role },
  });
  return response.data;
};

export const addPortfolioItem = async (data: FormData) => {
  const response = await mainLink.post('/api/users/portfolio', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deletePortfolioItem = async (itemId: string) => {
  const response = await mainLink.delete(`/api/users/portfolio/${itemId}`);
  return response.data;
};

export const addPreviousProject = async (data: FormData) => {
  const response = await mainLink.post('/api/users/previous-projects', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deletePreviousProject = async (projectId: string) => {
  const response = await mainLink.delete(`/api/users/previous-projects/${projectId}`);
  return response.data;
};

export const addCertification = async (data: FormData) => {
  const response = await mainLink.post('/api/users/certifications', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteCertification = async (certId: string) => {
  const response = await mainLink.delete(`/api/users/certifications/${certId}`);
  return response.data;
};

export const addExperience = async (data: any) => {
  const response = await mainLink.post('/api/users/experience', data);
  return response.data;
};

export const deleteExperience = async (expId: string) => {
  const response = await mainLink.delete(`/api/users/experience/${expId}`);
  return response.data;
};

export const getSafePayHistory = async (userId: string) => {
  const response = await mainLink.get(`/api/safepay/history/${userId}`);
  return response.data;
};
