import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, RotateCw, Search, TriangleAlert } from 'lucide-react';

import mainLink from '../../api/mainURLs';
import { useMyServices, useServiceActions } from '../../features/services/hooks';
import type { Service } from '../../features/services/types';
import EmptyState from '../../components/Ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/Ui/select';
import { MyListingCard } from '../../components/listing/MyListingCard';
import { MyListingGridSkeleton } from '../../components/listing/MyListingCardSkeleton';

/**
 * "Mine annonser" — the owner's listing management page.
 *
 * The page kept its filters, its search and its tab vocabulary. What changed is the
 * card and the states around it:
 *
 *   - management actions moved off the photo and out of the price row into one
 *     overflow menu with real labels and touch-sized targets
 *     (`components/listing/ListingOwnerActions`);
 *   - every card now shows its status, using the canonical Norwegian labels from
 *     `constants/statuses.ts`. Previously the only way to know a listing's state was to
 *     notice which filter was selected;
 *   - loading renders the grid's own silhouette instead of one differently shaped
 *     skeleton for the whole page;
 *   - the error state was the literal string "Feil ved lasting av annonser" in an
 *     unstyled div, with no way to retry.
 *
 * Editing now goes to `/Publish-job/:id`, the real edit page, rather than swapping this
 * page's contents for a bare `CreateJobForm`. That form had no header, no back link and
 * no indication you had left the list — and it meant the same action behaved differently
 * here than from a job card anywhere else in the product.
 */

type TabConfig = {
  id: string;
  label: string;
  statuses: Service['status'][];
};

const tabs: TabConfig[] = [
  { id: 'active', label: 'Aktive oppdrag', statuses: ['open'] },
  { id: 'pending', label: 'Ventende søknader', statuses: ['pending'] },
  {
    id: 'awaiting_payment',
    label: 'Kontrakt – venter på betaling',
    statuses: ['awaiting_payment'],
  },
  { id: 'paid', label: 'Betalt – venter på start', statuses: ['paid'] },
  { id: 'in_progress', label: 'Pågående', statuses: ['in_progress', 'ready_for_review'] },
  {
    id: 'waiting_for_approval',
    label: 'Venter på godkjenning',
    statuses: ['waiting_for_approval'],
  },
  { id: 'completed', label: 'Fullførte oppdrag', statuses: ['completed'] },
  { id: 'cancelled', label: 'Kansellerte oppdrag', statuses: ['cancelled', 'closed'] },
  { id: 'expired', label: 'Utløpte oppdrag', statuses: ['expired'] },
  { id: 'draft', label: 'Utkast', statuses: ['draft'] },
];

const FILTER_CONTROL =
  'h-11 w-full rounded-full border-[#E6E7E1] bg-white text-[0.8125rem] font-medium text-[#0B0B0B] sm:w-[220px]';

