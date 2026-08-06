import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Locate, MapPin } from 'lucide-react';
import { useTopUsers } from '../../features/profile/hooks';
import { useUserStore } from '../../stores/userStore';
import { reverseGeocode } from '../../utils/reverseGeocode';

const PAGE_SIZE = 12;

const getInitials = (name: string, lastName?: string) =>
  `${name.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();

const renderStars = (rating: number) => {
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += i < Math.floor(rating) || (i === Math.floor(rating) && rating % 1 >= 0.5) ? '★' : '☆';
  }
  return stars;
};

const getViewerLocation = async (profile: {
  postNumber?: string;
  postSted?: string;
  address?: string;
}) => {
  if ('geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        })
      );
      const geo = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      if (geo?.postNumber || geo?.city || geo?.address) {
        return { postNumber: geo.postNumber, postSted: geo.city, address: geo.address };
      }
    } catch {
      // fall back to profile address
    }
  }
  return {
    postNumber: profile.postNumber,
    postSted: profile.postSted,
    address: profile.address,
  };
};

const RecommendedTaskersPage = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [viewerLocation, setViewerLocation] = useState<{
    postNumber?: string;
    postSted?: string;
    address?: string;
  }>(() => ({
    postNumber: user?.postNumber,
    postSted: user?.postSted,
    address: user?.address,
  }));
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    let cancelled = false;
    getViewerLocation({
      postNumber: user?.postNumber,
      postSted: user?.postSted,
      address: user?.address,
    }).then((loc) => {
      if (!cancelled && (loc.postNumber || loc.postSted || loc.address)) {
        setViewerLocation(loc);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useTopUsers(1, limit, viewerLocation);

  const taskers = data?.data || [];
  const pagination = data?.pagination;
  const hasMore = pagination ? taskers.length < pagination.total : false;
  const hasLocation = !!viewerLocation.postNumber;

  return (
    <div className="bg-[#f5f0e8] min-h-screen py-4 px-3 sm:py-5 sm:px-5">
      <div className="max-w-[860px] mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-black/8 flex items-center justify-center hover:bg-black/5 cursor-pointer"
            >
              <ArrowLeft size={18} className="text-[#1a1a1a]" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-medium text-[#1a1a1a]">
                Anbefalte oppdragstakere
              </h1>
              <p className="text-xs sm:text-sm text-[#777] flex items-center gap-1">
                {hasLocation ? (
                  <>
                    <MapPin size={12} />
                    Oppdragstakere nær {viewerLocation.postSted || 'deg'}
                  </>
                ) : (
                  'Oppdragstakere nær deg'
                )}
              </p>
            </div>
          </div>
          {pagination && (
            <span className="text-xs text-[#777] shrink-0">
              {taskers.length} av {pagination.total}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#16a34a]" size={32} />
            <p className="mt-3 text-sm text-[#777]">Laster oppdragstakere...</p>
          </div>
        ) : taskers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#777] text-sm">Ingen oppdragstakere funnet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {taskers.map((worker: any, index) => {
                const fullName = `${worker.name} ${worker.lastName || ''}`;
                const rating = worker.averageRating || 0;
                const count = worker.reviewCount || 0;
                return (
                  <div
                    key={worker._id}
                    onClick={() => navigate(`/profile/${worker._id}`)}
                    className="bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] p-3 sm:p-3.5 flex gap-2.5 sm:gap-3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] rounded-full bg-[#f0faf0] text-[#166534] text-[14px] sm:text-sm font-medium flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {worker.avatarUrl ? (
                        <img
                          src={worker.avatarUrl}
                          alt={fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(worker.name, worker.lastName)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                        <span className="text-xs sm:text-sm font-medium text-[#1a1a1a] truncate">
                          {fullName}
                        </span>
                        {worker.nearby ? (
                          <span className="text-[8px] sm:text-[9px] text-[#166534] bg-[#dcfce7] rounded-full px-1.5 sm:px-[6px] py-0.5 sm:py-[2px] border border-[#bbf7d0] whitespace-nowrap flex-shrink-0">
                            Nær deg
                          </span>
                        ) : (
                          index === 0 && (
                            <span className="text-[8px] sm:text-[9px] text-[#92400e] bg-[#fef9c3] rounded-full px-1.5 sm:px-[6px] py-0.5 sm:py-[2px] border border-[#fde68a] whitespace-nowrap flex-shrink-0">
                              Anbefalt
                            </span>
                          )
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-[#888] mb-0.5 truncate">
                        {worker.skills?.slice(0, 3).join(' · ') || 'Oppdragstaker'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-[#ca8a04]">
                        {renderStars(rating)}{' '}
                        <span className="text-[#888]">
                          {rating.toFixed(1)} ({count} oppdrag)
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-[#1a1a1a] mt-0.5 sm:mt-1 truncate flex items-center gap-1">
                        {worker.hourlyRate ? `${worker.hourlyRate} kr/t` : 'Tilgjengelig'} ·{' '}
                        {worker.postSted || worker.locations?.[0] || 'Norge'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="px-6 py-2.5 bg-[#16a34a] text-white text-sm font-medium rounded-full hover:bg-[#15803d] transition-colors cursor-pointer"
                >
                  Last flere
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecommendedTaskersPage;
