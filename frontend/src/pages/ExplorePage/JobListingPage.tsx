import { useState, useEffect } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useJobs } from "../../features/jobsList/hooks";
import { useCategories } from "../../features/categories/hooks";
import { useDashboardStats } from "../../features/explore/hooks";
import { useTopUsers } from "../../features/profile/hooks";
import { useUserStore } from "../../stores/userStore";
import * as Icons from "lucide-react";
import { MapPin, ShieldCheck, FileText, Star, Sprout } from "lucide-react";

// Helper function to map category icon names to actual icons
const getCategoryIcon = (cat: any) => {
  if (cat.icon) {
    const iconName = typeof cat.icon === "string" ? cat.icon : String(cat.icon);
    const Icon = (Icons as any)[iconName];
    if (Icon) return Icon;

    const iconMap: Record<string, any> = {
      BrushCleaning: Icons.Brush,
      Flower2: Icons.Sprout,
      Hammer: Icons.Hammer,
      Box: Icons.Package,
      Handshake: Icons.Handshake,
    };
    if (iconMap[iconName]) return iconMap[iconName];
  }

  const lowerName = cat.name.toLowerCase();
  if (
    lowerName.includes("håndverk") ||
    lowerName.includes("håndverker") ||
    lowerName.includes("oppussing")
  )
    return Icons.Wrench;
  if (lowerName.includes("maling")) return Icons.Paintbrush;
  if (lowerName.includes("rengjøring") || lowerName.includes("rense"))
    return Icons.Home;
  if (lowerName.includes("flytting") || lowerName.includes("flytt"))
    return Icons.Truck;
  if (lowerName.includes("hage") || lowerName.includes("hagearbeid"))
    return Icons.Sprout;
  if (
    lowerName.includes("it") ||
    lowerName.includes("nettverk") ||
    lowerName.includes("pc")
  )
    return Icons.Laptop;
  if (lowerName.includes("transport")) return Icons.Package;
  if (lowerName.includes("rørlegger")) return Icons.Wrench;
  if (lowerName.includes("småjobber")) return Icons.Handshake;
  return Icons.MoreHorizontal;
};

