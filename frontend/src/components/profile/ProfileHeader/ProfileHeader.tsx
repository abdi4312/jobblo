import { useUserStore } from "../../../stores/userStore";
import { ChevronDown, Store, Star } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBlockUser, useFollowUser } from "../../../features/profile/hooks";
import { toast } from "react-hot-toast";
import { FollowingModal } from "./FollowingModal";
import { BlockModal } from "./BlockModal";
import { FollowersFollowingModal } from "./FollowersFollowingModal";
import type { User } from "../../../types/userTypes";

export function ProfileHeader({
  user,
  handlelogout,
  isOwnProfile = true,
}: {
  user: User | null;
  handlelogout: () => void;
  isOwnProfile?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFollowingModalOpen, setIsFollowingModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [isFollowersFollowingModalOpen, setIsFollowersFollowingModalOpen] =
    useState(false);
  const [modalTitle, setModalTitle] = useState<"Followers" | "Following">(
    "Followers",
  );

  const navigate = useNavigate();
  const followMutation = useFollowUser();
  const blockMutation = useBlockUser();
  const currentUser = useUserStore((state) => state.user);
  const isAuth = useUserStore((state) => state.isAuthenticated);

  const isBlockedByMe = currentUser?.blockedUsers?.some(
    (id) => (typeof id === "string" ? id : id._id)?.toString() === user?._id,
  );

  const followersArray = (user?.followers || []) as (string | User)[];
  const isFollowing =
    user?._id &&
    currentUser?._id &&
    followersArray.some(
      (f) => (typeof f === "string" ? f : f._id) === currentUser._id,
    );

  const handleFollowClick = () => {
    if (!isAuth) {
      toast.error("Du må logge inn for å følge brukere");
      navigate("/login");
      return;
    }
    if (isFollowing) {
      setIsFollowingModalOpen(true);
      return;
    }
    if (user?._id) {
      followMutation.mutate(user._id);
    }
  };

  const handleUnfollow = () => {
    if (user?._id) {
      followMutation.mutate(user._id, {
        onSuccess: () => {
          setIsFollowingModalOpen(false);
          toast.success(`Unfollowed ${user.name}`);
        },
      });
    }
  };

  const handleUnblock = () => {
    if (user?._id) {
      blockMutation.mutate(user._id, {
        onSuccess: () => {
          setIsUnblockModalOpen(false);
          toast.success(`User unblocked`);
        },
      });
    }
  };

  return (
    <>
      {isBlockedByMe && (
        <div className="bg-[#FEF2F2] py-3 text-center border-b border-red-100 animate-in slide-in-from-top duration-300">
          <p className="text-[14px] font-medium text-gray-900">
            You have blocked this user.
          </p>
          <button
            onClick={() => setIsUnblockModalOpen(true)}
            disabled={blockMutation.isPending}
            className="text-[14px] font-bold text-[#FF6B6B] hover:underline mt-0.5 disabled:opacity-50"
          >
            {blockMutation.isPending ? "Unblocking..." : "Unblock"}
          </button>
        </div>
      )}

      <div className="bg-white px-4 sm:px-18 pt-8 pb-10">
        <div className="max-w-300 mx-auto flex flex-col items-center sm:items-start sm:flex-row gap-8 sm:gap-10 relative">
          {/* Profile Picture Column */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <div className="w-32 h-32 sm:w-42 sm:h-42 rounded-full overflow-hidden bg-gray-100 border border-gray-100 shadow-inner">
                <img
                  src={
                    user?.avatarUrl ||
                    "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"
                  }
                  alt="Profile"
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
              </div>
              {isOwnProfile && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none sm:pointer-events-auto">
                  <button
                    onClick={() => navigate("/settings/picture")}
                    className="bg-white/90 backdrop-blur-sm border border-gray-200 px-4 py-1.5 rounded-full text-sm font-bold text-gray-800 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-white"
                  >
                    Edit photo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* User Info & Actions Column */}
          <div className="flex flex-col items-center sm:items-start flex-1 sm:pt-1">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-none mb-3">
              @{user?.name.toLowerCase().replace(/\s+/g, "") || "guest"}
            </h2>

            <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wide mb-5">
              Became a Jobblo in{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : "December 2019"}
            </p>

            <div className="flex gap-4 mb-5">
              <div
                className="cursor-pointer hover:underline text-[16px]"
                onClick={() => {
                  setModalTitle("Followers");
                  setIsFollowersFollowingModalOpen(true);
                }}
              >
                <span className="font-bold text-black">
                  {user?.followers?.length || 0}
                </span>{" "}
                <span className="text-gray-900 font-medium text-[16px]">
                  followers
                </span>
              </div>
              <div
                className="cursor-pointer hover:underline text-[16px]"
                onClick={() => {
                  setModalTitle("Following");
                  setIsFollowersFollowingModalOpen(true);
                }}
              >
                <span className="font-bold text-black">
                  {user?.following?.length || 0}
                </span>{" "}
                <span className="text-gray-900 font-medium text-[16px]">
                  following
                </span>
              </div>
            </div>

            <div className="relative flex gap-3">
              {isOwnProfile ? (
                <>
                  <button
                    className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl
                   text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm"
                    onClick={() => navigate("/coins")}
                  >
                    <Store size={18} className="text-gray-800" />
                    <span>Jobblo Shop</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className={`flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm ${isMenuOpen ? "bg-gray-50" : ""}`}
                    >
                      <span>More</span>
                      <ChevronDown
                        size={18}
                        className={`transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute top-[calc(100%+12px)] right-0 bg-white border border-gray-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] py-4 px-5 min-w-[260px] z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => navigate("/settings")}
                            className="flex items-center w-full text-lg font-medium text-black hover:text-gray-600 transition-colors"
                          >
                            Settings
                          </button>
                          <div className="h-[1px] bg-gray-100 my-1" />
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              handlelogout();
                            }}
                            className="flex items-center w-full text-lg font-medium text-[#EA1717] hover:text-red-700 transition-colors"
                          >
                            Log out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={handleFollowClick}
                    disabled={followMutation.isPending || isBlockedByMe}
                    className={`flex items-center gap-2 ${isFollowing ? "bg-white border-2 border-gray-200 text-black" : "bg-[#FF6B6B] text-white"} px-8 py-2.5 rounded-xl text-[15px] font-bold hover:opacity-90 transition-all shadow-sm ${isBlockedByMe ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {followMutation.isPending ? (
                      "..."
                    ) : isFollowing ? (
                      <>
                        <span>Following</span>
                        <ChevronDown size={18} />
                      </>
                    ) : (
                      "Follow"
                    )}
                  </button>
                  <button
                    disabled={isBlockedByMe}
                    className={`flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm ${isBlockedByMe ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <Star size={18} className="text-gray-800" />
                    <span>
                      {user?.averageRating || "5.0"} ({user?.reviewCount || "0"}
                      )
                    </span>
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className={`flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm ${isMenuOpen ? "bg-gray-50" : ""}`}
                    >
                      <span>More</span>
                      <ChevronDown
                        size={18}
                        className={`transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute top-[calc(100%+12px)] right-0 bg-white border border-gray-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] py-4 px-5 min-w-[200px] z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              if (isBlockedByMe) {
                                handleUnblock();
                              } else {
                                setIsBlockModalOpen(true);
                              }
                            }}
                            className="flex items-center w-full text-[16px] font-medium text-black hover:text-gray-600 transition-colors py-1"
                          >
                            {isBlockedByMe ? "Unblock user" : "Block user"}
                          </button>
                          <div className="h-[1px] bg-gray-100 my-0.5" />
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              toast("Report user feature coming soon");
                            }}
                            className="flex items-center w-full text-[16px] font-medium text-black hover:text-gray-600 transition-colors py-1"
                          >
                            Report user
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="max-w-300 mx-auto mt-6 pl-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] font-bold text-gray-900 leading-tight">
              {user?.name || "Bruker Name"}
            </h1>
            <p className="text-[15px] text-gray-800 leading-snug font-medium max-w-2xl">
              {user?.bio}
            </p>
          </div>
        </div>
      </div>

      <FollowingModal
        user={user}
        isOpen={isFollowingModalOpen}
        onClose={() => setIsFollowingModalOpen(false)}
        isNotifyEnabled={isNotifyEnabled}
        onToggleNotify={() => setIsNotifyEnabled(!isNotifyEnabled)}
        onUnfollow={handleUnfollow}
        isPending={followMutation.isPending}
      />

      <BlockModal
        user={user}
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={() => {
          if (user?._id) {
            blockMutation.mutate(user._id, {
              onSuccess: (data) => {
                setIsBlockModalOpen(false);
                toast.success(data.message || `${user?.name} blocked`);
              },
            });
          }
        }}
        isPending={blockMutation.isPending}
        type="block"
      />

      <BlockModal
        user={user}
        isOpen={isUnblockModalOpen}
        onClose={() => setIsUnblockModalOpen(false)}
        onConfirm={handleUnblock}
        isPending={blockMutation.isPending}
        type="unblock"
      />

      <FollowersFollowingModal
        isOpen={isFollowersFollowingModalOpen}
        onClose={() => setIsFollowersFollowingModalOpen(false)}
        title={modalTitle}
        users={
          modalTitle === "Followers"
            ? user?.followers || []
            : user?.following || []
        }
        currentUserFollowing={currentUser?.following || []}
        onFollowAction={(targetId) => {
          if (!isAuth) {
            toast.error("Du må logge inn for å følge brukere");
            navigate("/login");
            return;
          }
          followMutation.mutate(targetId);
        }}
      />
    </>
  );
}
