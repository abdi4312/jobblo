import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFavoriteLists } from "../../features/favoriteLists/hooks";
import { useCategories } from "../../features/categories/hooks";
import {
  useSearchUsers,
  useTopUsers,
  useUnifiedSearch,
  useInfiniteSearch,
} from "../../features/profile/hooks";
import { useUserStore } from "../../stores/userStore";
import { useSearchHistory } from "../../hooks/useSearchHistory";

// Refactored Components
import { SearchInput } from "./Search/SearchInput";
import { SearchTabs } from "./Search/SearchTabs";
import { HistorySection } from "./Search/HistorySection";
import { TopResults } from "./Search/TopResults";
import { InfiniteResults } from "./Search/InfiniteResults";
import { DefaultResults } from "./Search/DefaultResults";

function SearchComponent() {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Top");
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom Hook for search history management
  const { searchHistory, saveToHistory, clearHistory } = useSearchHistory();
  const user = useUserStore((state) => state.user);

  // --- Data Fetching ---

  // Fetch favorite lists for the logged-in user
  const { data: favoriteLists, isLoading: isListsLoading } = useFavoriteLists(
    user?._id,
  );

  // Fetch all categories
  const { data: categories, isLoading: isCategoriesLoading } = useCategories();

  // Unified Search for Top results (Categories, People, Lists)
  const { data: searchResults, isLoading: isSearching } =
    useUnifiedSearch(searchQuery);

  // Infinite Search for specific tab views
  const infiniteType =
    activeTab === "Categories"
      ? "categories"
      : activeTab === "People"
        ? "people"
        : activeTab === "Lists"
          ? "lists"
          : "";
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isInfiniteLoading,
  } = useInfiniteSearch(searchQuery, infiniteType, 10);

  const infiniteResults =
    infiniteData?.pages.flatMap((page) => page.results) || [];

  // Old search hook (kept for compatibility)
  useSearchUsers(
    activeTab === "People" && searchQuery.length >= 2 ? searchQuery : undefined,
  );

  // Fetch top users for default display
  const { data: topPeople, isLoading: isTopLoading } = useTopUsers();

  const people =
    searchQuery.length >= 2
      ? activeTab === "Top"
        ? searchResults?.people?.results
        : infiniteResults
      : topPeople;

  const isPeopleLoading =
    searchQuery.length >= 2
      ? activeTab === "Top"
        ? isSearching
        : isInfiniteLoading
      : isTopLoading;

  // --- Handlers ---

  const handleItemClick = (item: any) => {
    if (item.type === "query" || item.type === "category") {
      setSearchQuery(item.title);
      if (item.type === "query") {
        navigate(`/search/job/all?search=${item.title}`);
      } else {
        navigate(`/search/job/${item.title}`);
      }
    } else {
      navigate(`/profile/${item.id}`);
    }
    setIsDropdownOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabs = [
    { label: "Topp", value: "Top" },
    { label: "Kategorier", value: "Categories" },
    { label: "Personer", value: "People" },
    { label: "Lister", value: "Lists" },
  ];

  return (
    <div className="relative w-full max-w-5xl mx-auto" ref={dropdownRef}>
      {/* Search Bar Input */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        onFocus={() => setIsDropdownOpen(true)}
      />

      {/* Search Dropdown Overlay */}
      {isDropdownOpen && (
        <div className="absolute top-22 left-0 right-0 bg-white border border-gray-100 rounded-4xl shadow-2xl z-50 p-2 sm:p-6 pt-2 max-h-120 overflow-auto transition-all duration-300 ease-in-out">
          {/* Tab Navigation */}
          <SearchTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={tabs}
          />

          {/* Results Container */}
          <div className="px-6 space-y-10 pb-6 max-h-150 overflow-y-auto custom-scrollbar">
            {searchQuery.length >= 2 ? (
              <div className="space-y-10">
                {activeTab === "Top" ? (
                  <TopResults
                    searchQuery={searchQuery}
                    isSearching={isSearching}
                    searchResults={searchResults}
                    onSaveToHistory={saveToHistory}
                    onNavigate={navigate}
                    onCloseDropdown={() => setIsDropdownOpen(false)}
                    onSeeAll={setActiveTab}
                  />
                ) : (
                  <InfiniteResults
                    activeTab={activeTab}
                    searchQuery={searchQuery}
                    isInfiniteLoading={isInfiniteLoading}
                    infiniteResults={infiniteResults}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                    onSaveToHistory={saveToHistory}
                    onNavigate={navigate}
                    onCloseDropdown={() => setIsDropdownOpen(false)}
                    onBackToTop={() => setActiveTab("Top")}
                  />
                )}
              </div>
            ) : (
              <>
                {/* Default display when no query is typed */}
                <DefaultResults
                  activeTab={activeTab}
                  user={user}
                  isListsLoading={isListsLoading}
                  favoriteLists={favoriteLists}
                  isCategoriesLoading={isCategoriesLoading}
                  categories={categories}
                  isPeopleLoading={isPeopleLoading}
                  people={people}
                  onNavigate={navigate}
                  onCloseDropdown={() => setIsDropdownOpen(false)}
                  onSaveToHistory={saveToHistory}
                />

                {/* Search History (only shown on Top tab or default) */}
                {activeTab === "Top" && (
                  <HistorySection
                    history={searchHistory}
                    onClear={clearHistory}
                    onItemClick={handleItemClick}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchComponent;