export default function JobListingPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  const navigate = useNavigate();
  const { user } = useUserStore();

  const initialState = location.state as {
    selectedCategory?: string;
    searchQuery?: string;
  } | null;

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialState?.selectedCategory ? [initialState.selectedCategory] : [],
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    initialState?.searchQuery || "",
  );
  const [isUrgentOnly, setIsUrgentOnly] = useState<boolean>(false);

  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategories([categoryFromUrl]);
    } else if (initialState?.selectedCategory) {
      setSelectedCategories([initialState.selectedCategory]);
    }
  }, [categoryFromUrl, initialState?.selectedCategory]);

  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: jobsData, isLoading: jobsLoading } = useJobs({
    categories: selectedCategories,
    search: searchQuery,
    urgent: isUrgentOnly,
    tab: "Discover",
  });
  const { data: categoriesData } = useCategories();
  const { data: statsData } = useDashboardStats();
  const { data: topUsersData } = useTopUsers();

  const jobs = jobsData?.pages.flatMap((page) => page.data) || [];
  const categories = categoriesData?.slice(0, 8) || [];

  const getInitials = (name: string, lastName?: string) => {
    return `${name.charAt(0)}${lastName ? lastName.charAt(0) : ""}`.toUpperCase();
  };

  const renderStars = (rating: number) => {
    let stars = "";
    for (let i = 0; i < 5; i++) {
      if (i < Math.floor(rating)) {
        stars += "★";
      } else if (i === Math.floor(rating) && rating % 1 >= 0.5) {
        stars += "★";
      } else {
        stars += "☆";
      }
    }
    return stars;
  };

  const recommendedWorkers =
    topUsersData?.slice(0, 4).map((user, index) => ({
      _id: (user as any)._id,
      initials: getInitials(user.name, user.lastName),
      name: `${user.name} ${user.lastName || ""}`,
      role: user.skills?.slice(0, 3).join(" · ") || "Oppdragstaker",
      rating: user.averageRating,
      count: user.reviewCount,
      rate: user.hourlyRate ? `${user.hourlyRate} kr/t` : "Tilgjengelig",
      location: user.locations?.[0] || "Norge",
      sponsored: index === 0,
      avatarUrl: user.avatarUrl,
    })) || [];

  const userName = user?.name || "Gust";

  return (
    <div className="bg-[#f5f0e8] py-4 px-3 sm:py-5 sm:px-5">
      <div className="max-w-[860px] mx-auto">
        {/* Hero Section */}
        <div className="bg-[#1a3a1a] rounded-[12px] sm:rounded-[16px] p-4 sm:p-6 mb-4 sm:mb-5
        flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-normal text-white leading-[1.35] mb-1">
              God morgen, {userName}.
              <br />
              Hva trenger du hjelp med
              <em className="text-[#4ade80] not-italic">i dag?</em>
            </h2>
            <p className="text-xs text-white/55 mb-3 sm:mb-4">
              5 nye oppdrag i nærheten av Oslo siden i går
            </p>
            <button className="px-4 sm:px-[18px] py-2 sm:py-[9px] bg-transparent text-white border
             border-white/50 rounded-full text-xs sm:text-sm cursor-pointer">
              Se alle oppdrag nær meg
            </button>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <div>
              <strong className="block text-base sm:text-lg font-medium text-white">
                {statsData?.activeJobs
                  ? `${statsData.activeJobs > 1000 ? (statsData.activeJobs / 1000).toFixed(0) + "k+" : statsData.activeJobs + "+"}`
                  : "5 000+"}
              </strong>
              <span className="text-xs text-white/50">Aktive oppdrag</span>
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-medium text-white">
                {statsData?.totalUsers
                  ? `${statsData.totalUsers > 1000 ? (statsData.totalUsers / 1000).toFixed(0) + "k+" : statsData.totalUsers + "+"}`
                  : "15k+"}
              </strong>
              <span className="text-xs text-white/50">Brukere</span>
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-medium text-white">
                {statsData?.averageRating
                  ? statsData.averageRating.toFixed(1)
                  : "4.8"}
              </strong>
              <span className="text-xs text-white/50">Snittrating</span>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h3 className="text-sm font-medium text-[#1a1a1a]">Kategorier</h3>
          <button
            onClick={() => navigate("/search/job/all")}
            className="text-xs text-[#16a34a] no-underline bg-transparent border-none cursor-pointer"
          >
            Se alle
          </button>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-4 sm:mb-5 overflow-x-auto">
          <div
            key="all"
            className={`bg-white border rounded-[10px] sm:rounded-[12px] p-2 sm:p-3 flex flex-col items-center gap-1 cursor-pointer hover:border-[#16a34a] transition-colors min-w-max ${selectedCategories.length === 0 ? "border-[#16a34a] bg-[#f0faf0]" : "border-black/8"}`}
            onClick={() => setSelectedCategories([])}
          >
            <Icons.LayoutGrid size={18} className="text-[#16a34a]" />
            <span className="text-[10px] sm:text-xs text-[#555] text-center whitespace-nowrap">
              Alle
            </span>
          </div>

          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat);
            const isSelected = selectedCategories.includes(cat.name);
            return (
              <div
                key={cat._id}
                className={`bg-white border rounded-[10px] sm:rounded-[12px] p-2 sm:p-3 flex flex-col items-center gap-1 cursor-pointer hover:border-[#16a34a] transition-colors min-w-max ${isSelected ? "border-[#16a34a] bg-[#f0faf0]" : "border-black/8"}`}
                onClick={() => setSelectedCategories([cat.name])}
              >
                <Icon size={18} className="text-[#16a34a]" />
                <span className="text-[10px] sm:text-xs text-[#555] text-center whitespace-nowrap">
                  {cat.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Jobs Section */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h3 className="text-sm font-medium text-[#1a1a1a]">
            Oppdrag nær deg – Oslo
          </h3>
          <button
            onClick={() => navigate("/search/job/all")}
            className="text-xs text-[#16a34a] no-underline bg-transparent border-none cursor-pointer"
          >
            Se alle
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {jobsLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] overflow-hidden animate-pulse"
                >
                  <div className="h-[70px] sm:h-[90px] bg-gray-200" />
                  <div className="p-2 sm:p-[10px_12px]">
                    <div className="h-3 sm:h-4 bg-gray-200 rounded mb-0.5 sm:mb-1 w-3/4" />
                    <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1.5 sm:mb-2 w-1/2" />
                    <div className="flex justify-between items-center">
                      <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-4 sm:h-5 bg-gray-200 rounded-full w-16 sm:w-20" />
                    </div>
                  </div>
                </div>
              ))
            : jobs.length > 0
              ? jobs.slice(0, 6).map((job: any) => (
                  <div
                    key={job._id}
                    className={`bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] overflow-hidden cursor-pointer ${job.promoted ? "border-[1.5px] border-[#ca8a04]" : ""}`}
                    onClick={() => navigate(`/job-listing/${job._id}`)}
                  >
                    <div className="h-[70px] sm:h-[90px] bg-[#f0faf0] flex items-center justify-center overflow-hidden">
                      {job.images && job.images[0] ? (
                        <img
                          src={job.images[0]}
                          alt={job.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Sprout
                          size={28}
                          className="text-[#16a34a] sm:w-9 sm:h-9"
                        />
                      )}
                    </div>
                    <div className="p-2 sm:p-[10px_12px]">
                      <div className="flex items-start justify-between gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                        <div className="text-xs sm:text-sm font-medium text-[#1a1a1a] leading-tight line-clamp-2">
                          {job.title}
                        </div>
                        {job.promoted && (
                          <span className="text-[8px] sm:text-[9px] text-[#92400e] bg-[#fef9c3] rounded-full px-1.5 sm:px-[6px] py-0.5 sm:py-[2px] border border-[#fde68a] whitespace-nowrap flex-shrink-0">
                            Sponset
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-[#888] mb-1.5 sm:mb-2 flex items-center gap-0.5 sm:gap-1">
                        <MapPin size={8} sm={10} />
                        {job.location?.city || job.location?.address || "Norge"}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium text-[#1a1a1a]">
                          {typeof job.price === "number"
                            ? job.price.toLocaleString()
                            : job.price}{" "}
                          kr
                        </span>
                        <span className="flex items-center gap-0.5 sm:gap-1 bg-[#f0faf0] rounded-full px-1.5 sm:px-[7px] py-0.5 sm:py-[2px] text-[10px] sm:text-xs text-[#166534] font-medium">
                          <ShieldCheck size={9} sm={11} />
                          SafePay
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              : null}
        </div>

        {/* Recommended Workers Section */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h3 className="text-sm font-medium text-[#1a1a1a]">
            Anbefalte oppdragstakere nær deg
          </h3>
          <button
            onClick={() => navigate("/search/job/all")}
            className="text-xs text-[#16a34a] no-underline bg-transparent border-none cursor-pointer"
          >
            Se alle
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {recommendedWorkers.map((worker, index) => (
            <div
              key={index}
              className={`bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] p-3 sm:p-3.5 flex gap-2.5 sm:gap-3 cursor-pointer hover:shadow-md transition-all ${worker.sponsored ? "border-[1.5px] border-[#ca8a04]" : ""}`}
              onClick={() => {
                if ((worker as any)._id) {
                  navigate(`/profile/${(worker as any)._id}`);
                }
              }}
            >
              <div className="w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] rounded-full bg-[#f0faf0] text-[#166534] text-[14px] sm:text-sm font-medium flex items-center justify-center flex-shrink-0 overflow-hidden">
                {worker.avatarUrl ? (
                  <img
                    src={worker.avatarUrl}
                    alt={worker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  worker.initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                  <span className="text-xs sm:text-sm font-medium text-[#1a1a1a] truncate">
                    {worker.name}
                  </span>
                  {worker.sponsored && (
                    <span className="text-[8px] sm:text-[9px] text-[#92400e] bg-[#fef9c3] rounded-full px-1.5 sm:px-[6px] py-0.5 sm:py-[2px] border border-[#fde68a] whitespace-nowrap flex-shrink-0">
                      Sponset
                    </span>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-[#888] mb-0.5 truncate">
                  {worker.role}
                </div>
                <div className="text-[10px] sm:text-xs text-[#ca8a04]">
                  {renderStars(worker.rating)}{" "}
                  <span className="text-[#888]">
                    {worker.rating} ({worker.count} oppdrag)
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-[#1a1a1a] mt-0.5 sm:mt-1 truncate">
                  {worker.rate} · {worker.location}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Section */}
        <div className="bg-white border border-black/8 rounded-[12px] sm:rounded-[14px] p-3 sm:p-4 md:px-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-2.5">
            <ShieldCheck
              className="text-[#16a34a] flex-shrink-0 mt-0.5"
              size={18}
            />
            <div>
              <div className="text-xs sm:text-sm font-medium text-[#1a1a1a] mb-0.5 sm:mb-1">
                Trygg betaling med SafePay
              </div>
              <div className="text-[10px] sm:text-xs text-[#777] leading-relaxed">
                Pengene holdes sikkert til jobben er godkjent. Du betaler aldri
                for noe du ikke er fornøyd med.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-2.5">
            <FileText
              className="text-[#16a34a] flex-shrink-0 mt-0.5"
              size={18}
            />
            <div>
              <div className="text-xs sm:text-sm font-medium text-[#1a1a1a] mb-0.5 sm:mb-1">
                Automatisk kontrakt
              </div>
              <div className="text-[10px] sm:text-xs text-[#777] leading-relaxed">
                Hver avtale genererer en digital kontrakt som beskytter både deg
                og oppdragstakeren.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-2.5">
            <Star className="text-[#16a34a] flex-shrink-0 mt-0.5" size={18} />
            <div>
              <div className="text-xs sm:text-sm font-medium text-[#1a1a1a] mb-0.5 sm:mb-1">
                Verifiserte ratings
              </div>
              <div className="text-[10px] sm:text-xs text-[#777] leading-relaxed">
                Alle anmeldelser er fra ekte fullførte oppdrag. Du ser alltid
                hvem du leier inn.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
