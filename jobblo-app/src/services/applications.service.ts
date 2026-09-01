/**
 * Applications service - handles job application API calls.
 * Wraps backend API endpoints for applying to jobs.
 */

import apiClient from '../api/client';
import type {
  JobRequest,
  CreateJobRequestPayload,
  MyApplicationsResponse,
  ApplicationStatus,
} from '../types/Application';

/**
 * Apply to a job by creating a job request.
 *
 * Endpoint: POST /orders/request (baseUrl already includes /api)
 * Auth: Required
 * Returns: JobRequest with chatId
 */
export async function applyToJob(payload: CreateJobRequestPayload): Promise<JobRequest> {
  const response = await apiClient.post('/orders/request', payload);
  return response.data;
}

/**
 * Get all my job requests (applications I've sent).
 *
 * Endpoint: GET /orders/requests/my (baseUrl already includes /api)
 * Auth: Required
 */
export async function getMyJobRequests(): Promise<JobRequest[]> {
  const response = await apiClient.get('/orders/requests/my');
  return response.data;
}

/**
 * List my applications as the applicant/worker.
 * Endpoint: GET /api/my-applications (baseUrl already includes /api)
 */
export async function getMyApplications(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<MyApplicationsResponse> {
  const response = await apiClient.get('/my-applications', { params });
  return response.data;
}

/**
 * Withdraw a pending application.
 * Endpoint: DELETE /api/my-applications/:requestId
 */
export async function withdrawApplication(requestId: string): Promise<{ message: string }> {
  const response = await apiClient.delete(`/my-applications/${requestId}`);
  return response.data;
}

/**
 * Update a job request status (accept or decline).
 * Only the provider (job owner) can do this.
 *
 * Endpoint: PATCH /orders/request/:id (baseUrl already includes /api)
 * Auth: Required (provider only)
 */
export async function updateJobRequestStatus(
  requestId: string,
  status: Exclude<ApplicationStatus, 'pending'>
): Promise<JobRequest> {
  const response = await apiClient.patch(`/orders/request/${requestId}`, {
    status,
  });
  return response.data;
}
