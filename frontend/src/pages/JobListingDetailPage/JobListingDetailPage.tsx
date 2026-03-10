import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useUserStore } from "../../stores/userStore";
// TanStack Hooks (Inhe update kiya gaya hai mutations ke liye)
import {
  useJobDetailQuery,
  useSendMessageMutation,
  useStripeMutation
} from "../../features/jobDetail/hook.ts";

// Components
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

  // TanStack Mutations hooks
  const sendMessageMutation = useSendMessageMutation();
  const stripeMutation = useStripeMutation();

  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);

  // TanStack Queries 
  const { isFavorited, handleFavoriteClick, isLoading } = useFavoriteToggle(id!, isAuth);
  const { data: job, isLoading: isJobLoading } = useJobDetailQuery(id!);

  const isOwnJob = job?.userId?._id === currentUser?._id;

  // handleSendMessage logic edited to use mutation while keeping original flow
  const handleSendMessage = async (providerId: string) => {
    if (!isAuth) {
      toast.error("Du må logge inn for å sende melding");
      navigate("/login");
      return;
    }
    if (!job?._id) return;

    // Mutation call karke existing flow maintain kiya gaya hai
    sendMessageMutation.mutate(
      { providerId, serviceId: job._id },
      {
        onSuccess: (data) => {
          navigate(`/messages/${data._id}`);
        },
        onError: async (err: any) => {
          const status = err.response?.status;
          const data = err.response?.data;

          // Stripe logic (Exactly as you had it)
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
    <div className="flex flex-col max-w-300 gap-10 mx-auto mt-15.5">
      {isJobLoading ? (
        <JobDetailSkeleton />
      ) : (
        <div className="w-full sm:min-w-180 h-full pb-6 bg-white mx-auto">
          <JobImageCarousel images={job?.images} />
          <div className="px-6">
            <JobDetails job={job} />
            <JobDescription description={job?.description} />
            <JobContainer job={job} />
            <JobLocation location={job?.location} />
            <JobProvider job={job} />
            <JobButton
              handleSendMessage={() => handleSendMessage(job?.userId?._id)}
              id={job._id}
              isOwnJob={isOwnJob}
              isMsgLoading={isMessageLoading}
            />
          </div>

        </div>
      )}
      <div className="w-full">
        {isJobLoading ? (
          <JobDetailCardSkeleton />
        ) : (
          <RelatedJobs
            coordinates={job?.location?.coordinates}
            currentJobId={job?._id}
          />
        )}
      </div>

    </div>
  );
};

export default JobListingDetailPage;