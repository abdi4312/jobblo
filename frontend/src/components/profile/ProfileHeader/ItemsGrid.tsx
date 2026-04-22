import { EmptyState } from "./EmptyState";
import { useFavoriteLists } from "../../../features/favoriteLists/hooks";
import { JobDetailCardSkeleton } from "../../Loading/JobDetailCardSkeleton.tsx";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../../../features/jobsList/hooks";
import { JobCard } from "../../component/jobCard/JobCard.tsx";
import type { Jobs } from "../../../../types/Jobs.ts";
import { useUserStore } from "../../../stores/userStore.ts";
import { Button } from "../../Ui/Button.tsx";
import { useEffect, useRef } from "react";

interface List {
  _id: string;
  name: string;
  services?: {
    images?: string[];
  }[];
}

export function ItemsGrid({
  activeTab,
  userId,
}: {
  activeTab: string;
  userId?: string;
}) {
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const currentUser = useUserStore((state) => state.user);
  const isOwner = userId === currentUser?._id;

  const {
    data: lists = [],
    isLoading: isListsLoading,
    isError: isListsError,
  } = useFavoriteLists(userId);

  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isError: isJobsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobs({ userId });

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || activeTab !== "Oppdrag") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, activeTab]);

  const jobs = (jobsData?.pages.flatMap((page) => page.data) ||
    []) as unknown as Jobs[];

  // Empty states content mapping
  const emptyStateContent: Record<
    string,
    { title: string; description: string }
  > = {
    Oppdrag: {
      title: "Brukeren har ikke lagt ut noen oppdrag ennå",
      description: "Når brukeren legger ut oppdrag, vil de vises her",
    },
    Lister: {
      title: "Listene er for øyeblikket tomme",
      description: "Lagrede elementer og samlinger vil vises her",
    },
  };

  const currentEmptyState =
    emptyStateContent[activeTab] || emptyStateContent["Oppdrag"];

  if (activeTab === "Lister") {
    if (isListsLoading) return <JobDetailCardSkeleton />;
    if (isListsError)
      return (
        <p className="text-center py-20 text-red-500">
          Kunne ikke laste lister.
        </p>
      );
  }

  if (activeTab === "Oppdrag") {
    if (isJobsLoading) return <JobDetailCardSkeleton />;
    if (isJobsError)
      return (
        <p className="text-center py-20 text-red-500">
          Kunne ikke laste oppdrag.
        </p>
      );
  }

  const showLists = activeTab === "Lister" && lists.length > 0;
  const showJobs = activeTab === "Oppdrag" && jobs.length > 0;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-300 mx-auto">
        {showLists ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {lists.map((list: List) => {
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
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {jobs.map((job: Jobs) => (
                <JobCard key={job._id} job={job} isOwner={isOwner} />
              ))}
            </div>
            {hasNextPage && (
              <div
                ref={loadMoreRef}
                className="flex justify-center mt-10 min-h-[100px]"
              >
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-2 bg-[#2F7E47] text-white px-8 py-2 rounded-full font-bold">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Laster mer...
                  </div>
                ) : (
                  <div className="h-4 w-full" />
                )}
              </div>
            )}
          </>
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
