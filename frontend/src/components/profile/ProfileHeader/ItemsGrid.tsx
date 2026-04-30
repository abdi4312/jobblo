import { EmptyState } from "./EmptyState";
import { Star } from "lucide-react";
import { useParams } from "react-router-dom";
import { useUserProfile } from "../../../features/profile/hooks";
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
  profileType,
}: {
  activeTab: string;
  userId?: string;
  profileType?: "seeker" | "poster";
}) {
  const navigate = useNavigate();
  const { userId: userIdParam } = useParams<{ userId: string }>();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const currentUser = useUserStore((state) => state.user);
  const isOwner = userId === currentUser?._id;

  // Fetch profile if userId is provided, otherwise use current user
  const { data: profileUser } = useUserProfile(userIdParam);
  const userToDisplay = userIdParam ? profileUser : currentUser;

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
    if (
      !hasNextPage ||
      isFetchingNextPage ||
      (activeTab !== "Oppdrag" && activeTab !== "Aktive")
    )
      return;

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

  // Seeker Specific Content
  if (profileType === "seeker") {
    if (activeTab === "Om meg") {
      const userSkills = (userToDisplay as any)?.skills || [
        "Maling",
        "Snekkering",
        "Hagearbeid",
        "Rengjøring",
        "Flytting",
      ];
      const availabilityText =
        (userToDisplay as any)?.availabilityText ||
        "Mandag - Fredag: 08:00 - 16:00\nLørdag: 10:00 - 14:00\nSøndag: Stengt";

      return (
        <div className="max-w-300 mx-auto p-6 flex flex-col gap-6">
          {/* Skills Section */}
          <div className="bg-white p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-6">Mine ferdigheter</h3>
            <div className="flex flex-wrap gap-3">
              {userSkills.map((skill: string) => (
                <span
                  key={skill}
                  className="px-6 py-3 bg-[#2F7E4715] rounded-2xl text-sm font-bold text-[#2F7E47] border border-[#2F7E4720]"
                >
                  {skill}
                </span>
              ))}
              {userSkills.length === 0 && (
                <p className="text-gray-400">
                  Ingen ferdigheter lagt til ennå.
                </p>
              )}
            </div>
          </div>

          {/* Availability Section */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-6">Min tilgjengelighet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availabilityText.split("\n").map((time: string) => (
                <div
                  key={time}
                  className="p-4 bg-gray-50 rounded-2xl border border-gray-100 font-medium"
                >
                  {time}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "Portfolio") {
      return (
        <div className="max-w-300 mx-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square bg-gray-100 rounded-[2rem] overflow-hidden border border-gray-200 group cursor-pointer relative"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold">Se prosjekt</span>
                </div>
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Prosjekt {i}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // Poster Specific Content
  if (profileType === "poster") {
    // Basic credibility signals
    if (activeTab === "Aktive") {
      // Reuse jobs logic but filtered or as is
    }
  }

  // Common or fallback content
  const emptyStateContent: Record<
    string,
    { title: string; description: string }
  > = {
    Oppdrag: {
      title: "Brukeren har ikke lagt ut noen oppdrag ennå",
      description: "Når brukeren legger ut oppdrag, vil de vises her",
    },
    Aktive: {
      title: "Ingen aktive oppdrag",
      description: "Brukeren har ingen aktive oppdrag ute akkurat nå",
    },
    Fullførte: {
      title: "Ingen fullførte oppdrag",
      description: "Fullførte oppdrag vil vises her",
    },
    Vurderinger: {
      title: "Ingen vurderinger ennå",
      description: "Vurderinger fra tidligere arbeid vil vises her",
    },
    Lister: {
      title: "Listene er for øyeblikket tomme",
      description: "Lagrede elementer og samlinger vil vises her",
    },
  };

  const currentEmptyState =
    emptyStateContent[activeTab] || emptyStateContent["Oppdrag"];

  if (activeTab === "Vurderinger") {
    return (
      <div className="max-w-300 mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-gray-100">
          <Star className="w-16 h-16 text-gray-200 mb-4" />
          <h3 className="text-xl font-bold text-gray-900">
            {currentEmptyState.title}
          </h3>
          <p className="text-gray-500">{currentEmptyState.description}</p>
        </div>
      </div>
    );
  }

  if (activeTab === "Lister") {
    if (isListsLoading) return <JobDetailCardSkeleton />;
    if (isListsError)
      return (
        <p className="text-center py-20 text-red-500">
          Kunne ikke laste lister.
        </p>
      );
  }

  if (["Oppdrag", "Aktive", "Fullførte", "Tidligere"].includes(activeTab)) {
    if (isJobsLoading) return <JobDetailCardSkeleton />;
    if (isJobsError)
      return (
        <p className="text-center py-20 text-red-500">
          Kunne ikke laste oppdrag.
        </p>
      );
  }

  const showJobs =
    (activeTab === "Oppdrag" ||
      activeTab === "Aktive" ||
      activeTab === "Fullførte" ||
      activeTab === "Tidligere") &&
    jobs.length > 0;
  const showLists = activeTab === "Lister" && lists.length > 0;

  // For "Fullførte" and "Tidligere", we might want to filter jobs that are completed.
  // Assuming job status exists. If not, we just show all for now.
  const filteredJobs =
    activeTab === "Fullførte" || activeTab === "Tidligere"
      ? jobs.filter(
          (job) => job.status === "completed" || job.status === "closed",
        )
      : jobs;

  const displayJobs = filteredJobs.length > 0 ? filteredJobs : jobs; // Fallback to all if no filtered jobs for sample

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
              {displayJobs.map((job: Jobs) => (
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
