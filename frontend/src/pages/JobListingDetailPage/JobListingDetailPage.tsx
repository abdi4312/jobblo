import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useUserStore } from "../../stores/userStore";
import {
  useJobDetailQuery,
  useSendMessageMutation,
  useStripeMutation,
} from "../../features/jobDetail/hook.ts";

import JobButton from "../../components/job/JobButton.tsx";
import { JobDetailSkeleton } from "../../components/Loading/JobDetailSkeleton.tsx";
import { useFavoriteToggle } from "../../features/favorites/hook/useFavoriteToggle.ts";
import { useToggleLike } from "../../features/jobsList/hooks";
import { MapComponent } from "../../components/component/map/MapComponent";
import { Heart, Share2, MapPin, Star, Bookmark, Zap } from "lucide-react";
import { useState } from "react";

const JobListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const sendMessageMutation = useSendMessageMutation();
  const stripeMutation = useStripeMutation();

  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);

  const {
    isFavorited,
    handleFavoriteClick,
    isLoading: favLoading,
  } = useFavoriteToggle(id!, isAuth);
  const { data: job, isLoading: isJobLoading } = useJobDetailQuery(id!);
  const isOwnJob = job?.userId?._id === currentUser?._id;
  const toggleLike = useToggleLike();

  const isLiked = job?.likes?.includes(currentUser?._id || "");
  const likesCount = job?.likes?.length || 0;

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) {
      navigate("/login");
      return;
    }
    toggleLike.mutate(id!);
  };

  const [lng, lat] = job?.location?.coordinates || [0, 0];
  const hasCoordinates = job?.location?.coordinates && (lng !== 0 || lat !== 0);

  const handleSendMessage = async (providerId: string) => {
    if (!isAuth) {
      toast.error("Please login to send message");
      navigate("/login");
      return;
    }
    if (!job?._id) return;

    sendMessageMutation.mutate(
      { providerId, serviceId: job._id },
      {
        onSuccess: (data) => {
          navigate(`/messages/${data._id}`);
        },
        onError: async (err: unknown) => {
          const error = err as {
            response?: {
              status?: number;
              data?: {
                paymentRequired?: boolean;
                amount?: number;
                message?: string;
              };
            };
          };
          const status = error.response?.status;
          const data = error.response?.data;

          if (status === 402 && data?.paymentRequired) {
            try {
              const paymentSession = await stripeMutation.mutateAsync({
                amount: data.amount || 0,
                providerId,
                serviceId: job._id,
              });
              window.location.href = paymentSession.url;
            } catch {
              toast.error("Could not start payment");
            }
            return;
          }
          toast.error(data?.message || "Could not create conversation");
        },
      },
    );
  };

  const isMessageLoading =
    sendMessageMutation.isPending || stripeMutation.isPending;

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Loading State
  if (isJobLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <JobDetailSkeleton />
        </div>
      </div>
    );
  }

  // Not Found State
  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Job Not Found
          </h2>
          <p className="text-gray-600">
            The job you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Main Content */}
      <div className="max-w-300 mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left - Image */}
          <div className="relative lg:sticky lg:top-20 lg:h-fit">
            <div className="rounded-xl overflow-hidden shadow-sm max-h-125">
              {job.images && job.images.length > 0 ? (
                <img
                  src={job.images[selectedImageIndex]}
                  alt={job.title}
                  className="w-full max-h-125 h-full object-contain"
                />
              ) : (
                <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No image</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="absolute top-4 right-4 flex flex-col gap-3 z-10">
                {/* Like Button */}
                <button
                  onClick={handleLikeClick}
                  disabled={toggleLike.isPending}
                  className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                  title={isLiked ? "Unlike" : "Like"}
                >
                  <Heart
                    size={20}
                    fill={isLiked ? "#FF4B4B" : "none"}
                    color={isLiked ? "#FF4B4B" : "#6b7280"}
                  />
                </button>
              </div>

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {job.promoted && (
                  <div className="bg-[#FF8A71] text-white px-4 py-2 rounded-full font-bold text-[12px] shadow-lg flex items-center gap-1.5 uppercase tracking-widest">
                    <Zap size={14} fill="white" /> Promoted
                  </div>
                )}
                {job.urgent && (
                  <div className="bg-[#FF4B4B] text-white px-4 py-2 rounded-full font-bold text-[12px] shadow-lg flex items-center gap-1.5 uppercase tracking-widest">
                    <Zap size={14} fill="white" /> Haster
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {job.images && job.images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {job.images.slice(0, 4).map((img: string, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-all ${idx === selectedImageIndex ? "ring-2 ring-blue-500 opacity-100" : "opacity-70 hover:opacity-100"}`}
                  >
                    <img
                      src={img}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right - Details */}
          <div className="space-y-6">
            {/* Title & Price */}
            <div>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {job.title || "Untitled Job"}
                  </h1>
                  <div className="flex items-center gap-3 mb-2">
                    {likesCount > 0 && (
                      <div className="flex items-center gap-1.5 text-sm font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        <Heart size={14} fill="#FF4B4B" color="#FF4B4B" />
                        <span>{likesCount} likes</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-600 shrink-0">
                  {job.price ? job.price.toLocaleString() : "0"} kr
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Duration: {job.duration?.value || "-"}{" "}
                {job.duration?.unit || ""}
              </p>
            </div>

            {/* Contact Button */}
            {job._id && (
              <JobButton
                handleSendMessage={() =>
                  job.userId?._id && handleSendMessage(job.userId._id)
                }
                id={job._id}
                job={job}
                isOwnJob={isOwnJob}
                isMsgLoading={isMessageLoading}
              />
            )}

            {/* Description */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {job.description || "No description available"}
              </p>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium">
                    {job.categories?.[0] || "General"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium flex items-center gap-1">
                    <MapPin size={14} /> {job.location?.city || "Not specified"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Posted</span>
                  <span className="font-medium">
                    {job.createdAt ? formatDate(job.createdAt) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Experience</span>
                  <span className="font-medium">
                    {job.experience || "Not specified"}
                  </span>
                </div>
              </div>
            </div>

            {/* Map */}
            {hasCoordinates && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">
                  Location Map
                </h2>
                <div className="h-48 rounded-lg overflow-hidden bg-gray-100">
                  <MapComponent
                    coordinates={job.location.coordinates}
                    circleRadius={800}
                  />
                </div>
              </div>
            )}

            {/* Seller Info */}
            <div
              className="bg-white rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() =>
                job.userId?._id && navigate(`/profile/${job.userId._id}`)
              }
            >
              <div className="flex items-center gap-3">
                {job.userId?.avatarUrl ? (
                  <img
                    src={job.userId.avatarUrl}
                    alt={job.userId.name}
                    className="w-14 h-14 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {job.userId?.name?.charAt(0) || "?"}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {job.userId?.name || "Unknown Seller"}
                    </p>
                    <span className="px-2 py-0.5 bg-gray-700 text-white text-xs rounded-full">
                      Not Verified
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-sm text-yellow-500">
                      <Star size={14} fill="currentColor" />
                      <span>{job.userId?.averageRating || "0"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>12 fullforte</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                <Share2 size={16} /> Share
              </button>
              <button className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobListingDetailPage;
