import { Shield, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useState } from "react";
import { useBlockedUsers, useBlockUser } from "../../../features/profile/hooks";
import { Spinner } from "../../Ui/Spinner";
import { useNavigate } from "react-router-dom";
import type { User } from "../../../types/userTypes";

export const BlockedUsersView = () => {
  const [page, setPage] = useState(1);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [userToUnblock, setUserToUnblock] = useState<User | null>(null);
  const limit = 10;
  const { data, isLoading } = useBlockedUsers(page, limit);
  const blockMutation = useBlockUser();
  const navigate = useNavigate();

  const handleUnblockClick = (user: User) => {
    setUserToUnblock(user);
    setIsUnblockModalOpen(true);
  };

  const confirmUnblock = () => {
    if (userToUnblock?._id) {
      blockMutation.mutate(userToUnblock._id, {
        onSuccess: () => {
          setIsUnblockModalOpen(false);
          setUserToUnblock(null);
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner />
      </div>
    );
  }

  const blockedUsers = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 0;

  return (
    <section className="flex flex-col gap-10 max-w-2xl w-full">
      <div className="flex flex-col gap-2">
        <p className="text-[17px] text-[#555] leading-[1.4] font-normal">
          When you block someone, they won't be able to send you messages,
          follow you or like any of your ads, and you won't see any
          notifications from them.{" "}
          <span className="underline cursor-pointer text-black font-medium">
            Read more here.
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {blockedUsers.length > 0 ? (
          <>
            <div className="flex flex-col gap-6">
              {blockedUsers.map((user: User) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between group"
                >
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => navigate(`/profile/${user._id}`)}
                  >
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 border border-gray-50 shadow-sm">
                        <img
                          src={
                            user.avatarUrl ||
                            "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"
                          }
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Checkmark icon as seen in image */}
                      <div className="absolute bottom-0 right-0 bg-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white">
                        <Check
                          size={10}
                          className="text-white"
                          strokeWidth={4}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[18px] font-bold text-black leading-tight">
                        {user.name.toLowerCase().replace(/\s+/g, "")}
                      </span>
                      <span className="text-[16px] text-[#888] font-normal">
                        {user.name} {user.lastName}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblockClick(user)}
                    disabled={blockMutation.isPending}
                    className="text-[14px] font-bold text-[#FF6B6B] hover:underline px-2 py-1 disabled:opacity-50"
                  >
                    {blockMutation.isPending && userToUnblock?._id === user._id
                      ? "..."
                      : "Unblock"}
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10 border-t border-gray-50 pt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-full hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-[14px] font-bold text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-full hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
              <Shield size={32} className="text-gray-200" strokeWidth={1.5} />
            </div>
            <p className="text-gray-400 font-bold text-lg">
              You haven't blocked any users yet
            </p>
          </div>
        )}
      </div>

      {/* Unblock User Confirmation Modal */}
      {isUnblockModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]">
          <div
            className="absolute inset-0"
            onClick={() => setIsUnblockModalOpen(false)}
          />
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[420px] relative z-10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="p-10 flex flex-col items-center text-center">
              <div className="relative mb-8">
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-50 shadow-sm bg-gray-100">
                  <img
                    src={
                      userToUnblock?.avatarUrl ||
                      "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"
                    }
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <h3 className="text-[22px] font-bold text-gray-900 leading-tight mb-4 px-4">
                Are you sure you want to unblock this user?
              </h3>

              <p className="text-[14px] text-gray-500 font-medium leading-relaxed mb-10 px-2">
                This user will be able to see and contact you on Jobblo. (The
                user will not be notified)
              </p>

              <div className="grid grid-cols-2 w-full border-t border-gray-100 mt-2">
                <button
                  onClick={() => setIsUnblockModalOpen(false)}
                  className="py-5 text-[17px] font-bold text-black hover:bg-gray-50 transition-colors border-r border-gray-100"
                >
                  Cancel
                </button>
                <button
                  disabled={blockMutation.isPending}
                  onClick={confirmUnblock}
                  className="py-5 text-[17px] font-bold text-[#FF6B6B] hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  {blockMutation.isPending ? "..." : "Unblock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
