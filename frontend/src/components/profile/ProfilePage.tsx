import { ProfileHeader } from "./ProfileHeader/ProfileHeader";
import { ItemsGrid } from "./ProfileHeader/ItemsGrid";
import { ProfileNav } from "./ProfileHeader/ProfileNav";
import { useUserStore } from "../../stores/userStore";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { App } from 'antd';
import { useState } from 'react';
import { useUserProfile } from "../../features/profile/hooks";
import { Spinner } from "../Ui/Spinner";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const [activeTab, setActiveTab] = useState(userId ? 'Jobs' : 'Likes');
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);

  // Fetch profile if userId is provided, otherwise use current user
  const { data: profileUser, isLoading } = useUserProfile(userId);

  // Determine which user to display
  const userToDisplay = userId ? profileUser : currentUser;

  const handleLogout = () => {
    modal.confirm({
      title: 'Er du sikker?',
      content: 'Vil du virkelig logge ut?',
      okText: 'Ja, logg ut',
      cancelText: 'Avbryt',
      onOk() {
        logout();
        toast.success("Du har blitt logget ut");
        navigate("/");
      },
    });
  };

  const handleUnblockSuccess = () => {
    setIsUnblockModalOpen(false);
    toast.success("User unblocked");
  };

  if (userId && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!userToDisplay) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h2 className="text-2xl font-bold">Bruker ikke funnet</h2>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white px-6 py-2 rounded-xl"
        >
          Gå hjem
        </button>
      </div>
    );
  }

  const isBlockedByMe = userId && currentUser?.blockedUsers?.some((id: any) =>
    (typeof id === 'string' ? id : id._id)?.toString() === userId
  );

  return (
    <>
      <div className="">
        <div className="bg-white border-b border-gray-100">
          <ProfileHeader
            user={userToDisplay}
            handlelogout={handleLogout}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isOwnProfile={!userId || userId === currentUser?._id}
          />
        </div>

        {isBlockedByMe ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-[#f5f5f5] min-h-[500px]">
            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm flex flex-col items-center text-center max-w-lg w-full">
              <div className="w-48 h-48 mb-8">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/c9959e70-6523-455a-9336-7936a798935c?apiKey=6d79042c16134a66804866657663e622&"
                  alt="Blocked user"
                  className="w-full h-full object-contain opacity-80"
                />
              </div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">You have blocked this user</h3>
              <p className="text-[16px] text-gray-500 font-medium leading-relaxed">
                To see this users ads, you need to{" "}
                <button
                  onClick={() => setIsUnblockModalOpen(true)}
                  className="text-black font-bold underline hover:text-gray-700 transition-colors"
                >
                  unblock them
                </button>
              </p>
            </div>
          </div>
        ) : (
          <>
            <ProfileNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isOwnProfile={!userId || userId === currentUser?._id}
            />
            <ItemsGrid activeTab={activeTab} userId={userId || currentUser?._id} />
          </>
        )}
      </div>

      {/* Reusable Unblock Modal if needed here or just use the one in ProfileHeader */}
    </>
  );
}
