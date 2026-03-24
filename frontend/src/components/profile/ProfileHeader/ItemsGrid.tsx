import { ChevronDown } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { useFavoriteLists } from "../../../features/favoriteLists/hooks";
import { JobDetailCardSkeleton } from "../../Loading/JobDetailCardSkeleton.tsx";
import { useNavigate } from "react-router-dom";

export function ItemsGrid({ activeTab }: { activeTab: string }) {
  const navigate = useNavigate();
  const { data: lists = [], isLoading, isError } = useFavoriteLists();

  // Empty states content mapping
  const emptyStateContent: Record<string, { title: string; description: string }> = {
    'Tises': {
      title: "You haven't posted any tises yet",
      description: "Start selling by posting your first tise!"
    },
    'Likes': {
      title: "You haven't liked any items yet",
      description: "Items you like will appear here"
    },
    'Lists': {
      title: "Your lists are currently empty",
      description: "Saved items and collections will appear here"
    },
    'Your wardrobe': {
      title: "Your wardrobe is currently empty",
      description: "When you buy something through a Tise bid, it appears here"
    },
    'Seller Hub': {
      title: "Seller Hub is currently empty",
      description: "Your sales and insights will appear here"
    }
  };

  const currentEmptyState = emptyStateContent[activeTab] || emptyStateContent['Tises'];

  if (isLoading && activeTab === 'Lists') return <JobDetailCardSkeleton />;
  if (isError && activeTab === 'Lists') return <p className="text-center py-20 text-red-500">Kunne ikke laste lister.</p>;

  const showLists = activeTab === 'Lists' && lists.length > 0;

  return (
    <div className="bg-[#f5f5f5] min-h-screen p-4 md:p-6">
      <div className="max-w-300 mx-auto">
        {showLists ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {lists.map((list: any) => {
              const latestService = list.services?.[list.services.length - 1];
              const backgroundImage = latestService?.images?.[0] || "";

              return (
                <div
                  key={list._id}
                  onClick={() => navigate(`/favorites/list/${list._id}`)}
                  className="relative aspect-4/5 w-full rounded-3xl overflow-hidden cursor-pointer group shadow-sm"
                >
                  {backgroundImage ? (
                    <img
                      src={backgroundImage}
                      alt={list.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                      <span className="text-sm">Ingen bilder</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                  <div className="absolute bottom-6 left-6 right-6">
                    <h2 className="text-white font-bold text-lg md:text-xl drop-shadow-md truncate">
                      {list.name}
                    </h2>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <EmptyState
              title={currentEmptyState.title}
              description={currentEmptyState.description}
            />
          </div>
        )}
      </div>
    </div>
  );
}
