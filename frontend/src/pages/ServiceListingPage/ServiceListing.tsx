import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Loader2,
  Map as MapIcon,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Tag,
} from "lucide-react";
import { Slider } from "antd";
import { JobCard } from "../../components/component/jobCard/JobCard";
import { MapComponent } from "../../components/component/map/MapComponent";
import { useJobs } from "../../features/jobsList/hooks";
import { useFilterOptions } from "../../features/jobsList/filterHooks";

const ServiceListing = () => {
  const { categoryName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState({
    label: "Nyeste først",
    value: "newest",
  });
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    categoryName && categoryName !== "all" ? [categoryName] : [],
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: filterOptions, isLoading: isFiltersLoading } =
    useFilterOptions();

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobs({
    categories: selectedCategories,
    locations: selectedLocations,
    search: initialSearch,
    sort: selectedSort.value,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    limit: 16,
  });

  const jobs = data?.pages.flatMap((page) => page.data) || [];

  const filteredLocations = useMemo(() => {
    if (!filterOptions?.locations) return [];
    if (!locationSearch.trim()) return filterOptions.locations;

    return filterOptions.locations.filter((loc) =>
      loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
    );
  }, [filterOptions?.locations, locationSearch]);

  const sortOptions = filterOptions?.sortOptions || [
    { label: "Nyeste først", value: "newest" },
    { label: "Pris: lav til høy", value: "price_low" },
    { label: "Pris: høy til lav", value: "price_high" },
    { label: "Mest relevant", value: "relevant" },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({
      ...Object.fromEntries(searchParams),
      search: localSearch,
    });
  };

  const toggleCategory = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName)
        ? prev.filter((c) => c !== catName)
        : [...prev, catName],
    );
  };

  const toggleLocation = (locName: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locName)
        ? prev.filter((l) => l !== locName)
        : [...prev, locName],
    );
  };

  const toggleExpand = (catId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId],
    );
  };

  // Infinite scroll logic using Intersection Observer
  const observer = useRef<IntersectionObserver>();
  const lastJobElementRef = (node: HTMLDivElement) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  };

  const handlePriceReset = () => {
    setPriceRange({ min: 0, max: 100000 });
  };

  const FilterSidebarContent = () => (
    <div className="space-y-8">
      {/* 1. Categories & Subcategories */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-5 text-gray-900">Kategorier</h3>
        <div className="space-y-2">
          {isFiltersLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Laster...</span>
            </div>
          ) : filterOptions?.categories.length === 0 ? (
            <p className="text-sm text-gray-400">Ingen kategorier funnet</p>
          ) : (
            filterOptions?.categories.map((cat) => (
              <div key={cat._id} className="space-y-1">
                <div className="flex items-center justify-between group">
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className={`flex-1 text-left font-medium py-2 px-3 rounded-xl transition-all duration-200 ${
                      selectedCategories.includes(cat.name)
                        ? "bg-[#2F7E4711] text-[#2F7E47]"
                        : "text-gray-700 hover:bg-gray-50 hover:text-[#2F7E47]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {cat.name}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          selectedCategories.includes(cat.name)
                            ? "bg-[#2F7E4722] text-[#2F7E47]"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {cat.count || 0}
                      </span>
                    </span>
                  </button>
                  {cat.subcategories && cat.subcategories.length > 0 && (
                    <button
                      onClick={() => toggleExpand(cat._id)}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        expandedCategories.includes(cat._id)
                          ? "bg-[#2F7E4711] text-[#2F7E47]"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                    >
                      {expandedCategories.includes(cat._id) ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </button>
                  )}
                </div>
                {expandedCategories.includes(cat._id) && (
                  <div className="pl-3 space-y-1 ml-3 border-l-2 border-[#2F7E4722]">
                    {cat.subcategories.map((sub) => (
                      <button
                        key={sub._id}
                        onClick={() => toggleCategory(sub.name)}
                        className={`w-full text-left py-2 px-3 rounded-xl text-sm transition-all duration-200 ${
                          selectedCategories.includes(sub.name)
                            ? "bg-[#2F7E4711] text-[#2F7E47] font-semibold"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {sub.name}
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              selectedCategories.includes(sub.name)
                                ? "bg-[#2F7E4722] text-[#2F7E47]"
                                : "bg-gray-100 text-gray-300"
                            }`}
                          >
                            {sub.count || 0}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. Map View Link/Button */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:border-[#2F7E4733] transition-all cursor-pointer group overflow-hidden">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] group-hover:scale-105 transition-transform z-10">
              <MapIcon className="text-[#2F7E47]" size={28} strokeWidth={1.5} />
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-900">Kartvisning</h4>
              <p className="text-sm text-gray-500 font-medium">
                Utforsk oppdrag nær deg
              </p>
            </div>
          </div>

          {/* Real Map Preview */}
          <div className="w-full h-[180px] rounded-2xl overflow-hidden relative border border-gray-50 group-hover:border-[#ff8a7a]/20 transition-all">
            <MapComponent
              coordinates={[10.7522, 59.9139]} // Default to Oslo center for preview
              circleRadius={5000} // 5km radius
            />
            {/* Overlay to catch clicks and prevent map interaction inside sidebar */}
            <div className="absolute inset-0 bg-transparent z-50 cursor-pointer" />

            {/* Norway zoom-like overlay style from reference */}
            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm border border-gray-100 z-[60] flex flex-col gap-1">
              <div className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold text-sm">
                +
              </div>
              <div className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold text-sm">
                -
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Locations/Areas */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-4">Area</h3>
        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            placeholder="Narrow search"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-[#ff8a7a]/20 outline-none"
          />
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
          {isFiltersLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : filteredLocations.length === 0 ? (
            <p className="text-sm text-gray-400">No areas found</p>
          ) : (
            filteredLocations.map((loc) => (
              <label
                key={loc.name}
                className="flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(loc.name)}
                    onChange={() => toggleLocation(loc.name)}
                    className="w-5 h-5 rounded-md border-gray-300 text-[#ff8a7a] focus:ring-[#ff8a7a]"
                  />
                  <span
                    className={`text-sm transition-colors ${selectedLocations.includes(loc.name) ? "text-gray-900 font-bold" : "text-gray-600 group-hover:text-gray-900"}`}
                  >
                    {loc.name}
                  </span>
                </div>
                <span className="text-[10px] text-gray-300">({loc.count})</span>
              </label>
            ))
          )}
        </div>
      </section>
      {/* 4. Price Filter */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="text-gray-900" size={20} />
            <h3 className="text-xl font-bold">Price</h3>
          </div>
          {(priceRange.min !== 0 || priceRange.max !== 100000) && (
            <button
              onClick={handlePriceReset}
              className="text-sm font-bold text-[#ff8a7a] hover:text-[#e57a6a] transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="px-2">
          <Slider
            range
            min={0}
            max={50000}
            step={100}
            value={[
              priceRange.min,
              priceRange.max > 50000 ? 50000 : priceRange.max,
            ]}
            onChange={(value: number[]) => {
              setPriceRange({
                min: value[0],
                max: value[1] === 50000 ? 100000 : value[1],
              });
            }}
            styles={{
              track: {
                background: "#ff8a7a",
              },
              handle: {
                borderColor: "#ff8a7a",
                backgroundColor: "#fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              },
            }}
          />
          <div className="flex justify-between items-center mt-2 text-sm text-gray-500 font-medium">
            <span>Min: {priceRange.min} kr</span>
            <span>
              Max: {priceRange.max >= 50000 ? "∞" : `${priceRange.max} kr`}
            </span>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-5 pb-10 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6 md:gap-8 mt-6 md:mt-8">
        {/* MOBILE OVERLAY DRAWER */}
        {isFilterDrawerOpen && (
          <div className="fixed inset-0 z-[1000] lg:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsFilterDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-left duration-300">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Filters</h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X size={24} />
                </button>
              </div>
              <FilterSidebarContent />
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="w-full bg-[#ff8a7a] text-white font-bold py-4 rounded-2xl mt-8 shadow-lg shadow-[#ff8a7a]/20"
              >
                Show Results
              </button>
            </div>
          </div>
        )}

        {/* LEFT SIDEBAR - Desktop only */}
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <FilterSidebarContent />
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1">
          {/* SEARCH & SORT HEADER */}
          <div className="flex flex-row items-center gap-0 sm:gap-3 mb-6 md:mb-10">
            {/* 1. Filter Button (Mobile only) */}
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="lg:hidden flex items-center justify-center bg-white w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.06)] hover:bg-gray-50 transition-all active:scale-95 flex-shrink-0"
            >
              <SlidersHorizontal size={22} className="text-[#ff8a7a]" />
            </button>

            {/* 2. Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="relative flex-1 group"
            >
              <div className="absolute left-8 top-1/2 -translate-y-1/2 text-[#2F7E47] transition-all duration-200 z-10 flex items-center justify-center w-8 h-8">
                <Search size={20} strokeWidth={2} />
              </div>
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={categoryName || "Search..."}
                className="w-full pl-12 pr-12 h-12 sm:h-14 bg-white rounded-full text-sm sm:text-base shadow-[0_4px_25px_rgba(0,0,0,0.06)] border-2 border-transparent focus:border-[#ff8a7a]/10 focus:ring-4 focus:ring-[#ff8a7a]/5 outline-none transition-all placeholder:text-gray-300 text-gray-900 font-normal no-underline decoration-transparent"
                style={{ textDecoration: "none" }}
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch("");
                    setSearchParams({
                      ...Object.fromEntries(searchParams),
                      search: "",
                    });
                  }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full text-[#2F7E47] transition-colors"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              )}
            </form>

            {/* 3. Sort Button */}
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-center bg-white w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.06)] cursor-pointer transition-all hover:bg-gray-50 active:scale-95"
              >
                <ArrowUpDown size={22} className="text-[#2F7E47]" />
              </button>

              {isSortOpen && (
                <div className="absolute right-0 mt-3 w-64 md:w-72 bg-white rounded-[24px] md:rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.15)]
                 overflow-hidden z-[100] p-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedSort(option);
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 md:px-6 md:py-4 rounded-[18px] md:rounded-[24px] text-left font-bold text-sm md:text-[17px] transition-colors ${
                        selectedSort.value === option.value
                          ? "bg-[#2F7E4711] text-[#2F7E47]"
                          : "text-[#0A0A0A] hover:bg-gray-50"
                      }`}
                    >
                      <span>{option.label}</span>
                      {selectedSort.value === option.value && (
                        <Check size={18} className="text-[#2F7E47]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grid of JobCards */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-[#ff8a7a] mb-4" size={48} />
              <p className="text-gray-500 font-medium">Laster tjenester...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-20">
              <p className="text-red-500 font-bold text-xl">
                Kunne ikke laste data.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-[#ff8a7a] text-white px-6 py-2 rounded-full font-bold"
              >
                Prøv igjen
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={40} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold text-xl">
                Ingen tjenester funnet.
              </p>
              <p className="text-gray-400 mt-2">
                Prøv å endre på filtrene dine eller søkeordet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-x-6 gap-y-10">
                {jobs.map((job, index) => {
                  if (jobs.length === index + 1) {
                    return (
                      <div ref={lastJobElementRef} key={job._id}>
                        <JobCard job={job} />
                      </div>
                    );
                  } else {
                    return <JobCard key={job._id} job={job} />;
                  }
                })}
              </div>

              {isFetchingNextPage && (
                <div className="flex justify-center mt-12">
                  <Loader2 className="animate-spin text-[#ff8a7a]" size={32} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ServiceListing;
