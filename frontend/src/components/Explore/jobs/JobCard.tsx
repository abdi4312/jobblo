import { useNavigate } from "react-router-dom";
import type { Jobs } from "../../../types/Jobs.ts";
import { useUserStore } from "../../../stores/userStore.ts";
import { Bookmark, Heart, Zap } from "lucide-react";
import React, { useState } from "react";
import AddToListModal from "./AddToListModal.tsx";
import { useFavoriteLists } from "../../../features/favoriteLists/hooks";
import { useToggleLike } from "../../../features/jobsList/hooks";

interface JobCardProps {
  job: Jobs;
}

const categoryColorMap: Record<string, string> = {
  Rørlegger: "bg-[#EF7909]",
  Renhold: "bg-[#2F7E47]",
  Maling: "bg-[#238CEB]",
  Hagearbeid: "bg-[#EF7909]",
  Flytting: "bg-[#2F7E47]",
};

export const JobCard = ({ job }: JobCardProps) => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const { data: lists = [], isLoading: listsLoading } = useFavoriteLists();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const toggleLike = useToggleLike();

  const handleCardClick = () => {
    navigate(`/job-listing/${job._id}`);
  };

  const isLiked = job.likes?.includes(user?._id || "");
  const likesCount = job.likes?.length || 0;

  // Check if job is in ANY of the user's lists
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

  const catName = Array.isArray(job.categories)
    ? job.categories[0]
    : job.categories;
  const badgeColor = categoryColorMap[catName] || "bg-[#EF7909]";

  return (
    <div
      className="flex flex-col gap-2 w-full cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Image Section */}
      <div className="relative aspect-4/5 w-full bg-[#f6f6f6] rounded-[20px] overflow-hidden">
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
              No image
            </span>
          </div>
        )}

        {/* Action Buttons Container (Bottom Right on Hover) */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10">
          {/* Like Button */}
          <button
            className="w-10 h-10 flex items-center justify-center bg-white rounded-[14px] shadow-md hover:scale-105 active:scale-95 transition-all"
            onClick={handleLikeClick}
          >
            <Heart
              size={20}
              className={
                isLiked ? "fill-[#FF4B4B] text-[#FF4B4B]" : "text-[#0A0A0A]"
              }
            />
          </button>

          {/* Favorite Button */}
          <button
            className="w-10 h-10 flex items-center justify-center bg-white rounded-[14px] shadow-md hover:scale-105 active:scale-95 transition-all"
            onClick={handleFavClick}
          >
            {listsLoading ? (
              <div className="animate-spin w-4 h-4 border-[1.5px] border-gray-300 border-t-[#2F7E47] rounded-full" />
            ) : (
              <Bookmark
                size={20}
                className={
                  isInAnyList
                    ? "fill-[#0A0A0A] text-[#0A0A0A]"
                    : "text-[#0A0A0A]"
                }
              />
            )}
          </button>
        </div>

        {/* Promoted / Urgent Badge (Top Left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {job.promoted && (
            <div className="bg-[#FF8A71] text-white px-3 py-1.5 rounded-full font-bold text-[11px] shadow-lg flex items-center gap-1 uppercase tracking-widest">
              <Zap size={12} fill="white" /> Promoted
            </div>
          )}
          {job.urgent && (
            <div className="bg-[#FF4B4B] text-white px-3 py-1.5 rounded-full font-bold text-[11px] shadow-lg flex items-center gap-1 uppercase tracking-widest">
              <Zap size={12} fill="white" /> Haster
            </div>
          )}
        </div>

        {/* Category Badge (Bottom Left) */}
        {catName && (
          <div
            className={`absolute bottom-3 left-3 ${badgeColor} text-white px-3 py-1.5 rounded-full font-bold text-[12px] shadow-xs tracking-wide`}
          >
            {catName}
          </div>
        )}

        {/* Sold Ribbon (Top Right) */}
        {job.status === "closed" && (
          <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 pointer-events-none">
            <div className="bg-[#FF8A71] text-white font-black text-[12px] py-1.5 w-[140%] text-center rotate-45 translate-x-[20%] translate-y-[25%] shadow-md uppercase tracking-widest">
              Sold
            </div>
          </div>
        )}
      </div>

      {/* Add To List Modal */}
      <AddToListModal
        job={job}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Info Section */}
      <div className="flex flex-col gap-0.5 mt-1 px-1">
        <div className="flex justify-between items-start gap-2">
          <h2 className="text-[#0A0A0A] font-bold text-[15px] leading-tight truncate flex-1">
            {job.title}
          </h2>
          {likesCount > 0 && (
            <div className="flex items-center gap-1 text-[#6A6A6A] text-[12px] font-bold">
              <Heart size={12} fill="#6A6A6A" /> {likesCount}
            </div>
          )}
        </div>
        <div className="text-[#6A6A6A] text-[14px] font-medium flex items-center justify-start max-w-full">
          {job.location?.city && (
            <span className="truncate flex-1 min-w-0 mr-1 text-left">
              {job.location.city}
            </span>
          )}
          {job.location?.city && <span className="flex-none mr-1">·</span>}
          <span className="flex-none whitespace-nowrap">NOK {job.price}</span>
        </div>
      </div>
    </div>
  );
};
