import { useUserStore } from '../stores/userStore';
import mainLink from './mainURLs'; // ensure mainLink is Axios instance

export interface TopUser {
  _id: string;
  name: string;
  lastName: string;
  avatarUrl?: string;
  averageRating: number;
  reviewCount: number;
  skills?: string[];
  locations?: string[];
  hourlyRate?: number;
}

export async function userLogin(email: string, password: string) {
  try {
    // POST login request
    const res = await mainLink.post(
      '/api/auth/login',
      { email, password },
      { withCredentials: true }
    );

    const { fetchProfile } = useUserStore.getState();
    await fetchProfile();

    return res.data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } }; message?: string };
    console.error('Login failed:', error.response?.data || error.message);
    throw err;
  }
}

export async function registerUser(userData: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  try {
    const res = await mainLink.post('/api/auth/register', userData);
    const { fetchProfile } = useUserStore.getState();
    await fetchProfile();
    return res.data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } }; message?: string };
    console.error('Registration failed:', error.response?.data || error.message);
    throw err;
  }
}

/**
 * Get top rated users (recommended workers)
 */
export async function getTopUsers(): Promise<TopUser[]> {
  const response = await mainLink.get('/api/users/top');
  return response.data;
}
