import apiClient from '../api/client';
import type { ApplicantsDetailResponse, MyApplicantsOverviewResponse } from '../types/Applicants';

export async function getMyApplicantsOverview(): Promise<MyApplicantsOverviewResponse> {
  const response = await apiClient.get('/applicants/my/overview');
  return response.data;
}

export async function getApplicants(
  serviceId: string,
  sort = 'createdAt',
  filter = 'notArchived',
): Promise<ApplicantsDetailResponse> {
  const response = await apiClient.get(`/applicants/${serviceId}`, {
    params: { sort, filter },
  });
  return response.data;
}

export async function toggleApplicantFavorite(requestId: string): Promise<{ favorite: boolean }> {
  const response = await apiClient.patch(`/applicants/${requestId}/favorite`);
  return response.data;
}

export async function toggleApplicantArchive(requestId: string): Promise<{ archived: boolean }> {
  const response = await apiClient.patch(`/applicants/${requestId}/archive`);
  return response.data;
}

export async function declineApplicant(
  requestId: string,
  archive = true,
): Promise<{ message?: string }> {
  const response = await apiClient.patch(`/applicants/${requestId}/decline`, { archive });
  return response.data;
}

export async function createSafePayContract(payload: {
  serviceId: string;
  applicantId: string;
  requestId: string;
}): Promise<{ orderId: string }> {
  const ids = [payload.serviceId, payload.applicantId, payload.requestId];
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error('Mangler gyldig serviceId, applicantId eller requestId');
  }

  const response = await apiClient.post('/safepay/create-contract', {
    serviceId: payload.serviceId.trim(),
    applicantId: payload.applicantId.trim(),
    requestId: payload.requestId.trim(),
  });
  return response.data;
}