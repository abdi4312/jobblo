import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
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
  AlertCircle,
  Locate,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { Slider } from 'antd';
import { JobCard } from '../../components/component/jobCard/JobCard';
import { JobCardSkeleton } from '../../components/Loading/JobCardSkeleton';
import { CARD, GREEN, LINE, MICRO_LABEL, PILL_PRIMARY } from '../../theme/brand';
const MapComponent = lazy(() =>
  import('../../components/component/map/MapComponent').then((module) => ({
    default: module.MapComponent,
  }))
);
import { useJobs } from '../../features/jobsList/hooks';
import { useFilterOptions } from '../../features/jobsList/filterHooks';
import { getLocationTree, getLocationStats, type LocationNode } from '../../api/locationAPI';

/**
 * The tick in the area tree.
 *
 * It used to be a real `<input type="checkbox" readOnly>` inside a clickable `<div>` — an
 * input that could be focused but never operated, in a container that was not a control at
 * all. The rows are buttons now, so the state is drawn rather than inputted, and the button
 * itself carries the semantics.
 */
const Box = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden="true"
    className={`flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] border transition-colors ${
      checked ? 'border-[#2E6641] bg-[#2E6641] text-white' : 'border-[#D4D6CD] bg-white'
    }`}
  >
    {checked && <Check size={11} strokeWidth={3.5} />}
  </span>
);

