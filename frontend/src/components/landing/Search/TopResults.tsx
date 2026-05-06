import { SearchItem } from "./SearchItem";
import type {
  UnifiedSearchResults,
  CategoryResult,
  UserResult,
  ListResult,
} from "./types";

interface TopResultsProps {
  searchQuery: string;
  isSearching: boolean;
  searchResults: UnifiedSearchResults | undefined;
  onSaveToHistory: (item: any) => void;
  onNavigate: (path: string) => void;
  onCloseDropdown: () => void;
  onSeeAll: (tab: string) => void;
}

export const TopResults = ({
  searchQuery,
  isSearching,
  searchResults,
  onSaveToHistory,
  onNavigate,
  onCloseDropdown,
  onSeeAll,
}: TopResultsProps) => {
  if (isSearching) {
    return <div className="text-center py-10 text-gray-500">Søker...</div>;
  }

  const hasResults =
    searchResults?.categories?.results?.length > 0 ||
    searchResults?.people?.results?.length > 0 ||
    searchResults?.lists?.results?.length > 0;

  if (!hasResults) {
    return (
      <div className="text-center py-10 text-gray-500">
        No results found for "{searchQuery}"
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Search for query in all Jobs */}
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

      {/* Categories */}
      {searchResults?.categories?.results?.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
              Populære kategorier
            </h4>
            {searchResults.categories.total > 3 && (
              <button
                onClick={() => onSeeAll("Categories")}
                className="text-[14px] font-bold text-custom-green hover:underline transition-all"
              >
                Se alle
              </button>
            )}
          </div>
          {searchResults.categories.results.map((cat: any) => (
            <SearchItem
              key={cat._id}
              type="category"
              title={cat.name}
              subtitle="Kategorisøk"
              iconName={cat.icon}
              onClick={() => {
                onSaveToHistory({
                  id: cat._id,
                  type: "category",
                  title: cat.name,
                  subtitle: "Kategorisøk",
                  iconName: cat.icon,
                });
                onNavigate(`/search/job/${cat.name}`);
                onCloseDropdown();
              }}
            />
          ))}
        </div>
      )}

      {/* People */}
      {searchResults?.people?.results?.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
              Topp tjenesteytere
            </h4>
            {searchResults.people.total > 3 && (
              <button
                onClick={() => onSeeAll("People")}
                className="text-[14px] font-bold text-custom-green hover:underline transition-all"
              >
                Se alle
              </button>
            )}
          </div>
          {searchResults.people.results.map((p: any) => (
            <SearchItem
              key={p._id}
              type="user"
              title={`${p.name} ${p.lastName || ""}`.trim()}
              subtitle={`@${p.name?.toLowerCase()}${p.lastName?.toLowerCase()}`}
              avatarUrl={p.avatarUrl}
              onClick={() => {
                onSaveToHistory({
                  id: p._id,
                  type: "user",
                  title: `${p.name} ${p.lastName || ""}`.trim(),
                  subtitle: p.name?.toLowerCase(),
                  avatarUrl: p.avatarUrl,
                });
                onNavigate(`/profile/${p._id}`);
                onCloseDropdown();
              }}
            />
          ))}
        </div>
      )}

      {/* Lists */}
      {searchResults?.lists?.results?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[18px] font-bold text-[#1A1A1A]">
              Offentlige lister
            </h4>
            {searchResults.lists.total > 3 && (
              <button
                onClick={() => onSeeAll("Lists")}
                className="text-[14px] font-bold px-4 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
              >
                Se alle
              </button>
            )}
          </div>
          {searchResults.lists.results.map((list: any) => (
            <SearchItem
              key={list._id}
              type="list"
              title={list.name}
              count={list.services?.length}
              isPublic={true}
              image={list.services?.[0]?.images?.[0]}
              onClick={() => {
                onNavigate(`/favorites/list/${list._id}`);
                onCloseDropdown();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
