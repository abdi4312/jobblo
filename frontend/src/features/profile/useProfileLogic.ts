import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { useUserProfile } from './hooks';
import { toast } from 'react-hot-toast';

export const useProfileLogic = () => {
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Om meg');
  const [profileType, setProfileType] = useState<'seeker' | 'poster'>('seeker');

  const { data: profileUser, isLoading } = useUserProfile(userId || currentUser?._id);

  const userToDisplay = profileUser || currentUser;
  const isOwnProfile = !userId || userId === currentUser?._id;

  // Set default profile type for companies
  useEffect(() => {
    if (userToDisplay?.role === 'company') {
      setProfileType('poster');
      // 'Om oss' carries the company's description, services, areas and contact details.
      // Landing on 'Aktive' meant a visitor's first view of a company was whatever jobs
      // happened to be open, with no way to reach who the company actually is.
      setActiveTab('Om oss');
    }
  }, [userToDisplay?.role]);

  const handleProfileTypeChange = (type: 'seeker' | 'poster') => {
    setProfileType(type);
    setActiveTab(type === 'seeker' ? 'Om meg' : 'Aktive');
  };

  // This is the logout the UI actually calls. It used to fire the raw store
  // action without awaiting it and without clearing the React Query cache, so on
  // a shared browser the previous user's profile and chats stayed rendered until
  // each query happened to refetch. It also reported success before the server
  // call had finished.
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      queryClient.clear();
      toast.success('Du er nå logget ut.');
      navigate('/');
    }
  };

  const isBlockedByMe =
    userId &&
    currentUser?.blockedUsers?.some(
      (id: any) => (typeof id === 'string' ? id : id._id)?.toString() === userId
    );

  return {
    userId,
    userToDisplay,
    isOwnProfile,
    isLoading,
    activeTab,
    setActiveTab,
    profileType,
    handleProfileTypeChange,
    handleLogout,
    isBlockedByMe,
    navigate,
  };
};
