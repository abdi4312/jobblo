import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useFavoriteStatusQuery } from "./useFavorites"; // Path check karlein
import { useFavoriteActions } from "./useFavorites";

export function useFavoriteToggle(id: string, isAuth: boolean) {
  const navigate = useNavigate();
  
  // 1. Get Status
  const { data: isFavorited, isLoading: isStatusLoading } = useFavoriteStatusQuery(id, isAuth);
  
  // 2. Get Actions (Refetching logic pehle hi hook ke onSuccess mein honi chahiye)
  const { addFavorite, removeFavorite, isAdding, isRemoving } = useFavoriteActions();

  const handleFavoriteClick = (e?: React.MouseEvent) => {
    // Event propagation rokhne ke liye agar card ke andar button hai
    e?.stopPropagation();

    if (!isAuth) {
      toast.error("Du må logge inn for å legge til favoritter");
      navigate("/login");
      return;
    }

    if (!id) return;

    if (isFavorited) {
      removeFavorite(id);
    } else {
      addFavorite(id);
    }
  };

  return {
    isFavorited,
    handleFavoriteClick,
    isLoading: isStatusLoading || isAdding || isRemoving
  };
}