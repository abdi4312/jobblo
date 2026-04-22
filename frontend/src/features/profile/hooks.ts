import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  blockUser,
  getBlockedUsers,
  getTopUsers,
  getUserProfile,
  searchAll,
  searchUsers,
  updateUser,
} from "./api";
import { useUserStore } from "../../stores/userStore";
import { toast } from "react-hot-toast";

interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
}

export const useUpdateUser = () => {
  const { fetchProfile } = useUserStore((state) => state);

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserData }) =>
      updateUser(userId, data),
    onSuccess: () => {
      fetchProfile();
      toast.success("Oppdatert!");
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error(err.message || "Kunne ikke oppdatere");
    },
  });
};

export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["userProfile", userId],
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
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
      fetchProfile();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Kunne ikke blokkere bruker");
    },
  });
};

export const useBlockedUsers = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ["blockedUsers", page, limit],
    queryFn: () => getBlockedUsers(page, limit),
  });
};

export const useSearchUsers = (query?: string) => {
  return useQuery({
    queryKey: ["searchUsers", query],
    queryFn: () => searchUsers(query),
    enabled: !!query && query.length >= 2,
  });
};

export const useTopUsers = () => {
  return useQuery({
    queryKey: ["topUsers"],
    queryFn: () => getTopUsers(),
  });
};

export const useUnifiedSearch = (query: string) => {
  return useQuery({
    queryKey: ["unifiedSearch", query],
    queryFn: () => searchAll(query),
    enabled: query.length >= 2,
  });
};

export const useInfiniteSearch = (
  query: string,
  type: string,
  limit: number = 10,
) => {
  return useInfiniteQuery({
    queryKey: ["infiniteSearch", query, type, limit],
    queryFn: ({ pageParam = 1 }) => searchAll(query, type, pageParam, limit),
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: query.length >= 2 && !!type,
  });
};
