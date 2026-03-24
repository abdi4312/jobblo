import { useNavigate } from "react-router-dom";
import { useFavoriteLists } from "../../features/favoriteLists/hooks";
import { JobDetailCardSkeleton } from "../../components/Loading/JobDetailCardSkeleton.tsx";

export function FavoritesPage() {
  const { data: lists = [], isLoading, isError } = useFavoriteLists();
  const navigate = useNavigate();

  if (isLoading) return <JobDetailCardSkeleton />;
  if (isError) return <p className="text-center py-20">Kunne ikke laste lister.</p>;

  return (
    <div className="p-4 max-w-300 mx-auto min-h-screen">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {lists.map((list: any) => {
          // Get the latest service's image or fallback
          const latestService = list.services?.[list.services.length - 1];
          const backgroundImage = latestService?.images?.[0] || "";

          return (
            <div
              key={list._id}
              onClick={() => navigate(`/favorites/list/${list._id}`)}
              className="relative aspect-4/5 w-full rounded-3xl overflow-hidden cursor-pointer group shadow-sm"
            >
              {/* Background Image */}
              {backgroundImage ? (
                <img
                  src={backgroundImage}
                  alt={list.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                  <span className="text-sm">Ingen bilder</span>
                </div>
              )}

              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

              {/* List Name (Bottom Left) */}
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="text-white font-bold text-lg md:text-xl drop-shadow-md truncate">
                  {list.name}
                </h2>
              </div>
            </div>
          );
        })}

        {/* Empty State if no lists */}
        {lists.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-xl font-medium">Du har ingen lister ennå</p>
          </div>
        )}
      </div>
    </div>
  );
}
