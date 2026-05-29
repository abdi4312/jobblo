import { useUserStore } from "../../../stores/userStore";
import {
  ChevronDown,
  Star,
  Settings,
  Plus,
  MapPin,
  GraduationCap,
  Pencil,
  ShieldCheck,
  Crown,
  MessageCircle,
  Mail,
  User as UserIcon,
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
              <Button
                onClick={() => navigate("/settings/banner")}
                icon={<Pencil size={16} />}
                className="font-bold cursor-pointer box-card-custom! rounded-lg! text-custom-black! md:hidden"
              />
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
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <h1 className="text-[32px] font-bold text-gray-900 leading-tight">
                  {fullName}
                </h1>
                <div className="flex gap-2">
                  {(user as any)?.isTrusted && (
                    <div
                      className="flex items-center gap-1 bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#2E7D32]/20 shadow-sm"
                      title="Trusted Provider"
                    >
                      <ShieldCheck size={14} />
                      TRUSTED
                    </div>
                  )}
                  {user?.subscription && user.subscription !== "Standard" && (
                    <div className="flex items-center gap-1 bg-[#FFF8E1] text-[#F57C00] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#F57C00]/20 shadow-sm">
                      <Crown size={14} />
                      {user.subscription.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

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
                  {/* <button className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-6 py-2 rounded-lg font-bold transition-all shadow-sm">
                    Send melding
                  </button> */}
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
          {/* <div className="max-w-300 mx-auto mt-6 pl-4 md:pl-0">
            <div className="flex flex-col gap-1">
              <p className="text-[15px] text-gray-800 leading-snug font-medium max-w-2xl">
                {user?.bio}
              </p>
            </div>
          </div> */}
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

      <div className="relative mb-5">
        <div className="flex flex-col md:flex-row items-end justify-between -mt-[52px]">
          {/* Left Section: Avatar and Info */}
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="w-[100px] h-[100px] rounded-full bg-[#c8d8c8] border-4 border-[#f5f0e8] overflow-hidden flex items-center justify-center text-[36px] font-medium text-[#1a3a1a]">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.name?.[0] || "U"
                )}
              </div>
              {user?.verified && (
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-custom-green rounded-full border-2 border-[#f5f0e8] flex items-center justify-center">
                  <ShieldCheck size={12} className="text-white" />
                </div>
              )}
            </div>

            <div className="pb-2.5">
              <div className="text-[12px] text-custom-green mb-0.5 font-medium">
                @{user?.name.toLowerCase().replace(/\s+/g, "") || "guest"}
              </div>
              <h1 className="text-[22px] font-medium text-custom-black mb-0.5 leading-tight">
                {fullName}
              </h1>
              <div className="text-[12px] text-black/40 flex items-center gap-1">
                <MapPin size={13} />
                <span>
                  {typeof user?.postSted === "object"
                    ? user.postSted.city
                    : user?.postSted || "Oslo"}
                  , Norge · Medlem siden{" "}
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("no-NO", {
                        month: "long",
                        year: "numeric",
                      })
                    : "desember 2019"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Section: Actions */}
          <div className="flex gap-2 pb-2.5">
            {isOwnProfile ? (
              <>
                <button
                  onClick={() => navigate("/settings/seeker")}
                  className="px-4.5 py-2.5 bg-transparent border border-black/20 rounded-full text-[13px] text-custom-black flex items-center gap-1.5 hover:bg-black/5 transition-colors"
                >
                  <Settings size={14} />
                  <span>Innstillinger</span>
                </button>
                <button
                  onClick={() => navigate("/settings")}
                  className="px-4.5 py-2.5 bg-custom-green text-white rounded-full text-[13px] flex items-center gap-1.5 hover:bg-[#25633a] transition-colors"
                >
                  <Pencil size={14} />
                  <span>Rediger profil</span>
                </button>
                <button
                  onClick={handlelogout}
                  className="px-4.5 py-2.5 bg-red-500 text-white rounded-full text-[13px] flex items-center gap-1.5 hover:bg-red-600 transition-colors"
                >
                  <span>Logg ut</span>
                </button>
              </>
            ) : (
              <button className="px-4.5 py-2.5 bg-custom-green text-white rounded-full text-[13px] flex items-center gap-1.5 hover:bg-[#25633a] transition-colors">
                <MessageCircle size={14} />
                <span>Send melding</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
        {[
          { label: "Fullførte oppdrag", val: user?.reviewCount || 0 },
          {
            label: "Snittrating",
            val: user?.averageRating?.toFixed(1) || "5.0",
          },
          {
            label: "Utlagte oppdrag",
            val: (user as any)?.postedJobsCount || 0,
          },
          { label: "Svarprosent", val: "100%" },
          {
            label: "Totalt tjent",
            val: `${(user as any)?.totalEarned || 0} kr`,
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white border border-black/5 rounded-[14px] p-3.5 text-center"
          >
            <strong className="block text-[20px] font-medium text-custom-green mb-0.5">
              {stat.val}
            </strong>
            <span className="text-[10px] text-black/40 uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="flex items-center gap-1.5 bg-white border border-black/5 rounded-full px-3 py-1.5 text-[12px] text-black/60">
          <ShieldCheck size={14} className="text-custom-green" /> SafePay-bruker
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-black/5 rounded-full px-3 py-1.5 text-[12px] text-black/60">
          <Mail size={14} className="text-custom-green" /> E-post verifisert
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-black/5 rounded-full px-3 py-1.5 text-[12px] text-black/60">
          <Star size={14} className="text-custom-green" /> Topprating (
          {user?.averageRating?.toFixed(1) || "5.0"})
        </span>
        {!user?.verified && (
          <span className="flex items-center gap-1.5 bg-white border border-black/5 rounded-full px-3 py-1.5 text-[12px] text-black/20">
            <UserIcon size={14} /> ID ikke verifisert
          </span>
        )}
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
