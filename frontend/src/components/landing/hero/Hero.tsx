import styles from "./Hero.module.css";
import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";

export function Hero() {
  const navigate = useNavigate();
  return (
    <>
      <div className={styles.heroBackground}>
        <div className={styles.heroOverlay}>
          <div className={styles.heroContainer}>
            <h1 className={styles.heroTitle}>Jobblo AS</h1>
            <h2 className={styles.heroSubTitle}>
              Små jobber <span>Store Muligheter</span>
            </h2>
            <p>
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
            />
          </div>
          <div className={styles.heroButtonContainer}>
            <Button onClick={() => navigate("/job-listing")}>
              Utforsk Jobblo
            </Button>
            <Button type={"primary"}>Legg ut annonse</Button>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
