import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Users, Search } from 'lucide-react';
import { useMyApplicantsOverviewQuery } from '../../features/applicants/hooks';
import EmptyState from '../../components/Ui/EmptyState';

const MyApplicantsOverview: React.FC = () => {
  const navigate = useNavigate();
  const { data: services, isLoading, error } = useMyApplicantsOverviewQuery();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredServices = useMemo(() => {
    if (!services) return [];

    let filtered = [...services];

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((service) => {
        const matchesTitle = service.title.toLowerCase().includes(lowercasedQuery);
        const matchesWorker =
          service.selectedWorker &&
          service.selectedWorker.name.toLowerCase().includes(lowercasedQuery);
        const matchesCategory =
          service.categories &&
          service.categories.some((cat: string) => cat.toLowerCase().includes(lowercasedQuery));
        return matchesTitle || matchesWorker || matchesCategory;
      });
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [services, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f0e8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  if (error || !services) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Kunne ikke laste oversikt</h2>
        <button onClick={() => navigate(-1)} className="text-custom-green font-medium">
          Gå tilbake
        </button>
      </div>
    );
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'I GANG';
      case 'open':
        return 'AKTIV';
      case 'completed':
        return 'FULLFØRT';
      case 'awaiting_payment':
        return 'VENTER PÅ BETALING';
      case 'waiting_for_approval':
        return 'VENTER PÅ GODKJENNING';
      default:
        return 'AVSLUTTET';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-600';
      case 'open':
        return 'bg-green-100 text-green-600';
      case 'awaiting_payment':
        return 'bg-yellow-100 text-yellow-700';
      case 'waiting_for_approval':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] py-8 px-4 md:px-6">
      <div className="max-w-[1024px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mine søkere</h1>

        <div className="mb-6">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Søk etter jobbnavn, arbeider eller kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-custom-green bg-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredServices.map((service: any) => (
            <div
              key={service._id}
              onClick={() => navigate(`/job-applicants/${service._id}`)}
              className="bg-white rounded-[20px] p-4 md:p-6 cursor-pointer hover:shadow-md transition-shadow border border-black/5"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusColor(
                        service.status
                      )}`}
                    >
                      {getStatusText(service.status)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{service.title}</h3>
                </div>

                <div className="flex items-center gap-6 ml-4">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center -space-x-2 mb-1">
                      {service.applicantAvatars.slice(0, 3).map((avatar: string, i: number) => (
                        <img
                          key={i}
                          src={avatar}
                          alt=""
                          className="w-7 h-7 rounded-full border-2 border-white object-cover bg-gray-200"
                        />
                      ))}
                      {service.applicantCount > 0 && service.applicantAvatars.length === 0 && (
                        <div className="w-7 h-7 rounded-full border-2 border-white bg-custom-green flex items-center justify-center">
                          <Users size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[15px] font-bold text-gray-900">
                        {service.applicantCount}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">
                        Søkere
                      </span>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-[15px] font-bold text-gray-900">
                      {service.price.toLocaleString('no-NO')} kr
                    </div>
                  </div>

                  <div className="text-gray-300">
                    <ChevronRight size={24} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredServices.length === 0 && (
            <div className="bg-white rounded-2xl border border-black/5">
              <EmptyState
                type="jobs"
                title="Ingen oppdrag"
                description="Ingen oppdrag å vise i denne oversikten."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyApplicantsOverview;
