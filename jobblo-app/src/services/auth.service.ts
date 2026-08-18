import apiClient from '@/api/client';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  lastName: string;
  email: string;
  password: string;
  role?: string;
  companyName?: string;
  orgNumber?: string;
};

export type AuthUser = {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role?: string;
  [key: string]: unknown;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
};

export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return response.data;
}

export async function registerUser(payload: RegisterRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/register', payload);
  return response.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return response.data;
}

export async function verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
  const response = await apiClient.post<{ resetToken: string }>('/auth/verify-otp', {
    email,
    otp,
  });
  return response.data;
}

export async function resetPassword(
  resetToken: string,
  password: string
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/reset-password', {
    resetToken,
    password,
  });
  return response.data;
}
