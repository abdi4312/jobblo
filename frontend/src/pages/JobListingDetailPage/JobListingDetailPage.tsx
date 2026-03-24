import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useUserStore } from "../../stores/userStore";
import {
  useJobDetailQuery,
  useSendMessageMutation,
  useStripeMutation
} from "../../features/jobDetail/hook.ts";

import JobImageCarousel from "../../components/job/JobImageCarousel.tsx";
import JobDetails from "../../components/job/JobDetails.tsx";
import JobDescription from "../../components/job/JobDescription.tsx";
import JobLocation from "../../components/job/JobLocation.tsx";
import RelatedJobs from "../../components/job/RelatedJobs.tsx";
import JobContainer from "../../components/job/JobContainer.tsx";
import JobProvider from "../../components/job/JobProvider.tsx";
import JobButton from "../../components/job/JobButton.tsx";
import { JobDetailSkeleton } from "../../components/Loading/JobDetailSkeleton.tsx";
import { JobDetailCardSkeleton } from "../../components/Loading/JobDetailCardSkeleton.tsx";
import { useFavoriteToggle } from "../../features/favorites/hook/useFavoriteToggle.ts";

const JobListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const sendMessageMutation = useSendMessageMutation();
  const stripeMutation = useStripeMutation();

  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);

  // TanStack Queries (Using id! to ensure id is passed)
  const { isFavorited, handleFavoriteClick, isLoading } = useFavoriteToggle(id!, isAuth);
  // Suppress unused warnings if these are managed elsewhere or intended for future use
  void isFavorited; void handleFavoriteClick; void isLoading;

  const { data: job, isLoading: isJobLoading } = useJobDetailQuery(id!);
  const isOwnJob = job?.userId?._id === currentUser?._id;

  const handleSendMessage = async (providerId: string) => {
    if (!isAuth) {
      toast.error("Du må logge inn for å sende melding");
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
        onError: async (err: any) => {
          const status = err.response?.status;
          const data = err.response?.data;

          if (status === 402 && data?.paymentRequired) {
            try {
              const paymentSession = await stripeMutation.mutateAsync({
                amount: data.amount,
                providerId,
                serviceId: job._id,
              });
              window.location.href = paymentSession.url;
            } catch (stripeErr) {
              toast.error("Kunne ikke starte betaling");
            }
            return;
          }
          toast.error(data?.message || "Kunne ikke opprette samtale");
        },
      }
    );
  };

  const isMessageLoading = sendMessageMutation.isPending || stripeMutation.isPending;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-[1200px] mx-auto px-2 lg:px-0">

        {/* Loading State */}
        {isJobLoading ? (
          <div className="flex flex-col lg:flex-row gap-6 mt-16 items-start">
            <div className="flex-1"><JobDetailSkeleton /></div>
            <div className="lg:w-[360px] w-full"><JobDetailCardSkeleton /></div>
          </div>
        ) : (
          <div className="mt-16 sm:mt-0">
            <div className="flex flex-col lg:flex-row gap-6 items-start">

              {/* ── Left Column: Main Content ── */}
              <div className="flex-1 w-full min-w-0 space-y-5">

                {/* Main Job Card */}
                <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <JobImageCarousel images={job?.images} />
                  <div className="px-6 pt-6 pb-8 sm:px-8 space-y-6">
                    <JobDetails job={job} />
                    <div className="border-t border-[#F0F0F0]" />
                    <JobDescription description={job?.description} />
                  </div>
                </div>

                {/* Provider Card (Includes Salary internal to it as per previous turn) */}
                <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <JobProvider job={job} />
                </div>

                {/* Location Card */}
                <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <JobLocation location={job?.location} />
                </div>
              </div>

              {/* ── Right Column: Sticky Sidebar ── */}
              <aside className="lg:w-[360px] w-full lg:sticky lg:top-5 space-y-4 shrink-0">

                {/* Price CTA Card */}
                <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <div className="h-1.5 bg-[#2F7E47]" />
                  <div className="p-6 space-y-5">
                    <div>
                      <p className="text-[11px] font-semibold text-[#2F7E47] uppercase tracking-widest mb-1">
                        Totalpris
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[42px] font-black text-[#0A0A0A] leading-none tabular-nums">
                          {job?.price ? job.price.toLocaleString("nb-NO") : "–"}
                        </span>
                        <span className="text-[20px] font-semibold text-[#9CA3AF]">kr</span>
                      </div>
                    </div>

                    <JobButton
                      handleSendMessage={() => handleSendMessage(job?.userId?._id)}
                      id={job._id}
                      job={job}
                      isOwnJob={isOwnJob}
                      isMsgLoading={isMessageLoading}
                    />

                    <p className="text-[11px] text-center text-[#9CA3AF] leading-relaxed">
                      Trygt og sikkert oppgjør gjennom Jobblo.
                    </p>
                  </div>
                </div>

                {/* Quick Info Card */}
                <div className="bg-white rounded-[20px] p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">
                    Oppdragsinfo
                  </p>
                  <JobContainer job={job} />
                </div>

              </aside>
            </div>

            {/* ── Related Jobs: Full-width at the bottom ── */}
            <div className="mt-12 pb-12">
              <h3 className="text-[20px] font-bold text-[#0A0A0A] mb-6 px-1">Lignende oppdrag</h3>
              <RelatedJobs
                coordinates={job?.location?.coordinates}
                currentJobId={job?._id}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobListingDetailPage;