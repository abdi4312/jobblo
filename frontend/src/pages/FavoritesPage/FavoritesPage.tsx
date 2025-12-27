import { useEffect, useState } from "react";
import { getFavorites } from "../../api/favoriteAPI.ts";
import { useUserStore } from "../../stores/userStore.ts";
import type { FavoritesResponse } from "../../types/FavoritesTypes.ts";
import { JobCard } from "../../components/Explore/jobs/JobCard/JobCard.tsx";
import { useNavigate } from "react-router-dom";
import styles from "./FavoritesPage.module.css";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoritesResponse | null>(null);
  const userToken = useUserStore((state) => state.tokens);
  const nav = useNavigate();

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
  }, [userToken]);

  return (
    <>
      <div className={styles.container}>
        <button onClick={() => nav(-1)} className={styles.button}>
          <span className="material-symbols-outlined">arrow_back</span>
          Tilbake
        </button>
      </div>

      <h2 className={styles.title}>Mine Favoritter</h2>
      {favorites?.data.map((services) => (
        <JobCard
          key={services.service._id}
          job={services.service}
          gridColumns={1}
        ></JobCard>
      ))}
    </>
  );
}
