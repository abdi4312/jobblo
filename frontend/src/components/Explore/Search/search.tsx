import styles from "./search.module.css";
import { Button } from "antd";
import jobbloswipe from "../../../assets/images/jobbloswipe.png";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from "react-toastify";
import { useState, useEffect, useMemo } from "react";
import debounce from "lodash.debounce";

interface SearchProps {
  onSearchChange?: (searchQuery: string) => void;
  value?: string;
}

export function Search({ onSearchChange, value }: SearchProps) {
  const navigate = useNavigate();
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync local state with external value prop
  useEffect(() => {
    if (value !== undefined && value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [value]);

  // Create debounced search function that waits 1 second after user stops typing
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        if (onSearchChange) {
          onSearchChange(query.trim());
        }
      }, 1000),
    [onSearchChange]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handlePublishClick = () => {
    if (!isAuth) {
      toast.error("Du må logge inn for å publisere et oppdrag");
      navigate("/login");
      return;
    }
    navigate("/publish-job");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // Trigger debounced search if callback is provided
    if (onSearchChange) {
      debouncedSearch(value);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Only navigate to search page if no callback is provided (legacy behavior)
    if (!onSearchChange && searchQuery.trim()) {
      navigate(`/search/${encodeURIComponent(searchQuery.trim())}`);
    } else if (!onSearchChange && !searchQuery.trim()) {
      toast.warning("Vennligst skriv inn et søkeord");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <>
    <div className={styles.searchContainer}>
        <div className={styles.searchActionContainer}>
        <Button
            icon={<span className="material-symbols-outlined">map</span>}
            size={"large"}
            shape={"circle"}
            />
        </div>
        <input style={{ 
            marginLeft: "10px",
            width: "60vw", 
            maxWidth: "600px",
            borderRadius: "10px", 
            border: "2px solid #eee",
            position: "relative",
            paddingLeft: "10px"}} 
            type="text" 
            placeholder="Søk etter oppdrag"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            />

            <span 
                onClick={handleSearch}
                style={{
                right: "30px", 
                position: "relative", 
                paddingTop:"7px",
                cursor: "pointer"}} 
                className="material-symbols-outlined">
                search
            </span>
    </div>

    <div className={styles.searchButtonContainer}>
        <button 
          style={{color:"white", backgroundColor: "var(--color-primary)"}}
          onClick={handlePublishClick}
        >
          Legg ut Annonse
        </button>
        <div style={{position:"relative"}}>
        <button style={{color:"white", backgroundColor: "var(--color-accent)"}}>Swipe</button>
        <img style={{width:"28px", height:"14px", position:"absolute", right:"26px", top:"3px"}} src={jobbloswipe} alt="Jobblo swipe" />
        </div>
    </div>

    </>
  );
}
