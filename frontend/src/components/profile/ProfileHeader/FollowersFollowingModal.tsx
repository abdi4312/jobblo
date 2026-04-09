import { X, CheckCircle } from "lucide-react";
import type { User } from "../../../types/userTypes";
import { useNavigate } from "react-router-dom";

interface FollowersFollowingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: (string | User)[];
  currentUserFollowing: (string | User)[];
  onFollowAction: (userId: string) => void;
}

export function FollowersFollowingModal({
  isOpen,
  onClose,
  title,
  users,
  currentUserFollowing,
  onFollowAction,
}: FollowersFollowingModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isUserFollowing = (userId: string) => {
    return currentUserFollowing.some(
      (f) => (typeof f === "string" ? f : f._id) === userId,
    );
  };

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="bg-white rounded-4xl shadow-2xl w-full max-w-130 relative z-10 overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[80vh] min-h-[60vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="w-10" /> {/* Spacer for centering */}
          <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {users.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 font-medium">
                No {title.toLowerCase()} yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((item) => {
                if (typeof item === "string") return null;
                const u = item as User;
                const handle = u.name.toLowerCase().replace(/\s+/g, "");
                const isFollowing = isUserFollowing(u._id);

                return (
                  <div
                    key={u._id}
                    className="flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-gray-50 transition-colors group"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => {
                        navigate(`/profile/${u._id}`);
                        onClose();
                      }}
                    >
                      <div className="relative">
                        <img
                          src={
                            u.avatarUrl ||
                            "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                          }
                          alt={u.name}
                          className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm"
                        />
                        {u.verified && (
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                            <CheckCircle
                              size={14}
                              className="text-black"
                              fill="white"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h4 className="text-[15px] font-bold text-gray-900 leading-tight truncate">
                          {handle}
                        </h4>
                        <p className="text-[13px] text-gray-500 font-medium truncate">
                          {u.name} {u.lastName || ""}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFollowAction(u._id);
                      }}
                      className={`px-6 py-2 rounded-lg text-[14px] font-bold transition-all active:scale-[0.95] border ${
                        isFollowing
                          ? "border-gray-300 text-gray-900 bg-white hover:bg-gray-50"
                          : "border-black bg-black text-white hover:bg-gray-800"
                      }`}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
