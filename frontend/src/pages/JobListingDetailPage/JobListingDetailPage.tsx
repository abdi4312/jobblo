import { useParams, useNavigate } from "react-router-dom";
import { TailSpin } from "react-loader-spinner";
import { toast } from "react-toastify";
import { useUserStore } from "../../stores/userStore";
import { setFavorites, deleteFavorites } from "../../api/favoriteAPI";

// TanStack Hooks (Inhe update kiya gaya hai mutations ke liye)
import {
  useJobDetailQuery,
  useFavoriteStatusQuery,
  useSendMessageMutation,
  useStripeMutation
} from "../../features/jobDetail/hook.ts";

// Components
import JobImageCarousel from "../../components/job/JobImageCarousel.tsx";
import JobDetails from "../../components/job/JobDetails.tsx";
import JobDescription from "../../components/job/JobDescription/JobDescription";
import JobLocation from "../../components/job/JobLocation/JobLocation";
import RelatedJobs from "../../components/job/RelatedJobs.tsx";
import JobContainer from "../../components/job/JobContainer.tsx";
import JobProvider from "../../components/job/JobProvider.tsx";
import JobButton from "../../components/job/JobButton.tsx";

const JobListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // TanStack Mutations hooks
  const sendMessageMutation = useSendMessageMutation();
  const stripeMutation = useStripeMutation();

  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);

  // TanStack Queries 
  const { data: job, isLoading: isJobLoading, refetch: refetchJob } = useJobDetailQuery(id!);
  const { data: isFavorited, refetch: refetchFavStatus } = useFavoriteStatusQuery(id!, isAuth);

  const isOwnJob = job?.userId?._id === currentUser?._id;

  // Aapki original handleFavoriteClick logic (Bina kisi change ke)
  const handleFavoriteClick = async () => {
    if (!isAuth) {
      toast.error("Du må logge inn for å legge til favoritter");
      navigate("/login");
      return;
    }
    if (!id) return;

    try {
      if (isFavorited) {
        await deleteFavorites(id);
        toast.success("Fjernet fra favoritter");
      } else {
        await setFavorites(id);
        toast.success("Lagt til i favoritter");
      }
      refetchFavStatus();
    } catch (err) {
      console.error("Failed to update favorites", err);
      toast.error("Kunne ikke oppdatere favoritter");
    }
  };

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

  // if (isJobLoading) {
  //   return (
  //     <div className="flex justify-center items-center h-screen">
  //       <TailSpin height={50} width={50} color="#2F7E47" ariaLabel="loading" />
  //     </div>
  //   );
  // }

  // Combine loading states for the button
  const isMessageLoading = sendMessageMutation.isPending || stripeMutation.isPending;

  return (
    <div className="flex flex-col lg:flex-row max-w-300 gap-10 mx-auto mt-15.5">
      <div className="w-full sm:min-w-180 md:max-w-180 h-full pb-6 bg-white mx-auto">
        <JobImageCarousel images={job?.images} loading={isJobLoading} />
        <div className="px-6">
          <JobDetails job={job} loading={isJobLoading}/>
          <JobDescription description={job?.description} loading={isJobLoading}/>
          <JobContainer job={job} loading={isJobLoading}/>
          <JobLocation location={job?.location} loading={isJobLoading}/>
          <JobProvider job={job} loading={isJobLoading}/>
          <JobButton
            handleSendMessage={() => handleSendMessage(job?.userId?._id)}
            handleFavoriteClick={handleFavoriteClick}
            isFavorited={!!isFavorited}
            isOwnJob={isOwnJob}
            isLoading={isMessageLoading}
            loading={isJobLoading}
          />
        </div>
      </div>
      <div className="w-full lg:max-w-110">
        <RelatedJobs
          coordinates={job?.location?.coordinates}
          currentJobId={job?._id}
        />
      </div>
    </div>
  );
};

export default JobListingDetailPage;