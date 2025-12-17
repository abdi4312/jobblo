import { useEffect, useState } from "react";
import { getFavorites } from "../../api/favoriteAPI.ts";
import type { Jobs } from "../../types/Jobs.ts";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<Jobs[]>([]);

  useEffect(() => {
    async function fetchFavorites() {
      try {
        const data = await getFavorites();
        setFavorites(data);
      } catch (err) {
        console.error("Failed to catch categories", err);
      }
    }

    void fetchFavorites();
  }, []);

  console.log(favorites);

  return <></>;
}
