import { SearchItem } from "./SearchItem";
import { SlidersHorizontal } from "lucide-react";
import type { CategoryResult, UserResult, ListResult } from "./types";

interface DefaultResultsProps {
  activeTab: string;
  user: any;
  isListsLoading: boolean;
  favoriteLists: ListResult[];
  isCategoriesLoading: boolean;
  categories: CategoryResult[];
  isPeopleLoading: boolean;
  people: UserResult[];
  onNavigate: (path: string) => void;
  onCloseDropdown: () => void;
  onSaveToHistory: (item: any) => void;
}

export const DefaultResults = ({
  activeTab,
  user,
  isListsLoading,
  favoriteLists,
  isCategoriesLoading,
  categories,
  isPeopleLoading,
  people,
  onNavigate,
  onCloseDropdown,
  onSaveToHistory,
}: DefaultResultsProps) => {
  if (activeTab === "Lists") {
    return (
      <div className="space-y-4">
        {isListsLoading ? (
          <div className="text-center py-10 text-gray-500">
            Loading lists...
          </div>
        ) : favoriteLists && favoriteLists.length > 0 ? (
          favoriteLists.map((list) => (
            <SearchItem
              key={list._id}
              type="list"
              title={list.name}
              count={list.services?.length}
              isPublic={list.public}
              image={list.services?.[0]?.images?.[0]}
              onClick={() => {
                onNavigate(`/favorites/list/${list._id}`);
                onCloseDropdown();
              }}
            />
          ))
        ) : (
          <div className="text-center py-10 text-gray-500">
            No lists found.{" "}
            {user ? "Create one to see it here!" : "Login to see your lists."}
          </div>
        )}
      </div>
    );
  }

  if (activeTab === "Categories") {
    return (
      <div className="space-y-4">
        {isCategoriesLoading ? (
          <div className="text-center py-10 text-gray-500">
            Loading categories...
          </div>
        ) : categories && categories.length > 0 ? (
          categories.map((cat) => (
            <SearchItem
              key={cat._id}
              type="category"
              title={cat.name}
              subtitle={`Explore ${cat.name} tasks`}
              iconName={cat.icon}
              onClick={() => {
                onSaveToHistory({
                  id: cat._id,
                  type: "category",
                  title: cat.name,
                  subtitle: "Category search",
                  iconName: cat.icon,
                });
                onNavigate(`/search/job/${cat.name}`);
                onCloseDropdown();
              }}
            />
          ))
        ) : (
          <div className="text-center py-10 text-gray-500">
            No categories found.
          </div>
        )}
      </div>
    );
  }

  if (activeTab === "People") {
    return (
      <div className="space-y-4">
        {isPeopleLoading ? (
          <div className="text-center py-10 text-gray-500">
            Loading people...
          </div>
        ) : people && people.length > 0 ? (
          people.map((p) => (
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
          ))
        ) : (
          <div className="text-center py-10 text-gray-500">
            No people found.
          </div>
        )}
      </div>
    );
  }

  // Default Top tab
  return (
    <>
      <div
        onClick={() => {
          onNavigate("/search/job/all");
          onCloseDropdown();
        }}
        className="flex items-center gap-6 cursor-pointer group p-3 hover:bg-gray-50 rounded-2xl transition-all"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
          <SlidersHorizontal
            size={24}
            className="text-gray-900 group-hover:text-custom-green transition-colors"
            strokeWidth={1.5}
          />
        </div>
        <div>
          <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-custom-green transition-colors">
            All Jobs
          </h3>
          <p className="text-[15px] text-gray-500 font-medium mt-1">
            See all Jobs
          </p>
        </div>
      </div>
    </>
  );
};
