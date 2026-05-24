import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useUserStore } from "../../stores/userStore";
import {
  useJobDetailQuery,
  useSendMessageMutation,
  useStripeMutation,
  useCreateJobRequestMutation,
  useMyJobRequestsQuery,
} from "../../features/jobDetail/hook.ts";

import JobButton from "../../components/job/JobButton.tsx";
import RelatedJobs from "../../components/job/RelatedJobs.tsx";
import { JobDetailSkeleton } from "../../components/Loading/JobDetailSkeleton.tsx";
import { useFavoriteToggle } from "../../features/favorites/hook/useFavoriteToggle.ts";
import { lazy, Suspense, useState, useEffect } from "react";
const MapComponent = lazy(() =>
  import("../../components/component/map/MapComponent").then((module) => ({
    default: module.MapComponent,
  })),
);
import {
  Share2,
  MapPin,
  Star,
  Bookmark,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { dateFormatter } from "../../utils/dateFormatter";
import { ShareModal } from "../../components/shared/ShareModal/ShareModal";
import { UpgradeModal } from "../../components/shared/UpgradeModal";
import { BuyContactModal } from "../../components/shared/BuyContactModal";
import mainLink from "../../api/mainURLs";

import { usePlans } from "../../features/plans/hooks";
import { getConfigByKey } from "../../features/plans/api";

const JobListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isPaymentRedirecting, setIsPaymentRedirecting] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [unlockTime, setUnlockTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [upgradeInfo, setUpgradeInfo] = useState<{
    message?: string;
    limit?: number;
    usage?: number;
    perContactPrice?: number;
  }>({});

  const sendMessageMutation = useSendMessageMutation();
  const stripeMutation = useStripeMutation();
  const createJobRequestMutation = useCreateJobRequestMutation();

  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);

  const { data: plans } = usePlans();
  const { data: jobRequests } = useMyJobRequestsQuery(isAuth);
  const [freeJobsToggle, setFreeJobsToggle] = useState(false);

  const {
    isFavorited,
    handleFavoriteClick,
    isLoading: favLoading,
  } = useFavoriteToggle(id!, isAuth);
  const { data: job, isLoading: isJobLoading } = useJobDetailQuery(id!);
  const isOwnJob = job?.userId?._id === currentUser?._id;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getConfigByKey("FREE_PRIVATE_JOBS_UNDER_10000");
        setFreeJobsToggle(config?.value === true);
      } catch (err) {
        console.error("Error fetching free jobs config:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (isAuth && currentUser && plans && jobRequests && job) {
      // Bypass cooldown if job is under 10k and toggle is ON (Private users only)
      const isFreeUnder10k =
        currentUser.planType === "private" &&
        freeJobsToggle &&
        job.price < 10000;

      if (isFreeUnder10k) {
        setIsTimerActive(false);
        setUnlockTime(null);
        return;
      }

      const currentPlan = plans.find(
        (p) =>
          p.name === (currentUser.subscription || "Standard") &&
          p.type === (currentUser.planType || "private"),
      );

      const usage = currentUser.monthlyContactUsage || 0;
      const freeLimit = currentPlan?.entitlements?.freeContact || 0;

      if (currentPlan && usage >= freeLimit) {
        const cooldownMinutes = currentPlan.entitlements.ContactUnlock || 0;
        if (cooldownMinutes > 0) {
          // Get the most recent request
          const lastRequest = [...jobRequests].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];

          if (lastRequest) {
            const unlockAt = new Date(
              new Date(lastRequest.createdAt).getTime() +
                cooldownMinutes * 60 * 1000,
            );
            const now = new Date();

            if (now < unlockAt) {
              setUnlockTime(unlockAt.toISOString());
              setIsTimerActive(true);
            }
          }
        }
      }
    }
  }, [isAuth, currentUser, plans, jobRequests, job, freeJobsToggle]);

  const hasRequested = jobRequests?.some(
    (req) =>
      req.serviceId?._id === id && req.customerId?._id === currentUser?._id,
  );

  const [lng, lat] = job?.location?.coordinates || [0, 0];
  const hasCoordinates = job?.location?.coordinates && (lng !== 0 || lat !== 0);

  const handleCreateOrder = async () => {
    if (!isAuth) {
      toast.error("Vennligst logg inn for å sende forespørsel");
      navigate("/login");
      return;
    }
    if (!job?._id) return;

    if (isOwnJob) {
      navigate(`/job-applicants/${job._id}`);
      return;
    }

    // Prevent ordering own job even if button is clicked somehow
    if (job.userId?._id === currentUser?._id) {
      toast.error("Du kan ikke bestille ditt eget oppdrag.");
      return;
    }

    createJobRequestMutation.mutate(
      { serviceId: job._id },
      {
        onSuccess: () => {
          toast.success("Forespørsel sendt! Venter på godkjenning.");
          // Redirection removed as per user request
        },
        onError: (err: any) => {
          if (err.response?.status === 403 && err.response?.data?.isDelayed) {
            setUnlockTime(err.response.data.unlockAt);
            setIsTimerActive(true);
            toast.error(err.response.data.message);
            return;
          }
          if (
            err.response?.status === 402 ||
            err.response?.data?.upgradeRequired
          ) {
            setUpgradeInfo({
              message: err.response.data.message,
              limit: err.response.data.limit,
              usage: err.response.data.usage,
              perContactPrice: err.response.data.perContactPrice,
            });
            setIsBuyModalOpen(true); // Show BuyContactModal instead of UpgradeModal
            return;
          }
          toast.error(
            err.response?.data?.error || "Kunne ikke sende forespørsel",
          );
        },
      },
    );
  };

  const handleBuyContact = async () => {
    if (!job?._id || !upgradeInfo.perContactPrice) return;

    setIsPaymentRedirecting(true);
    try {
      const res = await mainLink.post(
        "/api/stripe/create-extra-contact-payment",
        {
          amount: upgradeInfo.perContactPrice,
          serviceId: job._id,
        },
      );
      window.location.href = res.data.url;
    } catch (error: any) {
      console.error("Payment redirect failed:", error);
      toast.error(
        error.response?.data?.message || "Kunne ikke starte betaling",
      );
      setIsPaymentRedirecting(false);
    }
  };

  const isMessageLoading =
    sendMessageMutation.isPending ||
    stripeMutation.isPending ||
    createJobRequestMutation.isPending ||
    isPaymentRedirecting;

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && unlockTime) {
      const calculateTimeLeft = () => {
        const difference =
          new Date(unlockTime).getTime() - new Date().getTime();
        if (difference <= 0) {
          setIsTimerActive(false);
          setUnlockTime(null);
          setTimeLeft("");
          return;
        }

        const minutes = Math.floor(difference / 1000 / 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft(`${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`);
      };

      calculateTimeLeft();
      interval = setInterval(calculateTimeLeft, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, unlockTime]);

  const handleNextImage = () => {
    if (!job?.images) return;
    setSelectedImageIndex((prev) => (prev + 1) % job.images.length);
  };

  const handlePrevImage = () => {
    if (!job?.images) return;
    setSelectedImageIndex(
      (prev) => (prev - 1 + job.images.length) % job.images.length,
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return dateFormatter.toShortDate(dateString);
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
            Oppdrag ikke funnet
          </h2>
          <p className="text-gray-600">
            Oppdraget du leter etter eksisterer ikke.
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
            <div className="group relative rounded-xl overflow-hidden shadow-sm max-h-125 bg-gray-50">
              {job.images && job.images.length > 0 ? (
                <>
                  <img
                    src={job.images[selectedImageIndex]}
                    alt={job.title}
                    className="w-full max-h-125 h-full object-contain transition-all duration-300"
                  />

                  {/* Navigation Arrows */}
                  {job.images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrevImage();
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 z-20"
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={24} className="text-gray-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextImage();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 z-20"
                        aria-label="Next image"
                      >
                        <ChevronRight size={24} className="text-gray-700" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">Ingen bilde</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="absolute top-4 right-4 flex flex-col gap-3 z-10"></div>

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {job.promoted && (
                  <div className="bg-[#FF8A71] text-white px-4 py-2 rounded-full font-bold text-[12px] shadow-lg flex items-center gap-1.5 uppercase tracking-widest">
                    <Zap size={14} fill="white" /> Fremmet
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
                    className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-all ${idx === selectedImageIndex ? "ring-2 ring-[#2F7E47] opacity-100" : "opacity-70 hover:opacity-100"}`}
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
                    {job.title || "Uten tittel"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    {job.favCount !== undefined && job.favCount > 0 && (
                      <div className="flex items-center gap-1.5 text-sm font-bold text-custom-green bg-custom-green/5 px-3 py-1 rounded-full border border-[#2F7E47]/10">
                        <Bookmark size={14} fill="#2F7E47" color="#2F7E47" />
                        <span>{job.favCount} lagret</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-custom-green shrink-0">
                    {job.price ? job.price.toLocaleString() : "0"} kr
                  </p>
                  {job.hourlyRate && (
                    <p className="text-sm font-medium text-gray-500">
                      {job.hourlyRate.toLocaleString()} kr / time
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Varighet: {job.duration?.value || "-"}{" "}
                {job.duration?.unit || ""}
              </p>
            </div>

            {/* Contact Button */}
            {job._id && (
              <div className="space-y-3">
                <JobButton
                  handleSendMessage={handleCreateOrder}
                  id={job._id}
                  job={job}
                  isOwnJob={isOwnJob}
                  isMsgLoading={isMessageLoading}
                  hasRequested={hasRequested}
                  isTimerActive={isTimerActive}
                />

                {isTimerActive && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-amber-100 p-2 rounded-lg">
                      <Zap size={20} className="text-amber-600 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        Åpner for deg om {timeLeft}
                      </p>
                      <p className="text-xs text-amber-700">
                        Oppgrader til Plus eller Pro for umiddelbar tilgang
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/pricing")}
                      className="ml-auto text-xs font-bold text-amber-900 underline hover:text-amber-700"
                    >
                      Oppgrader
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Beskrivelse</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {job.description || "Ingen beskrivelse tilgjengelig"}
              </p>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Detaljer</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Kategori</span>
                  <span className="font-medium">
                    {job.categories?.[0] || "Generelt"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sted</span>
                  <span className="font-medium flex items-center gap-1">
                    <MapPin size={14} /> {job.location?.city || "Ikke angitt"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Lagt ut</span>
                  <span className="font-medium">
                    {job.createdAt ? formatDate(job.createdAt) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Erfaring</span>
                  <span className="font-medium">
                    {job.experience || "Ikke angitt"}
                  </span>
                </div>
              </div>
            </div>

            {/* Map */}
            {hasCoordinates && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">
                  Kart over lokasjon
                </h2>
                <div className="h-48 rounded-lg overflow-hidden bg-gray-100">
                  <Suspense
                    fallback={
                      <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">
                        Laster kart...
                      </div>
                    }
                  >
                    <MapComponent
                      coordinates={[lng, lat]}
                      circleRadius={job?.location?.radius || 1000}
                    />
                  </Suspense>
                </div>
              </div>
            )}

            {/* Seller/Company Info */}
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
                  <div className="w-14 h-14 bg-custom-green rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {job.userId?.name?.charAt(0) || "?"}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {job.userId?.role === "company" && job.userId?.companyName
                        ? job.userId.companyName
                        : job.userId?.name || "Ukjent"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {job.userId?.role === "company" && (
                        <span className="px-2 py-0.5 bg-[#0066A2] text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                          Bedrift
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-white text-[10px] font-bold rounded-full uppercase tracking-wider ${job.userId?.verified ? "bg-custom-green" : "bg-gray-500"}`}
                      >
                        {job.userId?.verified
                          ? "Verifisert"
                          : "Ikke verifisert"}
                      </span>
                    </div>
                  </div>

                  {job.userId?.role === "company" && job.userId?.orgNumber && (
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">
                      Org.nr: {job.userId.orgNumber}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-sm text-yellow-500">
                      <Star size={14} fill="currentColor" />
                      <span>{job.userId?.averageRating || "0"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-custom-green">
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
                      <span>{job.userId?.completedJobs || "0"} fullførte</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Share2 size={16} /> Del
              </button>
              <button className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                Rapporter
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Jobs Section */}
        <div className="mt-12 pt-12 border-t border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Anbefalte oppdrag
              </h2>
              <p className="text-gray-500">Basert på lokasjon og kategori</p>
            </div>
          </div>
          <RelatedJobs
            coordinates={job?.location?.coordinates}
            categories={job?.categories}
            currentJobId={job?._id}
          />
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={window.location.href}
        title={job.title || "Jobblo Oppdrag"}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        {...upgradeInfo}
      />

      <BuyContactModal
        isOpen={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        onConfirm={handleBuyContact}
        price={upgradeInfo.perContactPrice || 0}
        isLoading={isPaymentRedirecting}
      />
    </div>
  );
};

export default JobListingDetailPage;
