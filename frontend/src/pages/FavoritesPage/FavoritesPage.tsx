import { useEffect, useState } from "react";
import { getFavorites } from "../../api/favoriteAPI.ts";
import { useUserStore } from "../../stores/userStore.ts";
import type { FavoritesResponse } from "../../types/FavoritesTypes.ts";
import { JobCard } from "../../components/Explore/jobs/JobCard/JobCard.tsx";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoritesResponse | null>(null);
  const userToken = useUserStore((state) => state.tokens);

  useEffect(() => {
    async function fetchFavorites() {
      try {
        const data = await getFavorites(userToken);
        setFavorites(data);
      } catch (err) {
        console.error("Failed to catch categories", err);
      }
    }

    void fetchFavorites();
  }, []);

  return (
    <>
      {favorites?.data.map((services) => (
        <JobCard
          key={services.service._id}
          job={services.service}
          gridColumns={2}
        ></JobCard>
      ))}
    </>
  );
}
