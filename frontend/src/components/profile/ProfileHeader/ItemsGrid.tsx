import { ChevronDown } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { useFavoriteLists } from "../../../features/favoriteLists/hooks";
import { JobDetailCardSkeleton } from "../../Loading/JobDetailCardSkeleton.tsx";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../../../features/jobsList/hooks";

export function ItemsGrid({ activeTab, userId }: { activeTab: string, userId?: string }) {
  const navigate = useNavigate();
  const { data: lists = [], isLoading: isListsLoading, isError: isListsError } = useFavoriteLists(userId);

  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isError: isJobsError
  } = useJobs({ userId });

  const jobs = jobsData?.pages.flatMap(page => page.data) || [];

  // Empty states content mapping
  const emptyStateContent: Record<string, { title: string; description: string }> = {
    'Jobs': {
      title: "Brukeren har ikke lagt ut noen oppdrag ennå",
      description: "Når brukeren legger ut oppdrag, vil de vises her"
    },
    'Likes': {
      title: "Ingen likte elementer ennå",
      description: "Elementer som er likt vil vises her"
    },
    'Lists': {
      title: "Listene er for øyeblikket tomme",
      description: "Lagrede elementer aur samlinger yahan nazar aayenge"
    },
    'Your wardrobe': {
      title: "Garderoben din er for øyeblikket tom",
      description: "Når du kjøper noe gjennom et Tise-bud, vises det her"
    },
    'Seller Hub': {
      title: "Selgerhub er for øyeblikket tom",
      description: "Salgene og innsikten din vil vises her"
    }
  };

  const currentEmptyState = emptyStateContent[activeTab] || emptyStateContent['Jobs'];

  if (activeTab === 'Lists') {
    if (isListsLoading) return <JobDetailCardSkeleton />;
    if (isListsError) return <p className="text-center py-20 text-red-500">Kunne ikke laste lister.</p>;
  }

  if (activeTab === 'Jobs') {
    if (isJobsLoading) return <JobDetailCardSkeleton />;
    if (isJobsError) return <p className="text-center py-20 text-red-500">Kunne ikke laste oppdrag.</p>;
  }

  const showLists = activeTab === 'Lists' && lists.length > 0;
  const showJobs = activeTab === 'Jobs' && jobs.length > 0;

  return (
    <div className="bg-[#f5f5f5] min-h-screen p-4 md:p-6">
      <div className="max-w-300 mx-auto">
        {showLists ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {lists.map((list: any) => {
              const latestService = list.services?.[list.services.length - 1];
              const backgroundImage = latestService?.images?.[0] || "";

              return (
                <div
                  key={list._id}
                  onClick={() => navigate(`/favorites/list/${list._id}`)}
                  className="relative aspect-4/5 w-full rounded-3xl overflow-hidden cursor-pointer group shadow-sm"
                >
                  {backgroundImage ? (
                    <img
                      src={backgroundImage}
                      alt={list.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                      <span className="text-sm">Ingen bilder</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                  <div className="absolute bottom-6 left-6 right-6">
                    <h2 className="text-white font-bold text-lg md:text-xl drop-shadow-md truncate">
                      {list.name}
                    </h2>
                  </div>
                </div>
              );
            })}
          </div>
        ) : showJobs ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {jobs.map((job: any) => (
              <div
                key={job._id}
                onClick={() => navigate(`/job-listing/${job._id}`)}
                className="relative aspect-4/5 w-full rounded-3xl overflow-hidden cursor-pointer group shadow-sm"
              >
                {job.images?.[0] ? (
                  <img
                    src={job.images[0]}
                    alt={job.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                    <span className="text-sm">Ingen bilder</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-white font-bold text-lg md:text-xl drop-shadow-md truncate">
                    {job.title}
                  </h2>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <EmptyState
              title={currentEmptyState.title}
              description={currentEmptyState.description}
            />
          </div>
        )}
      </div>
    </div>
  );
}
