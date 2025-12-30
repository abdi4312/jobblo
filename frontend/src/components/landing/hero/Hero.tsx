import styles from "./Hero.module.css";
import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from 'react-toastify';

export function Hero() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate('/job-listing', { state: { searchQuery: value.trim() } });
    } else {
      toast.warning("Vennligst skriv inn et søkeord");
    }
  };

  return (
    <>
      <div className={styles.heroBackground}>
        <div className={styles.heroOverlay}>
          <div className={styles.heroContainer}>
            <h1 className={styles.heroTitle}>Jobblo AS</h1>
            <h2 className={styles.heroSubTitle}>
              Små jobber <span>Store Muligheter</span>
            </h2>
            <p style={{ fontSize: '20px', maxWidth: '700px', lineHeight: '1.6', opacity: 0.95 }}>
              Finn kvalitetssertifisert fagfolk for alle dine prosjekter :
              oppussing, hagearbeid og annet alt på et sted.
            </p>
            <div className={styles.searchActionContainer}>
            <Button
              icon={<span className="material-symbols-outlined">map</span>}
              size={"large"}
              shape={"circle"}
            />
            <Input.Search
              className={styles.antSearchBar}
              placeholder={"Søk etter oppdrag"}
              size={"large"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
            />
          </div>
          <div className={styles.heroButtonContainer}>
            <Button onClick={() => navigate("/job-listing")} size="large" style={{ height: '48px', fontSize: '16px', padding: '0 32px' }}>
              Utforsk Jobblo
            </Button>
            <Button onClick={() => navigate("/publish-job")} type={"primary"} size="large" style={{ height: '48px', fontSize: '16px', padding: '0 32px' }}>Legg ut annonse</Button>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