export default function MineAnnonser() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'price_high' | 'price_low'>(
    'newest'
  );

  const { data: services = [], isLoading, error, refetch, isFetching } = useMyServices();
  const { deleteMutation } = useServiceActions();

  const { data: orders = [] } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const response = await mainLink.get('/api/orders');
      return response.data;
    },
  });

  const currentTab = tabs.find((tab) => tab.id === activeTab)!;

  const filteredAndSortedServices = useMemo(() => {
    let filtered = services.filter((service) => currentTab.statuses.includes(service.status));

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((service) => {
        const matchesTitle = service.title.toLowerCase().includes(lowercasedQuery);
        const matchesCategory =
          service.categories &&
          service.categories.some((cat: string) => cat.toLowerCase().includes(lowercasedQuery));
        const matchesId = service._id.toLowerCase().includes(lowercasedQuery);

        return matchesTitle || matchesCategory || matchesId;
      });
    }

    // Copy before sorting: `services` is React Query's cached array, and sorting it in
    // place mutates the cache every other consumer reads.
    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'price_high':
          return b.price - a.price;
        case 'price_low':
          return a.price - b.price;
        default:
          return 0;
      }
    });
  }, [services, currentTab, searchQuery, sortOption]);

  /** A completed job's card opens its order, which is where the receipt and review are. */
  const openListing = (job: Service) => {
    if (job.status === 'completed') {
      const matchingOrder = orders.find((o: { serviceId?: unknown; _id: string }) => {
        const raw = o.serviceId as { _id?: string } | string | null | undefined;
        const orderServiceId =
          raw && typeof raw === 'object' ? (raw._id ?? '') : raw ? String(raw) : '';
        return String(orderServiceId) === String(job._id);
      });

      navigate(
        matchingOrder
          ? `/completed-job/${matchingOrder._id}`
          : `/completed-job?serviceId=${job._id}`
      );
      return;
    }

    navigate(`/job-listing/${job._id}`);
  };

  const filters = (
    <div className="sticky top-0 z-10 border-b border-[#E6E7E1] bg-white/90 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-300 flex-col gap-3 sm:flex-row">
        <Select value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <SelectTrigger className={FILTER_CONTROL} aria-label="Filtrer på status">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {tabs.map((tab) => (
              <SelectItem key={tab.id} value={tab.id}>
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortOption} onValueChange={(v) => setSortOption(v as typeof sortOption)}>
          <SelectTrigger
            className={`${FILTER_CONTROL} sm:w-[180px]`}
            aria-label="Sorter annonsene"
          >
            <SelectValue placeholder="Sorter" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="newest">Nyeste først</SelectItem>
            <SelectItem value="oldest">Eldste først</SelectItem>
            <SelectItem value="price_high">Høyeste pris</SelectItem>
            <SelectItem value="price_low">Laveste pris</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B9E96]"
          />
          <input
            type="search"
            aria-label="Søk i annonsene dine"
            placeholder="Søk etter tittel, kategori eller ID …"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-full border border-[#E6E7E1] bg-white pl-10 pr-4 text-[0.8125rem] text-[#0B0B0B] placeholder:text-[#9B9E96] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
          />
        </div>
      </div>
    </div>
  );

  const body = () => {
    if (isLoading) return <MyListingGridSkeleton />;

    if (error) {
      // Never the raw axios/backend message — a friendly sentence and a way out.
      return (
        <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
          <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-[#FCF4F3]">
            <TriangleAlert size={34} strokeWidth={1.8} className="text-[#B0453B]" />
          </div>
          <h3 className="mb-2 text-[1.125rem] font-bold text-[#0B0B0B]">
            Vi fikk ikke hentet annonsene dine
          </h3>
          <p className="mb-6 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
            Noe gikk galt underveis. Sjekk nettforbindelsen din og prøv igjen.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex h-11.5 items-center justify-center gap-2 rounded-xl bg-[#2E6641] px-5 text-[0.9375rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <RotateCw
              size={16}
              strokeWidth={2}
              className={isFetching ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
            Prøv igjen
          </button>
        </div>
      );
    }

    if (filteredAndSortedServices.length === 0) {
      const isSearching = searchQuery.trim().length > 0;

      if (isSearching) {
        return (
          <EmptyState
            type="jobs"
            title="Ingen treff"
            description={`Vi fant ingen annonser som matcher «${searchQuery}» i ${currentTab.label.toLowerCase()}.`}
          />
        );
      }

      return (
        <EmptyState
          type="jobs"
          title={
            activeTab === 'active'
              ? 'Du har ingen aktive annonser ennå'
              : 'Ingen oppdrag i denne kategorien'
          }
          description={
            activeTab === 'active'
              ? 'Opprett en jobb og finn riktig person til oppdraget.'
              : `Du har ingen oppdrag under «${currentTab.label}» ennå.`
          }
          actionLabel={activeTab === 'active' ? 'Opprett annonse' : undefined}
          onActionClick={activeTab === 'active' ? () => navigate('/Publish-job') : undefined}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedServices.map((job) => (
          <MyListingCard
            key={job._id}
            service={job}
            onOpen={() => openListing(job)}
            onDelete={() => deleteMutation.mutateAsync(job._id)}
            isDeleting={deleteMutation.isPending && deleteMutation.variables === job._id}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {filters}

      <div className="mx-auto w-full max-w-300 px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.375rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">
              Mine annonser
            </h1>
            <p className="mt-1 text-[0.875rem] text-[#63665F]">
              {isLoading
                ? 'Henter annonsene dine …'
                : `${filteredAndSortedServices.length} ${
                    filteredAndSortedServices.length === 1 ? 'annonse' : 'annonser'
                  } i «${currentTab.label}»`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/Publish-job')}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2E6641] px-4 text-[0.875rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.995] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <Plus size={16} strokeWidth={2.4} />
            Ny annonse
          </button>
        </div>

        {body()}
      </div>
    </div>
  );
}
