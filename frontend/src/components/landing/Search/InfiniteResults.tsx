import { SearchItem } from "./SearchItem";
import type { CategoryResult, UserResult, ListResult } from "./types";

interface InfiniteResultsProps {
  activeTab: string;
  searchQuery: string;
  isInfiniteLoading: boolean;
  infiniteResults: (CategoryResult | UserResult | ListResult | any)[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSaveToHistory: (item: any) => void;
  onNavigate: (path: string) => void;
  onCloseDropdown: () => void;
  onBackToTop: () => void;
}

export const InfiniteResults = ({
  activeTab,
  searchQuery,
  isInfiniteLoading,
  infiniteResults,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSaveToHistory,
  onNavigate,
  onCloseDropdown,
  onBackToTop,
}: InfiniteResultsProps) => {
  return (
    <div className="space-y-6">
      {/* Search for "[query]" amongst all Jobs */}
      <SearchItem
        type="query"
        title={`Søk etter "${searchQuery}"`}
        subtitle="Blant alle oppdrag"
        onClick={() => {
          onSaveToHistory({
            id: `query-${searchQuery}`,
            type: "query",
            title: searchQuery,
            subtitle: "Brand search",
          });
          onNavigate(`/search/job/all?search=${searchQuery}`);
          onCloseDropdown();
        }}
      />

      <div className="flex items-center justify-between px-2">
        <h4 className="text-[18px] font-bold text-[#1A1A1A]">
          {activeTab} Search Results
        </h4>
        <button
          onClick={onBackToTop}
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
              return (
                <SearchItem
                  key={item._id}
                  type="category"
                  title={item.name}
                  subtitle={`Explore ${item.name}`}
                  iconName={item.icon}
                  onClick={() => {
                    onSaveToHistory({
                      id: item._id,
                      type: "category",
                      title: item.name,
                      subtitle: "Category search",
                      iconName: item.icon,
                    });
                    onNavigate(`/search/job/${item.name}`);
                    onCloseDropdown();
                  }}
                />
              );
            } else if (activeTab === "People") {
              return (
                <SearchItem
                  key={item._id}
                  type="user"
                  title={`${item.name} ${item.lastName || ""}`.trim()}
                  subtitle={`@${item.name?.toLowerCase()}${item.lastName?.toLowerCase()}`}
                  avatarUrl={item.avatarUrl}
                  onClick={() => {
                    onSaveToHistory({
                      id: item._id,
                      type: "user",
                      title: `${item.name} ${item.lastName || ""}`.trim(),
                      subtitle: item.name?.toLowerCase(),
                      avatarUrl: item.avatarUrl,
                    });
                    onNavigate(`/profile/${item._id}`);
                    onCloseDropdown();
                  }}
                />
              );
            } else if (activeTab === "Lists") {
              return (
                <SearchItem
                  key={item._id}
                  type="list"
                  title={item.name}
                  count={item.services?.length}
                  isPublic={true}
                  image={item.services?.[0]?.images?.[0]}
                  onClick={() => {
                    onNavigate(`/favorites/list/${item._id}`);
                    onCloseDropdown();
                  }}
                />
              );
            }
            return null;
          })}

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
              >
                {isFetchingNextPage ? "Laster mer..." : "Se flere"}
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
  );
};
