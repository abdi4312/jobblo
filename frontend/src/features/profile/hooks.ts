import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blockUser, followUser, getBlockedUsers, getUserProfile, updateUser } from "./api";
import { useUserStore } from "../../stores/userStore";
import { toast } from "react-hot-toast";

export const useUpdateUser = () => {
  const { fetchProfile } = useUserStore((state) => state);

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) => 
      updateUser(userId, data),
    onSuccess: () => {
      fetchProfile();
      toast.success('Oppdatert!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunne ikke oppdatere');
    }
  });
};

export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();
  const { fetchProfile } = useUserStore((state) => state);

  return useMutation({
    mutationFn: (userId: string) => followUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      fetchProfile();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Kunne ikke følge bruker');
    }
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
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Kunne ikke blokkere bruker');
    }
  });
};

export const useBlockedUsers = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['blockedUsers', page, limit],
    queryFn: () => getBlockedUsers(page, limit),
  });
};