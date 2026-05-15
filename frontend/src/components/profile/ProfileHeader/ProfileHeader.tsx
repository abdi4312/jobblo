import { useUserStore } from "../../../stores/userStore";
import {
  ChevronDown,
  Star,
  Settings,
  Plus,
  MapPin,
  GraduationCap,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBlockUser } from "../../../features/profile/hooks";
import { toast } from "react-hot-toast";
import { BlockModal } from "./BlockModal";
import type { User } from "../../../types/userTypes";
import { Button } from "../../Ui/button/Button";

export function ProfileHeader({
  user,
  handlelogout,
  isOwnProfile = true,
  profileType = "seeker",
}: {
  user: User | null;
  handlelogout: () => void;
  isOwnProfile?: boolean;
  profileType?: "seeker" | "poster";
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);

  const navigate = useNavigate();
  const blockMutation = useBlockUser();
  const currentUser = useUserStore((state) => state.user);

  const isBlockedByMe = currentUser?.blockedUsers?.some(
    (id) => (typeof id === "string" ? id : id._id)?.toString() === user?._id,
  );

  const handleUnblock = () => {
    if (user?._id) {
      blockMutation.mutate(user._id, {
        onSuccess: () => {
          setIsUnblockModalOpen(false);
          toast.success(`Bruker opphevet blokkering`);
        },
      });
    }
  };

  const fullName =
    user?.role === "company"
      ? user?.companyName
      : `${user?.name} ${user?.lastName || ""}`.trim();

  // NEW UI FOR COMPANIES
  if (user?.role === "company") {
    return (
      <div className="box-card-custom rounded-none">
        {isBlockedByMe && (
          <div className="bg-[#FEF2F2] py-3 text-center border-b border-red-100 animate-in slide-in-from-top duration-300">
            <p className="text-[14px] font-medium text-gray-900">
              Du har blokkert denne brukeren.
            </p>
            <button
              onClick={() => setIsUnblockModalOpen(true)}
              disabled={blockMutation.isPending}
              className="text-[14px] font-bold text-[#FF6B6B] hover:underline mt-0.5 disabled:opacity-50"
            >
              {blockMutation.isPending ? "Opphever..." : "Opphev blokkering"}
            </button>
          </div>
        )}

        {/* Banner Section */}
        <div className="relative w-full h-48 sm:h-80 bg-gray-200 overflow-hidden group">
          <img
            src={
              user?.bannerUrl ||
              "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200"
            }
            alt="Banner"
            className="w-full h-full object-cover"
          />
          {isOwnProfile && (
            <div className="absolute bottom-4 right-4 sm:right-10 z-10000">
              <Button
                label="Edit banner"
                onClick={() => navigate("/settings/banner")}
                icon={<Pencil size={16} />}
                className="font-bold px-8 cursor-pointer box-card-custom! rounded-lg! hidden md:flex text-custom-black!"
              />
              <Button onClick={() => navigate("/settings/banner")}
                icon={<Pencil size={16} />}
                className="font-bold cursor-pointer box-card-custom! rounded-lg! text-custom-black! md:hidden"/>
            </div>
          )}
        </div>

        {/* Profile Content Wrapper */}
        <div className="max-w-312.5 mx-auto px-4 sm:px-10 pb-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-12 sm:-mt-16 relative z-10">
            {/* Avatar with Thought Bubble */}
            <div className="relative group">
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden border-[5px] border-white bg-white shadow-sm cursor-pointer relative">
                <img
                  src={
                    user?.avatarUrl ||
                    "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
                {isOwnProfile && (
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      title="Endre avatar"
                      onClick={() => navigate("/settings/picture")}
                      className="bg-white/80 p-2 rounded-full shadow-md"
                    >
                      <Pencil size={20} className="text-gray-700" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left mb-2">
              <h1 className="text-[32px] font-bold text-gray-900 leading-tight">
                {fullName}
              </h1>

              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex justify-center md:justify-start gap-6 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      {user?.reviewCount || 0}
                    </span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Fullførte
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      {user?.averageRating?.toFixed(1) || "5.0"}
                    </span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Rating
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={18} className="text-gray-900" />
                    <span className="font-semibold">
                      {user?.postSted || "Oslo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GraduationCap size={18} className="text-gray-900" />
                    <span className="font-semibold">
                      {`Org.nr: ${user?.orgNumber}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mb-2">
              {isOwnProfile ? (
                <>
                  <Button
                    label="Edit profile"
                    onClick={() => navigate("/settings")}
                    icon={<Pencil size={18} />}
                    className="rounded-lg font-bold px-8 cursor-pointer"
                  />

                  <div className="relative">
                    <button
                      title="Endre innstillinger"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="bg-[#E4E6EB] hover:bg-[#D8DADF] p-2 rounded-lg transition-all"
                    >
                      <ChevronDown size={20} />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute top-[calc(100%+8px)] right-0 bg-white border border-gray-100 rounded-xl shadow-xl py-2 min-w-50 z-50 animate-in fade-in slide-in-from-top-2">
                        <button
                          title="Endre innstillinger"
                          onClick={() => navigate("/settings/seeker")}
                          className="flex items-center w-full px-4 py-2 text-sm font-semibold hover:bg-gray-50 text-gray-700"
                        >
                          <Settings size={16} className="mr-2" /> Innstillinger
                        </button>
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                          onClick={handlelogout}
                          className="flex items-center w-full px-4 py-2 text-sm font-semibold hover:bg-gray-50 text-red-600"
                        >
                          Logg ut
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-6 py-2 rounded-lg font-bold transition-all shadow-sm">
                    Send melding
                  </button>
                  <button className="bg-[#E4E6EB] hover:bg-[#D8DADF] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all">
                    <Star size={18} />
                    {user?.averageRating?.toFixed(1) || "5.0"}
                  </button>
                  <button
                    title="Vis mer"
                    className="bg-[#E4E6EB] hover:bg-[#D8DADF] p-2 rounded-lg transition-all"
                  >
                    <ChevronDown size={20} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div className="max-w-300 mx-auto mt-6 pl-4 md:pl-0">
            <div className="flex flex-col gap-1">
              <p className="text-[15px] text-gray-800 leading-snug font-medium max-w-2xl">
                {user?.bio}
              </p>
            </div>
          </div>
        </div>

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
      </div>
    );
  }

  // ⭐ OLD UI FOR NORMAL USERS
  return (
    <>
      {isBlockedByMe && (
        <div className="bg-[#FEF2F2] py-3 text-center border-b border-red-100 animate-in slide-in-from-top duration-300">
          <p className="text-[14px] font-medium text-gray-900">
            Du har blokkert denne brukeren.
          </p>
          <button
            onClick={() => setIsUnblockModalOpen(true)}
            disabled={blockMutation.isPending}
            className="text-[14px] font-bold text-[#FF6B6B] hover:underline mt-0.5 disabled:opacity-50"
          >
            {blockMutation.isPending ? "Opphever..." : "Opphev blokkering"}
          </button>
        </div>
      )}

      <div className="bg-[#F6F1E8] px-4 sm:px-18 pt-8 pb-10">
        <div className="max-w-300 mx-auto flex flex-col items-center sm:items-start sm:flex-row gap-8 sm:gap-10 relative">
          {/* Profile Picture Column */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <div
                className={`w-32 h-32 sm:w-42 sm:h-42 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md`}
              >
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
                    Rediger bilde
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* User Info & Actions Column */}
          <div className="flex flex-col items-center sm:items-start flex-1 sm:pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
              <h2 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-none">
                @{user?.name.toLowerCase().replace(/\s+/g, "") || "guest"}
              </h2>
              {user?.verified && (
                <span className="flex items-center gap-1 bg-custom-green text-white text-[10px] font-bold px-2 py-1 rounded-full w-fit">
                  Verifisert
                </span>
              )}
            </div>

            <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wide mb-5">
              Ble en Jobblo i{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleString("no-NO", {
                    month: "long",
                    year: "numeric",
                  })
                : "desember 2019"}
            </p>

            {/* Stats Row */}
            <div className="flex gap-6 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  {user?.reviewCount || 0}
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Fullførte
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  {user?.averageRating?.toFixed(1) || "5.0"}
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Rating
                </span>
              </div>
            </div>

            <div className="relative flex gap-3">
              {isOwnProfile ? (
                <>
                  <button
                    className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl
                   text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all shadow-sm"
                    onClick={() => navigate("/settings/seeker")}
                  >
                    <Settings size={18} className="text-gray-800" />
                    <span>Jobbsøkerinnstillinger</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className={`flex items-center gap-2 bg-white px-6 py-2.5 rounded-xl text-[15px] font-bold text-gray-900 hover:bg-gray-50 transition-all ${isMenuOpen ? "bg-gray-50" : ""}`}
                    >
                      <span>Mer</span>
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
                            Innstillinger
                          </button>
                          <div className="h-px bg-gray-100 my-1" />
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              handlelogout();
                            }}
                            className="flex items-center w-full text-lg font-medium text-[#EA1717] hover:text-red-700 transition-colors"
                          >
                            Log ut av Jobblo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                      <span>Mer</span>
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
                            {isBlockedByMe
                              ? "Fjern blokkering"
                              : "Blokker bruker"}
                          </button>
                          <div className="h-px bg-gray-100 my-0.5" />
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              toast("Report user feature coming soon");
                            }}
                            className="flex items-center w-full text-[16px] font-medium text-black hover:text-gray-600 transition-colors py-1"
                          >
                            Rapport bruker
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
    </>
  );
}
