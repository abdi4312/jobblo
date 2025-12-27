import { useEffect, useState } from "react";
import { getFavorites } from "../../api/favoriteAPI.ts";
import { useUserStore } from "../../stores/userStore.ts";
import type { FavoritesResponse } from "../../types/FavoritesTypes.ts";
import { JobCard } from "../../components/Explore/jobs/JobCard/JobCard.tsx";
import { useNavigate } from "react-router-dom";

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <button
          onClick={() => nav(-1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "16px",
            color: "var(--color-text)",
          }}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Tilbake
        </button>
      </div>

      <h2
        style={{
          textAlign: "center",
          margin: "20px 0",
          fontSize: "24px",
          fontWeight: "600",
        }}
      >
        Mine Favoritter
      </h2>
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
