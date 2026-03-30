import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input as AppInput } from "../Ui/Input";
import { Search, SlidersHorizontal, Tag, User } from "lucide-react";
import * as Icons from "lucide-react";
import { useFavoriteLists } from "../../features/favoriteLists/hooks";
import { useCategories } from "../../features/categories/hooks";
import {
    useSearchUsers,
    useTopUsers,
    useUnifiedSearch,
    useInfiniteSearch,
} from "../../features/profile/hooks";
import { useUserStore } from "../../stores/userStore";

interface HistoryItem {
    id: string;
    type: "query" | "user" | "category";
    title: string;
    subtitle?: string;
    avatarUrl?: string;
    iconName?: string;
}

function search() {
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("Top");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const user = useUserStore((state) => state.user);

    // Load search history from localStorage
    useEffect(() => {
        const history = localStorage.getItem("search_history_v2");
        if (history) {
            setSearchHistory(JSON.parse(history));
        }
    }, []);

    const saveToHistory = (item: HistoryItem) => {
        const newHistory = [
            item,
            ...searchHistory.filter((h) => h.id !== item.id),
        ].slice(0, 5);
        setSearchHistory(newHistory);
        localStorage.setItem("search_history_v2", JSON.stringify(newHistory));
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem("search_history_v2");
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (searchQuery.trim()) {
            const query = searchQuery.trim();
            saveToHistory({
                id: `query-${query}`,
                type: "query",
                title: query,
                subtitle: "Brand search",
            });
            navigate(`/search/job/all?search=${query}`);
            setIsDropdownOpen(false);
        }
    };

    // Fetch favorite lists
    const { data: favoriteLists, isLoading: isListsLoading } = useFavoriteLists(
        user?._id,
    );

    // Fetch categories
    const { data: categories, isLoading: isCategoriesLoading } = useCategories();

    // Unified Search for Categories, People, and Lists (Top 3 for each)
    const { data: searchResults, isLoading: isSearching } =
        useUnifiedSearch(searchQuery);

    // Infinite Search for specific tabs
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

    // Flatten infinite search results
    const infiniteResults =
        infiniteData?.pages.flatMap((page) => page.results) || [];

    // Fetch search results (old hook, keeping for now to avoid breaking other logic)
    const { data: searchPeople, isLoading: isSearchLoading } = useSearchUsers(
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

    const tabs = ["Top", "Categories", "People", "Lists"];

    // Close dropdown when clicking outside
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

    return (
        <div className="relative w-full max-w-5xl mx-auto" ref={dropdownRef}>
            <div
                className={`gap-3 p-3 bg-white/40 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 w-full md:min-w-137.5 lg:min-w-[650px] transition-all duration-300`}
            >
                <div className="flex">
                    <AppInput
                        className="bg-transparent! outline-none! border-0 text-[20px] pl-12.5 w-full placeholder:text-gray-900"
                        placeholder="What are you looking for?"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsDropdownOpen(true)}
                        icon={<Search size={25} color="#0A0A0A" />}
                    />
                </div>
            </div>

            {/* Pop-up List (Dropdown) */}
            {isDropdownOpen && (
                <div className="absolute top-22 left-0 right-0 bg-white border border-gray-100 rounded-[32px] shadow-2xl z-50 p-2 sm:p-6 pt-2 max-h-120 overflow-auto transition-all duration-300 ease-in-out">
                    {/* Tabs */}
                    <div className="flex bg-[#F5F5F7] p-1.5 rounded-[24px] mb-8 w-full max-w-[560px] mx-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 px-4 rounded-[18px] text-[12px] sm:text-[16px] font-semibold transition-all duration-200 ${activeTab === tab
                                        ? "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-black"
                                        : "text-gray-500 hover:text-black"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Results Section */}
                    <div className="px-6 space-y-10 pb-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {searchQuery.length >= 2 ? (
                            <div className="space-y-10">
                                {activeTab === "Top" ? (
                                    <>
                                        {/* Search for "[query]" amongst all Jobs */}
                                        <div
                                            onClick={() => {
                                                saveToHistory({
                                                    id: `query-${searchQuery}`,
                                                    type: "query",
                                                    title: searchQuery,
                                                    subtitle: "Brand search",
                                                });
                                                navigate(`/search/job/all?search=${searchQuery}`);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-5 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all group"
                                        >
                                            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                                                <Search
                                                    size={24}
                                                    className="text-gray-900 group-hover:text-[#2F7E47] transition-colors"
                                                    strokeWidth={1.5}
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight">
                                                    Search for{" "}
                                                    <span className="text-[#2F7E47]">
                                                        "{searchQuery}"
                                                    </span>
                                                </h3>
                                                <p className="text-[15px] text-gray-500 font-medium mt-1">
                                                    Amongst all jobs
                                                </p>
                                            </div>
                                        </div>

                                        {isSearching ? (
                                            <div className="text-center py-10 text-gray-500">
                                                Searching...
                                            </div>
                                        ) : (
                                            <>
                                                {/* Categories Results (Top 3) */}
                                                {searchResults?.categories?.results?.length > 0 && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between px-2">
                                                            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
                                                                Categories
                                                            </h4>
                                                            {searchResults.categories.total > 3 && (
                                                                <button
                                                                    onClick={() => setActiveTab("Categories")}
                                                                    className="text-[14px] font-bold px-4 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                                                                >
                                                                    See all
                                                                </button>
                                                            )}
                                                        </div>
                                                        {searchResults.categories.results.map(
                                                            (cat: any) => {
                                                                const LucideIcon =
                                                                    (Icons as any)[cat.icon] || Icons.HelpCircle;
                                                                return (
                                                                    <div
                                                                        key={cat._id}
                                                                        onClick={() => {
                                                                            saveToHistory({
                                                                                id: cat._id,
                                                                                type: "category",
                                                                                title: cat.name,
                                                                                subtitle: "Category search",
                                                                                iconName: cat.icon,
                                                                            });
                                                                            navigate(`/search/job/${cat.name}`);
                                                                            setIsDropdownOpen(false);
                                                                        }}
                                                                        className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all group"
                                                                    >
                                                                        <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                                                                            <LucideIcon
                                                                                size={24}
                                                                                className="text-[#2F7E47]"
                                                                                strokeWidth={1.5}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-[15px] sm:text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                                                {cat.name}
                                                                            </h3>
                                                                            <p className="text-[15px] text-gray-500 font-medium mt-1">
                                                                                Interior & furniture
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                )}

                                                {/* People Results (Top 3) */}
                                                {searchResults?.people?.results?.length > 0 && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between px-2">
                                                            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
                                                                People
                                                            </h4>
                                                            {searchResults.people.total > 3 && (
                                                                <button
                                                                    onClick={() => setActiveTab("People")}
                                                                    className="text-[14px] font-bold px-4 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                                                                >
                                                                    See all
                                                                </button>
                                                            )}
                                                        </div>
                                                        {searchResults.people.results.map((p: any) => (
                                                            <div
                                                                key={p._id}
                                                                onClick={() => {
                                                                    saveToHistory({
                                                                        id: p._id,
                                                                        type: "user",
                                                                        title:
                                                                            `${p.name} ${p.lastName || ""}`.trim(),
                                                                        subtitle: p.name?.toLowerCase(),
                                                                        avatarUrl: p.avatarUrl,
                                                                    });
                                                                    navigate(`/profile/${p._id}`);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                                            >
                                                                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                                                    {p.avatarUrl ? (
                                                                        <img
                                                                            src={p.avatarUrl}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                                            <User
                                                                                className="text-gray-400"
                                                                                size={24}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                                        {p.name} {p.lastName}
                                                                    </h3>
                                                                    <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                                        @{p.name?.toLowerCase()}
                                                                        {p.lastName?.toLowerCase()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Lists Results (Top 3) */}
                                                {searchResults?.lists?.results?.length > 0 && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between px-2">
                                                            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
                                                                Public Lists
                                                            </h4>
                                                            {searchResults.lists.total > 3 && (
                                                                <button
                                                                    onClick={() => setActiveTab("Lists")}
                                                                    className="text-[14px] font-bold px-4 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                                                                >
                                                                    See all
                                                                </button>
                                                            )}
                                                        </div>
                                                        {searchResults.lists.results.map((list: any) => (
                                                            <div
                                                                key={list._id}
                                                                onClick={() => {
                                                                    navigate(`/favorites/list/${list._id}`);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                                            >
                                                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                                                                    {list.services && list.services[0]?.images ? (
                                                                        <img
                                                                            src={list.services[0].images[0]}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                                            <Tag
                                                                                className="text-gray-400"
                                                                                size={20}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                                        {list.name}
                                                                    </h3>
                                                                    <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                                        {list.services?.length || 0} adverts ·
                                                                        Public
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {!searchResults?.categories?.results?.length &&
                                                    !searchResults?.people?.results?.length &&
                                                    !searchResults?.lists?.results?.length && (
                                                        <div className="text-center py-10 text-gray-500">
                                                            No results found for "{searchQuery}"
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </>
                                ) : (
                                    /* Paginated/Infinite Search Results for Categories, People, or Lists */
                                    <div className="space-y-6">
                                        {/* Search for "[query]" amongst all Jobs (Added here too) */}
                                        <div
                                            onClick={() => {
                                                saveToHistory({
                                                    id: `query-${searchQuery}`,
                                                    type: "query",
                                                    title: searchQuery,
                                                    subtitle: "Brand search",
                                                });
                                                navigate(`/search/job/all?search=${searchQuery}`);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-5 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all group"
                                        >
                                            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                                                <Search
                                                    size={24}
                                                    className="text-gray-900 group-hover:text-[#2F7E47] transition-colors"
                                                    strokeWidth={1.5}
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight">
                                                    Search for{" "}
                                                    <span className="text-[#2F7E47]">
                                                        "{searchQuery}"
                                                    </span>
                                                </h3>
                                                <p className="text-[15px] text-gray-500 font-medium mt-1">
                                                    Amongst all jobs
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between px-2">
                                            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
                                                {activeTab} Search Results
                                            </h4>
                                            <button
                                                onClick={() => setActiveTab("Top")}
                                                className="text-[14px] font-bold px-4 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                                            >
                                                Back to Top
                                            </button>
                                        </div>

                                        {isInfiniteLoading ? (
                                            <div className="text-center py-10 text-gray-500">
                                                Searching {activeTab}...
                                            </div>
                                        ) : infiniteResults.length > 0 ? (
                                            <div className="space-y-4">
                                                {infiniteResults.map((item: any) => {
                                                    if (activeTab === "Categories") {
                                                        const LucideIcon =
                                                            (Icons as any)[item.icon] || Icons.HelpCircle;
                                                        return (
                                                            <div
                                                                key={item._id}
                                                                onClick={() => {
                                                                    saveToHistory({
                                                                        id: item._id,
                                                                        type: "category",
                                                                        title: item.name,
                                                                        subtitle: "Category search",
                                                                        iconName: item.icon,
                                                                    });
                                                                    navigate(`/search/job/${item.name}`);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all group"
                                                            >
                                                                <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                                                                    <LucideIcon
                                                                        size={24}
                                                                        className="text-[#2F7E47]"
                                                                        strokeWidth={1.5}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                                        {item.name}
                                                                    </h3>
                                                                    <p className="text-[15px] text-gray-500 font-medium mt-1">
                                                                        Explore {item.name}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (activeTab === "People") {
                                                        return (
                                                            <div
                                                                key={item._id}
                                                                onClick={() => {
                                                                    saveToHistory({
                                                                        id: item._id,
                                                                        type: "user",
                                                                        title:
                                                                            `${item.name} ${item.lastName || ""}`.trim(),
                                                                        subtitle: item.name?.toLowerCase(),
                                                                        avatarUrl: item.avatarUrl,
                                                                    });
                                                                    navigate(`/profile/${item._id}`);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                                            >
                                                                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                                                    {item.avatarUrl ? (
                                                                        <img
                                                                            src={item.avatarUrl}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                                            <User
                                                                                className="text-gray-400"
                                                                                size={24}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                                        {item.name} {item.lastName}
                                                                    </h3>
                                                                    <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                                        @{item.name?.toLowerCase()}
                                                                        {item.lastName?.toLowerCase()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (activeTab === "Lists") {
                                                        return (
                                                            <div
                                                                key={item._id}
                                                                onClick={() => {
                                                                    navigate(`/favorites/list/${item._id}`);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                                            >
                                                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                                                                    {item.services && item.services[0]?.images ? (
                                                                        <img
                                                                            src={item.services[0].images[0]}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                                            <Tag
                                                                                className="text-gray-400"
                                                                                size={20}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                                        {item.name}
                                                                    </h3>
                                                                    <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                                        {item.services?.length || 0} adverts ·
                                                                        Public
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })}

                                                {hasNextPage && (
                                                    <div className="flex justify-center pt-4">
                                                        <button
                                                            onClick={() => fetchNextPage()}
                                                            disabled={isFetchingNextPage}
                                                            className="text-[14px] font-bold px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {isFetchingNextPage
                                                                ? "Loading more..."
                                                                : "Load more"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-10 text-gray-500">
                                                No {activeTab.toLowerCase()} found for "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === "Lists" ? (
                            <div className="space-y-4">
                                {isListsLoading ? (
                                    <div className="text-center py-10 text-gray-500">
                                        Loading lists...
                                    </div>
                                ) : favoriteLists && favoriteLists.length > 0 ? (
                                    favoriteLists.map((list: any) => (
                                        <div
                                            key={list._id}
                                            onClick={() => {
                                                navigate(`/favorites/list/${list._id}`);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                        >
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                                                {list.services && list.services[0]?.images ? (
                                                    <img
                                                        src={list.services[0].images[0]}
                                                        alt={list.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                        <Tag className="text-gray-400" size={20} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                    {list.name}
                                                </h3>
                                                <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                    {list.services?.length || 0} adverts ·{" "}
                                                    {list.public ? "Public" : "Not public"}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500">
                                        No lists found.{" "}
                                        {user
                                            ? "Create one to see it here!"
                                            : "Login to see your lists."}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === "Categories" ? (
                            <div className="space-y-4">
                                {isCategoriesLoading ? (
                                    <div className="text-center py-10 text-gray-500">
                                        Loading categories...
                                    </div>
                                ) : categories && categories.length > 0 ? (
                                    categories.map((cat: any) => {
                                        const LucideIcon =
                                            (Icons as any)[cat.icon] || Icons.HelpCircle;
                                        return (
                                            <div
                                                key={cat._id}
                                                onClick={() => {
                                                    saveToHistory({
                                                        id: cat._id,
                                                        type: "category",
                                                        title: cat.name,
                                                        subtitle: "Category search",
                                                        iconName: cat.icon,
                                                    });
                                                    navigate(`/search/job/${cat.name}`);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                            >
                                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                                                    <LucideIcon
                                                        className="text-[#2F7E47]"
                                                        size={24}
                                                        strokeWidth={1.5}
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                        {cat.name}
                                                    </h3>
                                                    <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                        Explore {cat.name} tasks
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-10 text-gray-500">
                                        No categories found.
                                    </div>
                                )}
                            </div>
                        ) : activeTab === "People" ? (
                            <div className="space-y-4">
                                {isPeopleLoading ? (
                                    <div className="text-center py-10 text-gray-500">
                                        Loading people...
                                    </div>
                                ) : people && people.length > 0 ? (
                                    people.map((p: any) => (
                                        <div
                                            key={p._id}
                                            onClick={() => {
                                                saveToHistory({
                                                    id: p._id,
                                                    type: "user",
                                                    title: `${p.name} ${p.lastName || ""}`.trim(),
                                                    subtitle: p.name?.toLowerCase(),
                                                    avatarUrl: p.avatarUrl,
                                                });
                                                navigate(`/profile/${p._id}`);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group"
                                        >
                                            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                                {p.avatarUrl ? (
                                                    <img
                                                        src={p.avatarUrl}
                                                        alt={p.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                        <User className="text-gray-400" size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                                    {p.name} {p.lastName}
                                                </h3>
                                                <p className="text-[14px] text-gray-500 font-medium mt-1">
                                                    @{p.name?.toLowerCase()}
                                                    {p.lastName?.toLowerCase()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500">
                                        No people found.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* All Jobs */}
                                <div
                                    onClick={() => {
                                        navigate("/search/job/all");
                                        setIsDropdownOpen(false);
                                    }}
                                    className="flex items-center gap-6 cursor-pointer group"
                                >
                                    <div className="flex items-center justify-center">
                                        <SlidersHorizontal
                                            size={24}
                                            className="text-gray-900 group-hover:text-[#2F7E47] transition-colors"
                                            strokeWidth={1.5}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
                                            All Jobs
                                        </h3>
                                        <p className="text-[15px] text-gray-500 font-medium mt-1">
                                            See all Jobs
                                        </p>
                                    </div>
                                </div>

                                {/* Recently Searched Section */}
                                <div className="pt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[18px] font-semibold text-[#1A1A1A]">
                                            Recently searched
                                        </h4>
                                        {searchHistory.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    clearHistory();
                                                }}
                                                className="text-[14px] font-bold px-5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm text-black"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>

                                    {searchHistory.length > 0 ? (
                                        <div className="space-y-4">
                                            {searchHistory.map((item) => {
                                                const LucideIcon = item.iconName
                                                    ? (Icons as any)[item.iconName]
                                                    : Tag;
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            if (
                                                                item.type === "query" ||
                                                                item.type === "category"
                                                            ) {
                                                                setSearchQuery(item.title);
                                                                if (item.type === "query") {
                                                                    navigate(
                                                                        `/search/job/all?search=${item.title}`,
                                                                    );
                                                                } else {
                                                                    navigate(`/search/job/${item.title}`);
                                                                }
                                                            } else {
                                                                navigate(`/profile/${item.id}`);
                                                            }
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className="flex items-center gap-5 hover:bg-gray-50 p-2 rounded-2xl transition-all cursor-pointer group"
                                                    >
                                                        <div className="flex-shrink-0">
                                                            {item.type === "user" ? (
                                                                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                                                                    {item.avatarUrl ? (
                                                                        <img
                                                                            src={item.avatarUrl}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <User className="text-gray-400" size={20} />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center">
                                                                    <LucideIcon
                                                                        size={24}
                                                                        className="text-[#2F7E47]"
                                                                        strokeWidth={1.5}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight">
                                                                {item.title}
                                                            </h3>
                                                            <p className="text-[15px] text-gray-500 font-medium mt-0.5">
                                                                {item.subtitle}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-2">
                                            <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight">
                                                No search history
                                            </h3>
                                            <p className="text-[15px] text-gray-500 font-medium mt-1">
                                                Try searching for something
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default search;
