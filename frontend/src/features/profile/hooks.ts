import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  blockUser,
  getBlockedUsers,
  getTopUsers,
  getUserProfile,
  getUserReviews,
  addPortfolioItem,
  deletePortfolioItem,
  addPreviousProject,
  deletePreviousProject,
  addCertification,
  deleteCertification,
  addExperience,
  deleteExperience,
  searchAll,
  searchUsers,
  updateUser,
  getSafePayHistory,
} from './api';
import { useUserStore } from '../../stores/userStore';
import { toast } from 'react-hot-toast';

interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  const { fetchProfile } = useUserStore((state) => state);

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) => updateUser(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      fetchProfile();
      toast.success('Oppdatert!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Kunne ikke oppdatere';
      toast.error(message);
    },
  });
};

export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
};

export const useBlockUser = () => {
  const queryClient = useQueryClient();
  const { fetchProfile } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      fetchProfile();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Kunne ikke blokkere bruker');
    },
  });
};

export const useBlockedUsers = (page = 1, limit = 10) => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['blockedUsers', page, limit],
    queryFn: () => getBlockedUsers(page, limit),
    enabled: isAuthenticated,
  });
};

export const useSearchUsers = (query?: string) => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['searchUsers', query],
    queryFn: () => searchUsers(query),
    enabled: isAuthenticated && !!query && query.length >= 2,
  });
};

export const useTopUsers = () => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['topUsers'],
    queryFn: () => getTopUsers(),
    enabled: isAuthenticated,
  });
};

export const useUnifiedSearch = (query: string) => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['unifiedSearch', query],
    queryFn: () => searchAll(query),
    enabled: isAuthenticated && query.length >= 2,
  });
};

export const useInfiniteSearch = (query: string, type: string, limit: number = 10) => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useInfiniteQuery({
    queryKey: ['infiniteSearch', query, type, limit],
    queryFn: ({ pageParam = 1 }) => searchAll(query, type, pageParam, limit),
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: isAuthenticated && query.length >= 2 && !!type,
  });
};

export const useUserReviews = (userId: string | undefined, role?: string) => {
  return useQuery({
    queryKey: ['userReviews', userId, role],
    queryFn: () => getUserReviews(userId!, role),
    enabled: !!userId,
  });
};

export const useSafePayHistory = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['safePayHistory', userId],
    queryFn: () => getSafePayHistory(userId!),
    enabled: !!userId,
  });
};

export const useAddPortfolioItem = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (data: FormData) => addPortfolioItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Portfolio-element lagt til!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke legge til portfolio');
    },
  });
};

export const useDeletePortfolioItem = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (itemId: string) => deletePortfolioItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Portfolio-element slettet');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke slette element');
    },
  });
};

export const useAddPreviousProject = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (data: FormData) => addPreviousProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Prosjekt lagt til!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke legge til prosjekt');
    },
  });
};

export const useDeletePreviousProject = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (projectId: string) => deletePreviousProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Prosjekt slettet');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke slette prosjekt');
    },
  });
};

export const useAddCertification = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (data: FormData) => addCertification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Sertifisering lagt til!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke legge til sertifisering');
    },
  });
};

export const useDeleteCertification = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (certId: string) => deleteCertification(certId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Sertifisering slettet');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke slette');
    },
  });
};

export const useAddExperience = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (data: any) => addExperience(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Erfaring lagt til!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke legge til erfaring');
    },
  });
};

export const useDeleteExperience = () => {
  const queryClient = useQueryClient();
  const { fetchProfile, user } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (expId: string) => deleteExperience(expId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?._id] });
      fetchProfile();
      toast.success('Erfaring slettet');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke slette erfaring');
    },
  });
};
