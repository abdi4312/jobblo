import { useJobs } from '../../../features/jobsList/hooks';
import { JobCard } from '../../component/jobCard/JobCard';
import { JobCardSkeleton } from '../../Loading/JobCardSkeleton';
import type { Tab } from '../../../types/tabs';
import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../../../stores/userStore';
import { getConfigByKey } from '../../../features/plans/api';

interface JobsContainerProps {
  selectedCategories?: string[];
  searchQuery?: string;
  isUrgent?: boolean;
  activeTab?: Tab;
}

// Jobs container component for displaying job listings
export default function JobsContainer({
  selectedCategories = [],
  searchQuery = '',
  isUrgent = false,
  activeTab = 'Discover',
}: JobsContainerProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useJobs({
    categories: selectedCategories,
    search: searchQuery,
    urgent: isUrgent,
    tab: activeTab,
  });

  const user = useUserStore((state) => state.user);
  const [showAds, setShowAds] = useState(false);

  useEffect(() => {
    const checkAds = async () => {
      try {
        const adsConfig = await getConfigByKey('ADS_FOR_NON_SUBSCRIBERS');
        if (adsConfig && adsConfig.value === true && user?.subscription === 'Standard') {
          setShowAds(true);
        }
      } catch (err) {
        console.error('Error fetching ads config:', err);
      }
    };
    checkAds();
  }, [user]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // const totalJobs = data?.pages[0].pagination.total || 0;
  const jobs = data?.pages.flatMap((page) => page.data) || [];

  return (
    <div>
      {showAds && (
        <div className="mb-8 p-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">
                Oppgrader til Pro for en reklamefri opplevelse!
              </h3>
              <p className="text-orange-100">
                Få tilgang til flere kontakter og prioriterte annonser.
              </p>
            </div>
            <button
              onClick={() => (window.location.href = '/membership')}
              className="px-6 py-2.5 bg-white text-orange-600 rounded-full font-bold hover:bg-orange-50 transition-colors shadow-sm shrink-0"
            >
              Se Planer
            </button>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl" />
        </div>
      )}
      <div className="grid gap-x-6 gap-y-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 justify-start items-start mx-auto w-full">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => <JobCardSkeleton key={index} />)
          : jobs.map((job) => <JobCard key={job._id} job={job} />)}
      </div>

      {!isLoading && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-gray-50 p-6 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ingen tjenester funnet</h3>
          <p className="text-gray-500 max-w-xs">
            {activeTab === 'Favorites'
              ? 'Du har ikke lagt til noen tjenester i dine favoritter ennå.'
              : activeTab === 'People’s'
                ? 'Ingen populære tjenester akkurat nå. Prøv igjen senere!'
                : 'Vi fant ingen tjenester som samsvarer med ditt søk eller kategori.'}
          </p>
        </div>
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center mt-12 pb-10 min-h-25">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 px-10 py-3.5 bg-custom-green text-white rounded-full font-bold shadow-md">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Laster...
            </div>
          ) : (
            <div className="h-4 w-full" />
          )}
        </div>
      )}
    </div>
  );
}