const ServiceListing = () => {
  const { categoryName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const locationState = location.state as { lat?: number; lng?: number } | null;
  const initialSearch =
    searchParams.get('search') || searchParams.get('q') || searchParams.get('query') || '';
  const decodedCategoryName = categoryName ? decodeURIComponent(categoryName) : undefined;

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState({
    label: 'Nyeste først',
    value: 'newest',
  });
  const [localSearch, setLocalSearch] = useState(initialSearch);

  useEffect(() => {
    const currentSearch =
      searchParams.get('search') || searchParams.get('q') || searchParams.get('query') || '';
    setLocalSearch(currentSearch);
  }, [searchParams]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    decodedCategoryName && decodedCategoryName !== 'all' ? [decodedCategoryName] : []
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [shouldUseLocation, setShouldUseLocation] = useState(true); // Track if we should use the initial location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Location to anchor search/map to: manual "Min posisjon" first, then hero-button location state
  const activeLocation =
    userLocation ??
    (shouldUseLocation && locationState?.lat != null && locationState?.lng != null
      ? { lat: locationState.lat, lng: locationState.lng }
      : null);

  // New location filter states
  const [locationTree, setLocationTree] = useState<LocationNode[]>([]);
  const [locationStats, setLocationStats] = useState<any>(null);
  const [selectedCountyCodes, setSelectedCountyCodes] = useState<string[]>([]);
  const [selectedMunicipalityCodes, setSelectedMunicipalityCodes] = useState<string[]>([]);
  const [selectedAreaCodes, setSelectedAreaCodes] = useState<string[]>([]);
  const [expandedCounties, setExpandedCounties] = useState<string[]>([]);
  const [expandedMunicipalities, setExpandedMunicipalities] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: filterOptions, isLoading: isFiltersLoading } = useFilterOptions();

  // Update selectedCategories when categoryName param changes
  useEffect(() => {
    if (decodedCategoryName && decodedCategoryName !== 'all') {
      setSelectedCategories([decodedCategoryName]);
    } else {
      setSelectedCategories([]);
    }
  }, [decodedCategoryName]);

  // Disable location filter when any filter changes (but keep the initial location on first load)
  const hasInteracted = useRef(false);
  useEffect(() => {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      return;
    }
    setShouldUseLocation(false);
  }, [
    selectedCategories,
    selectedLocations,
    selectedCountyCodes,
    selectedMunicipalityCodes,
    selectedAreaCodes,
    priceRange,
    isUrgent,
    selectedSort,
    initialSearch,
  ]);

  // Fetch location data on mount
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const [tree, stats] = await Promise.all([getLocationTree(), getLocationStats()]);
        setLocationTree(tree);
        setLocationStats(stats);
      } catch (err) {
        console.error('Failed to fetch location data:', err);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobs({
    categories: selectedCategories,
    locations: selectedLocations,
    // Smart county/municipality filter: if specific municipalities are selected under a county,
    // only send municipalityCodes (not the broad county), to avoid showing all county jobs.
    countyCodes: selectedCountyCodes.filter((countyCode) => {
      // Only send county code if NO municipalities from that county are individually selected
      const county = locationTree.find((c) => c.code === countyCode);
      if (!county?.children) return true;
      const munCodes = county.children.map((m) => m.code);
      const hasSpecificMun = munCodes.some((mc) => selectedMunicipalityCodes.includes(mc));
      return !hasSpecificMun; // exclude county if user drilled down to specific municipalities
    }),
    municipalityCodes: selectedMunicipalityCodes,
    areaCodes: selectedAreaCodes,
    search: initialSearch,
    sort: selectedSort.value,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    urgent: isUrgent,
    limit: 16,
    lat: activeLocation?.lat,
    lng: activeLocation?.lng,
    radius: activeLocation ? 5000 : undefined,
  });

  const jobs = data?.pages.flatMap((page) => page.data) || [];

  // Norwegian county/municipality center coordinates [lng, lat]
  const NORWAY_CENTERS: Record<string, [number, number]> = {
    '03': [10.7522, 59.9139],
    '11': [5.7331, 58.97],
    '15': [6.3648, 62.472],
    '18': [14.3747, 67.2804],
    '31': [11.395, 59.52],
    '32': [10.2052, 60.7945],
    '33': [9.0568, 60.2729],
    '34': [10.808, 61.1155],
    '39': [10.2323, 59.2816],
    '40': [8.7277, 59.4358],
    '42': [7.9964, 58.1599],
    '46': [5.3329, 60.3913],
    '50': [10.3951, 63.4305],
    '55': [18.9551, 69.6492],
    '56': [23.2594, 70.0712],
    '0301': [10.7522, 59.9139],
    '1103': [5.7331, 58.97],
    '1201': [5.322, 60.3913],
    '1601': [10.3951, 63.4305],
    '0101': [11.3883, 59.2836],
    '0106': [11.067, 59.1286],
    '4204': [7.9964, 58.1599],
    '1001': [7.9964, 58.1599],
    '1004': [7.5945, 58.0788],
    '1014': [7.1699, 58.1],
    '4601': [5.322, 60.3913],
    '5001': [10.3951, 63.4305],
    '0401': [11.0688, 60.7945],
  };

  // Derive map center from selected location filters
  const mapCoordinates = useMemo((): [number, number] => {
    // Priority: active location > area > municipality > county > first job > Oslo fallback
    if (activeLocation) return [activeLocation.lng, activeLocation.lat];
    if (selectedAreaCodes.length > 0) {
      const hit = NORWAY_CENTERS[selectedAreaCodes[0]];
      if (hit) return hit;
    }
    if (selectedMunicipalityCodes.length > 0) {
      const hit = NORWAY_CENTERS[selectedMunicipalityCodes[0]];
      if (hit) return hit;
    }
    if (selectedCountyCodes.length > 0) {
      const hit = NORWAY_CENTERS[selectedCountyCodes[0]];
      if (hit) return hit;
    }
    // Fall back to first job with coordinates
    const firstJob = jobs.find((j) => (j as any).location?.coordinates);
    if ((firstJob as any)?.location?.coordinates)
      return (firstJob as any).location.coordinates as [number, number];
    return [10.7522, 59.9139]; // Oslo
  }, [activeLocation, selectedAreaCodes, selectedMunicipalityCodes, selectedCountyCodes, jobs]);

  // Zoom radius: tighter when a specific area/municipality is selected
  const mapRadius = activeLocation
    ? 5000
    : selectedAreaCodes.length > 0
      ? 2000
      : selectedMunicipalityCodes.length > 0
        ? 5000
        : selectedCountyCodes.length > 0
          ? 20000
          : 5000;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const sortOptions = filterOptions?.sortOptions || [
    { label: 'Nyeste først', value: 'newest' },
    { label: 'Pris: lav til høy', value: 'price_low' },
    { label: 'Pris: høy til lav', value: 'price_high' },
    { label: 'Mest relevant', value: 'relevant' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({
      ...Object.fromEntries(searchParams),
      search: localSearch,
    });
  };

  const navigate = useNavigate();

  // Common "Alle / All categories" aliases — if the filter-options API ever
  // ships a synthetic Alle/Alle kategorier/All placeholder, strip it so we
  // don't render two Alle rows. Deduped via const below, reused in render.
  const ALL_CATEGORY_ALIASES = new Set([
    'alle',
    'all',
    'alle kategorier',
    'all categories',
    'ingen',
  ]);
  const filterCategories = useMemo(() => {
    const cats = filterOptions?.categories || [];
    return cats.filter(
      (c: any) =>
        !ALL_CATEGORY_ALIASES.has(
          String(c?.name || '')
            .toLowerCase()
            .trim()
        )
    );
  }, [filterOptions?.categories]);

  // Total count shown next to "Alle" = sum of all top-level category counts
  // (matches the existing cat.count shown on each row; falls back to 0 when loading)
  const allCategoryCount = useMemo(() => {
    if (!filterOptions?.categories?.length) return 0;
    return filterOptions.categories.reduce(
      (sum: number, c: any) => sum + (Number(c?.count) || 0),
      0
    );
  }, [filterOptions?.categories]);

  const toggleCategory = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  // Clear category selection + URL path param; preserve every other filter
  // (price range, sort, location, urgent) and every existing search param.
  const clearCategoryFilter = () => {
    setSelectedCategories([]);
    // If we are on a named-category route (/search/job/Rengjøring etc.), move
    // to /search/job/all (the app's canonical "no filter" path). Otherwise we
    // already have no path param, so nothing to change.
    if (decodedCategoryName && decodedCategoryName !== 'all') {
      const qs = searchParams.toString();
      const target = qs.length ? `/search/job/all?${qs}` : `/search/job/all`;
      navigate(target, { replace: true });
    }
  };

  const toggleExpand = (catId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // New location toggle functions
  const toggleCounty = (countyCode: string) => {
    const isSelected = selectedCountyCodes.includes(countyCode);

    if (isSelected) {
      // Deselect county and all its municipalities/areas
      setSelectedCountyCodes((prev) => prev.filter((c) => c !== countyCode));
      const county = locationTree.find((c) => c.code === countyCode);
      if (county?.children) {
        const munCodes = county.children.map((m) => m.code);
        setSelectedMunicipalityCodes((prev) => prev.filter((m) => !munCodes.includes(m)));
        const areaCodes = county.children.flatMap((m) => m.children?.map((a) => a.code) || []);
        setSelectedAreaCodes((prev) => prev.filter((a) => !areaCodes.includes(a)));
      }
      // Collapse
      setExpandedCounties((prev) => prev.filter((c) => c !== countyCode));
    } else {
      // Select county (shows all jobs in that county) — but DON'T auto-select sub-municipalities
      setSelectedCountyCodes((prev) => [...prev, countyCode]);
      // Just expand to show sub-items (user can optionally drill down)
      setExpandedCounties((prev) => (prev.includes(countyCode) ? prev : [...prev, countyCode]));
    }
  };

  const toggleMunicipality = (municipalityCode: string) => {
    const isSelected = selectedMunicipalityCodes.includes(municipalityCode);

    if (isSelected) {
      // Deselect municipality and its areas
      setSelectedMunicipalityCodes((prev) => prev.filter((m) => m !== municipalityCode));
      // Remove any areas under this municipality
      const parentCounty = locationTree.find((c) =>
        c.children?.some((m) => m.code === municipalityCode)
      );
      const municipality = parentCounty?.children?.find((m) => m.code === municipalityCode);
      if (municipality?.children) {
        const areaCodes = municipality.children.map((a) => a.code);
        setSelectedAreaCodes((prev) => prev.filter((a) => !areaCodes.includes(a)));
      }
      // Collapse
      setExpandedMunicipalities((prev) => prev.filter((m) => m !== municipalityCode));
    } else {
      // Select municipality (shows jobs in that municipality)
      setSelectedMunicipalityCodes((prev) => [...prev, municipalityCode]);
      // Expand to show areas if they exist
      const parentCounty = locationTree.find((c) =>
        c.children?.some((m) => m.code === municipalityCode)
      );
      const municipality = parentCounty?.children?.find((m) => m.code === municipalityCode);
      if (municipality?.children && municipality.children.length > 0) {
        setExpandedMunicipalities((prev) =>
          prev.includes(municipalityCode) ? prev : [...prev, municipalityCode]
        );
      }
    }
  };

  const toggleArea = (areaCode: string) => {
    setSelectedAreaCodes((prev) =>
      prev.includes(areaCode) ? prev.filter((a) => a !== areaCode) : [...prev, areaCode]
    );
  };

  const toggleCountyExpand = (countyCode: string) => {
    setExpandedCounties((prev) =>
      prev.includes(countyCode) ? prev.filter((c) => c !== countyCode) : [...prev, countyCode]
    );
  };

  const toggleMunicipalityExpand = (municipalityCode: string) => {
    setExpandedMunicipalities((prev) =>
      prev.includes(municipalityCode)
        ? prev.filter((m) => m !== municipalityCode)
        : [...prev, municipalityCode]
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

  // ── Filter drawer, mobile ──────────────────────────────────────────────────
  // Two flags rather than one: the panel has to be in the DOM for a frame at its
  // off-screen position before the class that slides it in is applied, or the browser
  // has nothing to animate from. On the way out the unmount waits for the transition.
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false);

  useEffect(() => {
    if (isFilterDrawerOpen) {
      setDrawerMounted(true);
      const frame = requestAnimationFrame(() => setDrawerShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setDrawerShown(false);
    const timer = setTimeout(() => setDrawerMounted(false), 300);
    return () => clearTimeout(timer);
  }, [isFilterDrawerOpen]);

  // Escape closes it, and the page behind stops scrolling while it is open.
  useEffect(() => {
    if (!isFilterDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsFilterDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [isFilterDrawerOpen]);

  // ── Active filters ─────────────────────────────────────────────────────────
  const hasPriceFilter = priceRange.min !== 0 || priceRange.max !== 100000;
  const areaCount =
    selectedCountyCodes.length + selectedMunicipalityCodes.length + selectedAreaCodes.length;
  const activeFilterCount =
    selectedCategories.length + areaCount + (isUrgent ? 1 : 0) + (hasPriceFilter ? 1 : 0);

  /** Name for a county/municipality/area code, for the removable chips. */
  const areaName = (code: string) => {
    for (const county of locationTree) {
      if (county.code === code) return county.name;
      for (const municipality of county.children || []) {
        if (municipality.code === code) return municipality.name;
        const area = municipality.children?.find((a) => a.code === code);
        if (area) return area.name;
      }
    }
    return code;
  };

  const clearAllFilters = () => {
    setSelectedCountyCodes([]);
    setSelectedMunicipalityCodes([]);
    setSelectedAreaCodes([]);
    setSelectedLocations([]);
    setIsUrgent(false);
    setPriceRange({ min: 0, max: 100000 });
    clearCategoryFilter();
  };

  /** One row per active filter, each able to remove just itself. */
  const activeChips: { key: string; label: string; remove: () => void }[] = [
    ...selectedCategories.map((name) => ({
      key: `cat-${name}`,
      label: name,
      remove: () =>
        selectedCategories.length === 1 ? clearCategoryFilter() : toggleCategory(name),
    })),
    ...selectedCountyCodes.map((code) => ({
      key: `county-${code}`,
      label: areaName(code),
      remove: () => toggleCounty(code),
    })),
    ...selectedMunicipalityCodes.map((code) => ({
      key: `mun-${code}`,
      label: areaName(code),
      remove: () => toggleMunicipality(code),
    })),
    ...selectedAreaCodes.map((code) => ({
      key: `area-${code}`,
      label: areaName(code),
      remove: () => toggleArea(code),
    })),
    ...(isUrgent ? [{ key: 'urgent', label: 'Haster', remove: () => setIsUrgent(false) }] : []),
    ...(hasPriceFilter
      ? [
          {
            key: 'price',
            label: `${priceRange.min.toLocaleString('nb-NO')}–${
              priceRange.max === 100000 ? '∞' : priceRange.max.toLocaleString('nb-NO')
            } kr`,
            remove: handlePriceReset,
          },
        ]
      : []),
  ];

  // ── Shared class strings for this page ─────────────────────────────────────
  /** A sidebar block: a label, then its controls. No card, no shadow. */
  const FILTER_SECTION = 'border-t border-[#E6E7E1] pt-6 first:border-t-0 first:pt-0';
  /** A row in the category or area tree. */
  const TREE_ROW =
    'flex-1 rounded-lg px-2.5 py-1.5 text-left text-[0.875rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25';
  const COUNT_PILL = 'ml-auto shrink-0 text-[0.75rem] tabular-nums';

  const renderFilterSidebarContent = () => (
    <div className="space-y-6">
      {/* ── Haster ─────────────────────────────────────────────────────────── */}
      <section className={FILTER_SECTION}>
        <button
          type="button"
          role="switch"
          aria-checked={isUrgent}
          onClick={() => setIsUrgent(!isUrgent)}
          className="flex w-full items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
        >
          <span className="flex items-center gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isUrgent ? 'bg-[#122A1C] text-white' : 'bg-[#EAF1E9] text-[#2E6641]'
              }`}
            >
              <Zap size={16} strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[0.9375rem] font-semibold text-[#0B0B0B]">Haster</span>
              <span className="block text-[0.8125rem] text-[#63665F]">Vis kun hasteoppdrag</span>
            </span>
          </span>
          <span
            className={`h-6 w-11 shrink-0 rounded-full p-0.75 transition-colors duration-200 ${
              isUrgent ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
            }`}
          >
            <span
              className={`block size-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isUrgent ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </section>

      {/* ── Kategorier ─────────────────────────────────────────────────────── */}
      <section className={FILTER_SECTION}>
        <h3 className={`${MICRO_LABEL} mb-3`}>Kategorier</h3>
        <div className="space-y-0.5">
          {isFiltersLoading ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="jb-skeleton h-7 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Alle (All categories) — first option, default when none selected */}
              <div className="flex items-center gap-1">
                <button
                  onClick={clearCategoryFilter}
                  className={`${TREE_ROW} flex items-center gap-2 ${
                    selectedCategories.length === 0
                      ? 'bg-[#EAF1E9] font-semibold text-[#2E6641]'
                      : 'text-[#0B0B0B] hover:bg-[#F4F6F0]'
                  }`}
                >
                  Alle
                  <span
                    className={`${COUNT_PILL} ${
                      selectedCategories.length === 0 ? 'text-[#2E6641]' : 'text-[#9B9E96]'
                    }`}
                  >
                    {allCategoryCount || 0}
                  </span>
                </button>
                {/* Alle has no subcategories — keep the rows below aligned with a spacer */}
                <div className="size-7 shrink-0" />
              </div>

              {filterCategories.length === 0 ? (
                <p className="pt-2 text-[0.875rem] text-[#9B9E96]">Ingen kategorier funnet</p>
              ) : (
                filterCategories.map((cat) => (
                  <div key={cat._id}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleCategory(cat.name)}
                        className={`${TREE_ROW} flex items-center gap-2 ${
                          selectedCategories.includes(cat.name)
                            ? 'bg-[#EAF1E9] font-semibold text-[#2E6641]'
                            : 'text-[#0B0B0B] hover:bg-[#F4F6F0]'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span
                          className={`${COUNT_PILL} ${
                            selectedCategories.includes(cat.name)
                              ? 'text-[#2E6641]'
                              : 'text-[#9B9E96]'
                          }`}
                        >
                          {cat.count || 0}
                        </span>
                      </button>
                      {cat.subcategories && cat.subcategories.length > 0 ? (
                        <button
                          onClick={() => toggleExpand(cat._id)}
                          aria-label={`Vis underkategorier for ${cat.name}`}
                          aria-expanded={expandedCategories.includes(cat._id)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#9B9E96] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
                        >
                          {expandedCategories.includes(cat._id) ? (
                            <ChevronDown size={15} />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                        </button>
                      ) : (
                        <div className="size-7 shrink-0" />
                      )}
                    </div>
                    {expandedCategories.includes(cat._id) && (
                      <div className="ml-3.5 space-y-0.5 border-l border-[#E6E7E1] pl-2.5">
                        {cat.subcategories.map((sub) => (
                          <button
                            key={sub._id}
                            onClick={() => toggleCategory(sub.name)}
                            className={`${TREE_ROW} flex w-full items-center gap-2 ${
                              selectedCategories.includes(sub.name)
                                ? 'bg-[#EAF1E9] font-semibold text-[#2E6641]'
                                : 'text-[#63665F] hover:bg-[#F4F6F0] hover:text-[#0B0B0B]'
                            }`}
                          >
                            <span className="truncate">{sub.name}</span>
                            <span
                              className={`${COUNT_PILL} ${
                                selectedCategories.includes(sub.name)
                                  ? 'text-[#2E6641]'
                                  : 'text-[#9B9E96]'
                              }`}
                            >
                              {sub.count || 0}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Kart ───────────────────────────────────────────────────────────── */}
      <section className={FILTER_SECTION}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className={MICRO_LABEL}>Kart</h3>
          <button
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 rounded-full text-[0.8125rem] font-semibold text-[#2E6641] transition-colors hover:text-[#347028] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25 disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Locate size={13} strokeWidth={2.2} />
            )}
            {isLocating ? 'Henter…' : 'Min posisjon'}
          </button>
        </div>
        <div className="relative h-45 w-full overflow-hidden rounded-2xl border border-[#E6E7E1]">
          <Suspense fallback={<div className="jb-skeleton size-full" />}>
            <MapComponent coordinates={mapCoordinates} circleRadius={mapRadius} />
          </Suspense>
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[0.6875rem] font-semibold text-[#63665F] shadow-sm backdrop-blur-sm">
            <MapIcon size={11} strokeWidth={2.2} className="text-[#2E6641]" />
            Oppdrag nær deg
          </span>
        </div>
      </section>

      {/* ── Område ─────────────────────────────────────────────────────────── */}
      <section className={FILTER_SECTION}>
        <h3 className={`${MICRO_LABEL} mb-3`}>Område</h3>
        <div className="custom-scrollbar max-h-96 space-y-0.5 overflow-y-auto pr-1">
          {isLoadingLocations ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="jb-skeleton h-7 rounded-lg" />
              ))}
            </div>
          ) : locationTree.length === 0 ? (
            <p className="text-[0.875rem] text-[#9B9E96]">Ingen områder funnet</p>
          ) : (
            locationTree.map((county) => (
              <div key={county.code}>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleCounty(county.code)}
                    className={`${TREE_ROW} flex items-center gap-2.5 ${
                      selectedCountyCodes.includes(county.code)
                        ? 'font-semibold text-[#2E6641]'
                        : 'text-[#0B0B0B] hover:bg-[#F4F6F0]'
                    }`}
                  >
                    <Box checked={selectedCountyCodes.includes(county.code)} />
                    <span className="truncate">{county.name}</span>
                    {locationStats && (
                      <span className={`${COUNT_PILL} text-[#9B9E96]`}>
                        {locationStats.counties[county.code] || 0}
                      </span>
                    )}
                  </button>
                  {county.children && county.children.length > 0 ? (
                    <button
                      onClick={() => toggleCountyExpand(county.code)}
                      aria-label={`Vis kommuner i ${county.name}`}
                      aria-expanded={expandedCounties.includes(county.code)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#9B9E96] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
                    >
                      {expandedCounties.includes(county.code) ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>
                  ) : (
                    <div className="size-7 shrink-0" />
                  )}
                </div>

                {/* Municipalities */}
                {expandedCounties.includes(county.code) && county.children && (
                  <div className="ml-3.5 space-y-0.5 border-l border-[#E6E7E1] pl-2.5">
                    {county.children.map((municipality) => (
                      <div key={municipality.code}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleMunicipality(municipality.code)}
                            className={`${TREE_ROW} flex items-center gap-2.5 ${
                              selectedMunicipalityCodes.includes(municipality.code)
                                ? 'font-semibold text-[#2E6641]'
                                : 'text-[#63665F] hover:bg-[#F4F6F0] hover:text-[#0B0B0B]'
                            }`}
                          >
                            <Box checked={selectedMunicipalityCodes.includes(municipality.code)} />
                            <span className="truncate">{municipality.name}</span>
                            {locationStats && (
                              <span className={`${COUNT_PILL} text-[#9B9E96]`}>
                                {locationStats.municipalities[municipality.code] || 0}
                              </span>
                            )}
                          </button>
                          {municipality.children && municipality.children.length > 0 ? (
                            <button
                              onClick={() => toggleMunicipalityExpand(municipality.code)}
                              aria-label={`Vis områder i ${municipality.name}`}
                              aria-expanded={expandedMunicipalities.includes(municipality.code)}
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#9B9E96] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
                            >
                              {expandedMunicipalities.includes(municipality.code) ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </button>
                          ) : (
                            <div className="size-7 shrink-0" />
                          )}
                        </div>

                        {/* Areas */}
                        {expandedMunicipalities.includes(municipality.code) &&
                          municipality.children && (
                            <div className="ml-3.5 space-y-0.5 border-l border-[#E6E7E1] pl-2.5">
                              {municipality.children.map((area) => (
                                <button
                                  key={area.code}
                                  onClick={() => toggleArea(area.code)}
                                  className={`${TREE_ROW} flex w-full items-center gap-2.5 ${
                                    selectedAreaCodes.includes(area.code)
                                      ? 'font-semibold text-[#2E6641]'
                                      : 'text-[#63665F] hover:bg-[#F4F6F0] hover:text-[#0B0B0B]'
                                  }`}
                                >
                                  <Box checked={selectedAreaCodes.includes(area.code)} />
                                  <span className="truncate">{area.name}</span>
                                  {locationStats && (
                                    <span className={`${COUNT_PILL} text-[#9B9E96]`}>
                                      {locationStats.areas[area.code] || 0}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Pris ───────────────────────────────────────────────────────────── */}
      <section className={FILTER_SECTION}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className={MICRO_LABEL}>Pris</h3>
          {hasPriceFilter && (
            <button
              onClick={handlePriceReset}
              className="text-[0.8125rem] font-semibold text-[#2E6641] transition-colors hover:text-[#347028] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
            >
              Nullstill
            </button>
          )}
        </div>

        <div className="px-1">
          <Slider
            range
            min={0}
            max={50000}
            step={100}
            value={[priceRange.min, priceRange.max > 50000 ? 50000 : priceRange.max]}
            onChange={(value: number[]) => {
              setPriceRange({
                min: value[0],
                max: value[1] === 50000 ? 100000 : value[1],
              });
            }}
            styles={{
              rail: { background: LINE },
              track: { background: GREEN },
              handle: {
                borderColor: GREEN,
                backgroundColor: '#fff',
                boxShadow: `0 0 0 2px ${GREEN}`,
              },
            }}
          />
          <div className="mt-5 flex gap-3">
            <label className="flex-1">
              <span className={`${MICRO_LABEL} mb-1.5 block`}>Fra</span>
              <span className="relative block">
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setPriceRange((prev) => ({ ...prev, min: val }));
                  }}
                  className="h-11 w-full rounded-xl border border-[#E6E7E1] bg-white pl-3 pr-8 text-[0.875rem] font-semibold tabular-nums text-[#0B0B0B] outline-none transition-colors focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.75rem] font-semibold text-[#9B9E96]">
                  kr
                </span>
              </span>
            </label>
            <label className="flex-1">
              <span className={`${MICRO_LABEL} mb-1.5 block`}>Til</span>
              <span className="relative block">
                <input
                  type="number"
                  value={priceRange.max === 100000 ? '' : priceRange.max}
                  onChange={(e) => {
                    const val =
                      e.target.value === '' ? 100000 : Math.max(0, parseInt(e.target.value) || 0);
                    setPriceRange((prev) => ({ ...prev, max: val }));
                  }}
                  placeholder="∞"
                  className="h-11 w-full rounded-xl border border-[#E6E7E1] bg-white pl-3 pr-8 text-[0.875rem] font-semibold tabular-nums text-[#0B0B0B] outline-none transition-colors placeholder:text-[#9B9E96] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.75rem] font-semibold text-[#9B9E96]">
                  kr
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>
    </div>
  );

  const headingText =
    initialSearch.trim() ||
    (decodedCategoryName && decodedCategoryName !== 'all' ? decodedCategoryName : 'Alle oppdrag');

  return (
    <div className="min-h-screen bg-[#EFF0EA]">
      {/* ── Mobile filter drawer ─────────────────────────────────────────────
          Outside the sticky toolbar below on purpose. A `backdrop-blur` ancestor
          becomes the containing block for `position: fixed` children, which pins a
          drawer to the toolbar instead of the viewport. */}
      {drawerMounted && (
        <div className="fixed inset-0 z-1000 lg:hidden" role="dialog" aria-modal="true">
          <div
            onClick={() => setIsFilterDrawerOpen(false)}
            className={`absolute inset-0 bg-[#0B0B0B]/45 transition-opacity duration-300 ${
              drawerShown ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute inset-y-0 left-0 flex w-[86%] max-w-88 flex-col bg-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
              drawerShown ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#E6E7E1] px-5">
              <h2 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                Filtrer
              </h2>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                aria-label="Lukk filtre"
                className="flex size-9 items-center justify-center rounded-full text-[#63665F] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              {renderFilterSidebarContent()}
            </div>

            <div className="shrink-0 border-t border-[#E6E7E1] bg-white p-4">
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className={`${PILL_PRIMARY} w-full`}
              >
                Vis {jobs.length}
                {hasNextPage ? '+' : ''} oppdrag
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="mt-2 h-10 w-full rounded-full text-[0.875rem] font-semibold text-[#63665F] transition-colors hover:text-[#0B0B0B]"
                >
                  Nullstill alle filtre
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Search, sticky ───────────────────────────────────────────────────
          The old bar put a 32 px-wide icon box at `left: 32px` over an input padded
          to 48 px, so the caret and the icon occupied the same pixels and typing ran
          straight through the magnifier. The icon is inside the padding now, and the
          field owns a submit control rather than relying on an unlabelled Enter. */}
      {/* `top-18` and `z-30`, not `top-0`/`z-40`: the app header is itself `sticky top-0
          z-40` and 72 px tall, so this parks directly beneath it rather than sliding under
          it. */}
      <div className="sticky top-18 z-30 border-b border-[#E6E7E1] bg-[#EFF0EA]/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-300 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="relative flex h-12 shrink-0 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 lg:hidden"
            >
              <SlidersHorizontal size={17} strokeWidth={2} className="text-[#2E6641]" />
              <span className="hidden min-[420px]:inline">Filtrer</span>
              {activeFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-[#2E6641] text-[0.6875rem] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <form onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1">
              <Search
                size={17}
                strokeWidth={2.2}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9B9E96]"
              />
              <input
                type="search"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                aria-label="Søk etter oppdrag"
                placeholder={
                  decodedCategoryName && decodedCategoryName !== 'all'
                    ? `Søk i ${decodedCategoryName}`
                    : 'Søk etter oppdrag'
                }
                className="h-12 w-full rounded-full border border-[#E6E7E1] bg-white pl-11 pr-24 text-[0.9375rem] text-[#0B0B0B] outline-none transition-colors placeholder:text-[#9B9E96] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {localSearch && (
                <button
                  type="button"
                  aria-label="Tøm søket"
                  onClick={() => {
                    setLocalSearch('');
                    setSearchParams({
                      ...Object.fromEntries(searchParams),
                      search: '',
                    });
                  }}
                  className="absolute right-13 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[#9B9E96] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              )}
              <button
                type="submit"
                aria-label="Søk"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#2E6641] text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95"
              >
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
            </form>

            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                aria-haspopup="listbox"
                aria-expanded={isSortOpen}
                className="flex h-12 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
              >
                <ArrowUpDown size={16} strokeWidth={2} className="text-[#2E6641]" />
                <span className="hidden md:inline">{selectedSort.label}</span>
              </button>

              {isSortOpen && (
                <div
                  role="listbox"
                  className={`${CARD} absolute right-0 z-100 mt-2 w-60 overflow-hidden p-1.5 shadow-[0_18px_48px_rgba(11,11,11,0.12)]`}
                >
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      role="option"
                      aria-selected={selectedSort.value === option.value}
                      onClick={() => {
                        setSelectedSort(option);
                        setIsSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-[0.875rem] transition-colors ${
                        selectedSort.value === option.value
                          ? 'bg-[#EAF1E9] font-semibold text-[#2E6641]'
                          : 'text-[#0B0B0B] hover:bg-[#F4F6F0]'
                      }`}
                    >
                      <span>{option.label}</span>
                      {selectedSort.value === option.value && (
                        <Check size={15} strokeWidth={2.6} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-300 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          {/* ── Sidebar, desktop ─────────────────────────────────────────── */}
          <aside className="hidden w-70 shrink-0 lg:block">
            {/* Clears the 72 px header and the 72 px search bar stacked above it. */}
            <div className="sticky top-40 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
              <div className="mb-6 flex items-center justify-between gap-2">
                <h2 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                  Filtrer
                </h2>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[0.8125rem] font-semibold text-[#2E6641] transition-colors hover:text-[#347028]"
                  >
                    Nullstill ({activeFilterCount})
                  </button>
                )}
              </div>
              {renderFilterSidebarContent()}
            </div>
          </aside>

          {/* ── Results ──────────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1">
            <div className="mb-5">
              <h1 className="text-[clamp(1.5rem,3.6vw,2.25rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
                {headingText}
              </h1>
              <p className="mt-1.5 text-[0.875rem] text-[#63665F]">
                {isLoading
                  ? 'Henter oppdrag…'
                  : `${jobs.length}${hasNextPage ? '+' : ''} oppdrag funnet`}
              </p>
            </div>

            {/* Active filters, each removable on its own */}
            {activeChips.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={chip.remove}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#2E6641]/30 bg-[#EAF1E9] pl-3.5 pr-2.5 text-[0.8125rem] font-medium text-[#2E6641] transition-colors hover:border-[#2E6641]/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                  >
                    {chip.label}
                    <X size={13} strokeWidth={2.6} aria-label={`Fjern ${chip.label}`} />
                  </button>
                ))}
                <button
                  onClick={clearAllFilters}
                  className="ml-1 text-[0.8125rem] font-semibold text-[#63665F] underline-offset-[3px] transition-colors hover:text-[#0B0B0B] hover:underline"
                >
                  Nullstill alle
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <JobCardSkeleton key={index} />
                ))}
              </div>
            ) : isError ? (
              <div className={`${CARD} mx-auto max-w-lg p-10 text-center`}>
                <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
                  <AlertCircle size={20} strokeWidth={2} />
                </span>
                <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">
                  Kunne ikke laste søkeresultater
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
                  {error instanceof Error
                    ? error.message
                    : 'Det oppstod en feil under henting av oppdrag.'}
                </p>
                <button onClick={() => refetch()} className={`${PILL_PRIMARY} mt-6`}>
                  Prøv igjen
                </button>
              </div>
            ) : jobs.length === 0 ? (
              <div className={`${CARD} mx-auto max-w-lg p-10 text-center`}>
                <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
                  <Search size={20} strokeWidth={2} />
                </span>
                <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">
                  Ingen oppdrag funnet
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
                  Prøv et annet søkeord, eller fjern noen av filtrene dine.
                </p>
                {activeFilterCount > 0 && (
                  <button onClick={clearAllFilters} className={`${PILL_PRIMARY} mt-6`}>
                    Nullstill filtre
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4">
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
                  <div className="mt-10 flex items-center justify-center gap-2.5 text-[0.875rem] text-[#63665F]">
                    <Loader2 size={16} className="animate-spin text-[#2E6641]" />
                    Henter flere oppdrag…
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ServiceListing;
