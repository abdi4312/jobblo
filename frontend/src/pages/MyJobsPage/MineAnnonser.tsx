import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateJobForm from '../../components/CreateJobForm/CreateJobForm';
import { Clock4, MapPin, Pencil, Search, Filter } from 'lucide-react';
import { Button } from '../../components/Ui/Button';
import { useMyServices } from '../../features/services/hooks';
import { useServiceActions } from '../../features/services/hooks';
import type { Service } from '../../features/services/types';
import { JobDetailCardSkeleton } from '../../components/Loading/JobDetailCardSkeleton';
import mainLink from '../../api/mainURLs';
import { useQuery } from '@tanstack/react-query';
import EmptyState from '../../components/Ui/EmptyState';

// Define the tabs configuration
type TabConfig = {
  id: string;
  label: string;
  statuses: Service['status'][];
};

const tabs: TabConfig[] = [
  { id: 'active', label: 'Active Jobs', statuses: ['open'] },
  { id: 'pending', label: 'Pending Applications', statuses: ['pending'] },
  { id: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  {
    id: 'waiting_for_approval',
    label: 'Waiting for Approval',
    statuses: ['waiting_for_approval'],
  },
  { id: 'completed', label: 'Completed Jobs', statuses: ['completed'] },
  { id: 'cancelled', label: 'Cancelled Jobs', statuses: ['cancelled'] },
  { id: 'expired', label: 'Expired Jobs', statuses: ['expired'] },
  { id: 'draft', label: 'Draft Jobs', statuses: ['draft'] },
];

export default function MineAnnonser() {
  const navigate = useNavigate();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'price_high' | 'price_low'>(
    'newest'
  );

  // Tanstack Hooks (called first, no conditionals before!)
  const { data: services = [], isLoading, error } = useMyServices();
  const { deleteMutation, updateMutation } = useServiceActions();

  const { data: orders = [] } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const response = await mainLink.get('/api/orders');
      return response.data;
    },
  });

  // Find current tab's statuses and filter/sort BEFORE any conditionals!
  const currentTab = tabs.find((tab) => tab.id === activeTab)!;

  // Filter and sort services (must be called unconditionally!)
  const filteredAndSortedServices = useMemo(() => {
    let filtered = services.filter((service) => currentTab.statuses.includes(service.status));

    // Apply search filter
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((service) => {
        // Search by job title
        const matchesTitle = service.title.toLowerCase().includes(lowercasedQuery);
        // Search by category
        const matchesCategory =
          service.categories &&
          service.categories.some((cat: string) => cat.toLowerCase().includes(lowercasedQuery));
        // Search by job ID
        const matchesId = service._id.toLowerCase().includes(lowercasedQuery);

        return matchesTitle || matchesCategory || matchesId;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
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

    return filtered;
  }, [services, activeTab, searchQuery, sortOption]);

  const categoryColorMap: Record<string, string> = {
    Rørlegger: '#2F7E47',
    Renhold: '#2F7E47',
    Maling: '#238CEB',
    Hagearbeid: '#2F7E47',
    Flytting: '#2F7E47',
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
  };

  const handleDelete = (serviceId: string) => {
    if (confirm('Er du sikker på at du vil slette denne annonsen?')) {
      deleteMutation.mutate(serviceId);
    }
  };

  const handleFormSubmit = (jobData: FormData) => {
    if (editingService) {
      updateMutation.mutate(
        { id: editingService._id, data: jobData as unknown as Service },
        { onSuccess: () => setEditingService(null) }
      );
    }
  };

  if (isLoading) return <JobDetailCardSkeleton />;
  if (error) return <div>Feil ved henting av annonser</div>;

  if (editingService) {
    return (
      <>
        {/* Form Container */}
        <div className="p-2 max-w-300 mx-auto">
          <CreateJobForm
            onSubmit={handleFormSubmit}
            userId=""
            isEditMode={true}
            initialData={{
              title: editingService.title,
              description: editingService.description,
              price: editingService.price.toString(),
              address: editingService.location.address,
              city: editingService.location.city,
              categories: editingService.categories.join(', '),
              urgent: editingService.urgent,
              equipment: editingService.equipment || '',
              fromDate: editingService.fromDate
                ? new Date(editingService.fromDate).toISOString().split('T')[0]
                : '',
              toDate: editingService.toDate
                ? new Date(editingService.toDate).toISOString().split('T')[0]
                : '',
              durationValue: editingService.duration?.value?.toString() || '',
              durationUnit: editingService.duration?.unit || 'hours',
              images: editingService.images || [],
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div className="p-0 max-w-300 mx-auto min-h-screen">
      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-custom-green text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Søk etter jobbnavn, kategori eller jobb-ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-custom-green bg-white text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-custom-green"
            >
              <option value="newest">Nyeste først</option>
              <option value="oldest">Eldste først</option>
              <option value="price_high">Høyeste pris</option>
              <option value="price_low">Laveste pris</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSortedServices.length === 0 ? (
        <EmptyState
          type="jobs"
          title="Ingen jobs i denne kategorien"
          description={`Det ser ut som du ikke har noen jobs i ${currentTab.label} ennå.`}
          actionLabel={activeTab === 'active' ? 'Lag din første annonse' : undefined}
          onActionClick={activeTab === 'active' ? () => navigate('/publish-job') : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 m-2 gap-2.5">
          {filteredAndSortedServices.map((job: Service) => {
            const catName = Array.isArray(job.categories) ? job.categories[0] : job.categories;
            const badgeColor = categoryColorMap[catName as string] || '#2F7E47';
            const handleCardClick = () => {
              if (job.status === 'completed') {
                const matchingOrder = orders.find((o: any) => {
                  let orderServiceId;
                  if (typeof o.serviceId === 'object' && o.serviceId !== null) {
                    orderServiceId = o.serviceId._id
                      ? o.serviceId._id.toString()
                      : o.serviceId.toString();
                  } else {
                    orderServiceId = o.serviceId ? o.serviceId.toString() : '';
                  }
                  return orderServiceId === job._id.toString();
                });
                if (matchingOrder) {
                  navigate(`/completed-job/${matchingOrder._id}`);
                  return;
                } else {
                  // If no order, navigate with serviceId as query param
                  navigate(`/completed-job?serviceId=${job._id}`);
                  return;
                }
              }
              navigate(`/job-listing/${job._id}`);
            };

            return (
              <div
                key={job._id}
                onClick={handleCardClick}
                className={`mx-auto bg-[#FFFFFF1A] w-full rounded-xl shadow-md cursor-pointer overflow-hidden`}
              >
                {/* Bildeseksjon */}
                <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">
                  {job.images[0] ? (
                    <img
                      src={job.images[0]}
                      alt={job.title}
                      className="w-full h-full p-2 object-cover rounded-t-2xl"
                    />
                  ) : (
                    <span className="text-[#666] text-base">Ingen bilde tilgjengelig</span>
                  )}

                  <div
                    className="absolute top-4 right-2 bg-custom-green px-3 py-1.5 text-white rounded-[20px] flex items-center justify-center"
                    style={{ backgroundColor: badgeColor }}
                  >
                    <span className="text-[12px]">{catName || 'Rørlegger'}</span>
                  </div>

                  <div className="absolute flex justify-between items-center text-custom-black bottom-4 left-4.5 right-4.5">
                    {/* Venstre side: Lokasjonsmerke */}
                    <div className="bg-[#D9D9D9]/80 px-3 py-1.5 rounded-[20px] flex items-center justify-center gap-1.5 backdrop-blur-sm">
                      <MapPin size={13} />
                      <span className="text-[12px] font-normal">{job.location.city}</span>
                    </div>

                    {/* Høyre side: Redigeringsikon */}
                    <div
                      className="px-2 py-1.5 bg-[#D9D9D9]/80 backdrop-blur-sm rounded-2xl cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(job);
                      }}
                    >
                      <Pencil size={20} className="text-custom-green" />
                    </div>
                  </div>
                </div>

                {/* Tittel */}
                <div className="gap-3 p-4">
                  <h2 className="text-custom-black whitespace-nowrap overflow-hidden text-ellipsis font-bold text-[20px]">
                    {job.title}
                  </h2>

                  <p className="text-custom-black text-base font-light line-clamp-2">
                    {job.description}
                  </p>
                </div>

                {/* Jobbdetaljer */}
                <div className="flex justify-between p-4 pt-0">
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-1">
                      <Clock4 size={13} />
                      <h3 className="m-0 whitespace-nowrap overflow-hidden text-ellipsis text-[12px] font-normal">
                        {job.duration.value
                          ? `${job.duration.value} ${job.duration.unit}`
                          : 'Ikke angitt'}
                      </h3>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Opprettet: {new Date(job.createdAt).toLocaleDateString('no-NO')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-[24px] font-bold">{job.price}Kr</p>
                    <Button
                      label="Slett"
                      className="bg-red-500! rounded-xl px-3 py-1 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(job._id);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
