import styles from "./Hero.module.css";
import { Button, Input, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import jobbloSwipe from "../../../assets/images/gardening.png";

// Swiper
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";

// Swiper styles - using bundle which includes all module styles
import "swiper/swiper-bundle.css";

import  mainLink  from "../../../api/mainURLs";
import { useEffect, useState, useCallback } from "react";

// Hero item type
interface HeroItem {
  image: string;
  title: string;
  subtitle: string;
  subtitleSecondary?: string;
  description: string;
}

export function Hero() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState<HeroItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate('/job-listing', { state: { searchQuery: value.trim() } });
    } else {
      toast.warning("Vennligst skriv inn et søkeord");
    }
  };

  // Improved getHero with useCallback
  const getHero = useCallback(async () => {
    try {
      setLoading(true);
      const res = await mainLink.get<HeroItem[]>(`/api/hero`);
      console.log("Hero API Response:", res.data[0].subtitle);
      
      if (res.data && res.data.length > 0) {
        setHero(res.data);
      }
    } catch (error) {
      console.error("Error fetching hero data:", error);
      // Optional: toast.error("Kunne ikke laste inn data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getHero();
  }, [getHero]);

  if (loading) {
    return (
      <div className={styles.heroBackground}>
        <div
          className={styles.heroOverlay}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "500px", 
          }}
        >
          <Spin size="large" tip="Laster...">
            <div style={{ minHeight: "100px" }} />
          </Spin>
        </div>
      </div>
    );
  }

  // Default data if API returns empty
  const heroData = hero.length > 0 ? hero : [{
    image: jobbloSwipe,
    title: "Jobblo AS",
    subtitle: "Små jobber.",
    subtitleSecondary: "Store Muligheter",
    description: "Finn kvalitetssertifisert fagfolk for alle dine prosjekter: oppussing, hagearbeid og annet alt på et sted."
  }];

  return (
    <div className={styles.heroBackground}>
      <div className={styles.heroOverlay}>
        <Swiper
          modules={[Autoplay, Navigation, Pagination]}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          navigation
          pagination={{ clickable: true }}
          loop={heroData.length > 1}
          className={styles.heroSwiper}
        >
          {heroData.map((item, index) => (
            <SwiperSlide key={index}>
              <div
                className={styles.slideContainer}
                style={{
                  backgroundImage: `url(${item?.image || jobbloSwipe})`,
                }}
              >
                <div className={styles.slideOverlay}>
                  <div className={styles.heroContainer}>
                    <h1 className={styles.heroTitle}>
                      <span className={styles.smallText}>
                        {item?.subtitle || "Små jobber"}
                      </span>{" "}
                      <span className={styles.highlight}>
                        {item?.subtitleSecondary || "Store muligheter"}
                      </span>
                    </h1>
                    <p className={styles.heroDescription}>
                      {item?.description}
                    </p>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Search & buttons */}
        <div className={styles.heroSearchContainer}>
          <div className={styles.searchActionContainer}>
            <Button
              icon={<span className="material-symbols-outlined">map</span>}
              size="large"
              shape="circle"
            />
            <Input.Search
              className={styles.antSearchBar}
              placeholder="Søk etter oppdrag"
              size="large"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              enterButton
            />
          </div>

          <div className={styles.heroButtonContainer}>
            <Button
              onClick={() => navigate("/job-listing")}
              size="large"
              className={styles.secondaryButton}
              style={{ height: "48px", fontSize: "16px", padding: "0 32px" }}
            >
              Utforsk Jobblo
            </Button>

            <Button
              type="primary"
              onClick={() => navigate("/publish-job")}
              size="large"
              style={{ height: "48px", fontSize: "16px", padding: "0 32px" }}
            >
              Legg ut annonse
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}