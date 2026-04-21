import { useNavigate } from "react-router-dom";
import type { Jobs } from "../../../types/Jobs.ts";
import { useUserStore } from "../../../stores/userStore.ts";
import { Bookmark, Heart, Zap, Pencil, Trash2, Truck } from "lucide-react";
import React, { useState } from "react";
import AddToListModal from "../../Explore/jobs/AddToListModal";
import { useFavoriteLists } from "../../../features/favoriteLists/hooks";
import { useToggleLike } from "../../../features/jobsList/hooks";
import { useServiceActions } from "../../../features/services/hooks";

interface JobCardProps {
  job: Jobs;
  isOwner?: boolean;
}

const categoryColorMap: Record<string, string> = {
  Rørlegger: "bg-[#2F7E47]",
  Renhold: "bg-[#2F7E47]",
  Maling: "bg-[#238CEB]",
  Hagearbeid: "bg-[#2F7E47]",
  Flytting: "bg-[#2F7E47]",
};

export const JobCard = ({ job, isOwner }: JobCardProps) => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const { data: lists = [], isLoading: listsLoading } = useFavoriteLists();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const toggleLike = useToggleLike();
  const { deleteMutation } = useServiceActions();

  const handleCardClick = () => {
    navigate(`/job-listing/${job._id}`);
  };

  const isLiked = job.likes?.includes(user?._id || "");
  const likesCount = job.likes?.length || 0;

  const isOwnJob =
    isOwner ||
    (user?._id &&
      (job.userId === user._id || (job.userId as any)?._id === user._id));

  // Sjekk om jobben er i NOEN av brukerens lister
  const isInAnyList = lists.some(
    (list: { services?: Array<{ _id?: string } | string> }) =>
      list.services?.some((s: { _id?: string } | string) =>
        typeof s === "string" ? s === job._id : s._id === job._id,
      ),
  );

  const handleFavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) {
      navigate("/login");
      return;
    }
    setIsModalOpen(true);
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) {
      navigate("/login");
      return;
    }
    toggleLike.mutate(job._id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/Publish-job/${job._id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Er du sikker på at du vil slette denne annonsen?")) {
      deleteMutation.mutate(job._id);
    }
  };

  const catName = Array.isArray(job.categories)
    ? job.categories[0]
    : job.categories;
  const badgeColor = categoryColorMap[catName] || "bg-[#2F7E47]";

  return (
    <div
      className="flex flex-col gap-1 w-full cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Bildeseksjon */}
      <div className="relative aspect-2/2 w-full bg-[#f6f6f6] rounded-xl overflow-hidden">
        {job.images && job.images[0] ? (
          <img
            src={job.images[0]}
            alt={job.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100 gap-2">
            <div className="w-12 h-12 bg-gray-200/50 rounded-full flex items-center justify-center">
              <Bookmark size={24} className="opacity-30" />
            </div>
            <span className="text-[12px] font-bold uppercase tracking-widest opacity-60">
              Ingen bilder
            </span>
          </div>
        )}

        {/* Liker-knapp (Øverst til høyre) */}
        {!isOwnJob && (
          <button
            title="Liker"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full transition-all z-20"
            onClick={handleLikeClick}
          >
            <Heart
              size={18}
              className={isLiked ? "fill-white text-white" : "text-white"}
            />
          </button>
        )}

        {/* Eier-handlinger (Nederst til høyre ved hover) */}
        {isOwnJob && (
          <div className="absolute bottom-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10">
            <button
              title="Rediger"
              className="w-10 h-10 flex items-center justify-center bg-white rounded-[14px] shadow-md hover:scale-105 active:scale-95 transition-all text-[#2F7E47]"
              onClick={handleEditClick}
            >
              <Pencil size={20} />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center bg-white rounded-[14px] shadow-md hover:scale-105 active:scale-95 transition-all text-[#FF4B4B]"
              onClick={handleDeleteClick}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <div className="animate-spin w-4 h-4 border-[1.5px] border-gray-300 border-t-[#FF4B4B] rounded-full" />
              ) : (
                <Trash2 size={20} />
              )}
            </button>
          </div>
        )}

        {/* Fremmet / Haster-merke (øverst til venstre) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {job.promoted && (
            <div className="bg-[#FF8A71] text-white px-2.5 py-1 rounded-full font-bold text-[10px] shadow-lg flex items-center gap-1 uppercase tracking-widest">
              <Zap size={10} fill="white" /> Fremmet
            </div>
          )}
          {job.urgent && (
            <div className="bg-[#FF4B4B] text-white px-2.5 py-1 rounded-full font-bold text-[10px] shadow-lg flex items-center gap-1 uppercase tracking-widest">
              <Zap size={10} fill="white" /> Haster
            </div>
          )}
        </div>

        {/* Favoritt-knapp (Nederst til høyre hvis ikke eier, kun ved hover kanskje? Nei, la oss holde det enkelt) */}
        {!isOwnJob && (
          <button
            className="absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white backdrop-blur-sm rounded-full shadow-sm transition-all opacity-0 group-hover:opacity-100 z-10"
            onClick={handleFavClick}
          >
            {listsLoading ? (
              <div className="animate-spin w-3 h-3 border-[1.5px] border-gray-300 border-t-[#2F7E47] rounded-full" />
            ) : (
              <Bookmark
                size={16}
                className={
                  isInAnyList
                    ? "fill-[#0A0A0A] text-[#0A0A0A]"
                    : "text-[#0A0A0A]"
                }
              />
            )}
          </button>
        )}
      </div>

      {/* Add To List Modal */}
      <AddToListModal
        job={job}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Info Section */}
      <div className="flex flex-col gap-0.5 mt-1 px-0.5">
        {/* Kategori/By (Liten tekst øverst) */}
        {/* <div className="text-[#6A6A6A] text-[13px] font-medium truncate">
          {catName || "Tjeneste"}
        </div> */}

        {/* Tittel */}
        <h2 className="text-[#0A0A0A] font-bold text-[15px] leading-tight line-clamp-2">
          {job.title}
        </h2>

        {/* Pris */}
        <div className="text-[#0A0A0A] font-bold text-[16px]">
          {job.price.toLocaleString()} kr
        </div>

        {/* Lokasjon */}
        <div className="text-[#6A6A6A] text-[13px] font-medium">
          {job.location?.city || "Norge"}
        </div>

        {/* Status Badge (som "Fix finished") */}
        {job.status === "closed" ? (
          <div className="mt-2 flex items-center gap-1.5 bg-[#FFF9E5] text-[#856404] px-2.5 py-1 rounded-md text-[11px] font-bold w-fit">
            <Truck size={14} /> Solgt / Fullført
          </div>
        ) : (
          /* Eventuelt andre tags hvis ønskelig, ellers bare luft */
          <div className="h-6" />
        )}
      </div>
    </div>
  );
};
