import styles from "./Hero.module.css";
import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Swiper
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";

// Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { mainLink } from "../../../api/mainURLs";
import { useEffect, useState } from "react";

// Hero item type
interface HeroItem {
  image: string;
  title: string;
  subtitle: string;
  subTitle?: string;
  description: string;
}

export function Hero() {
  const navigate = useNavigate();
  const [hero, setHero] = useState<HeroItem[]>([]);

  const getHero = async () => {
    try {
      const res = await axios.get<HeroItem[]>(`${mainLink}/api/hero`);
      setHero(res.data);
      console.log(res.data);
      
    } catch (error) {
      console.error("Error fetching hero data:", error);
    }
  };

  useEffect(() => {
    getHero();
  }, []);

  return (
    <div className={styles.heroBackground}>
      <div className={styles.heroOverlay}>
        <Swiper
          modules={[Autoplay, Navigation, Pagination]}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          navigation
          pagination={{ clickable: true }}
          loop={hero.length > 1}
          className={styles.heroSwiper}
        >
          {hero.map((item, index) => (
            <SwiperSlide key={index}>
              <div
                className={styles.slideContainer}
                style={{ backgroundImage: `url(${item?.image || "../../../assets/images/gardening.png"})`}}
              >
                <div className={styles.slideOverlay}>
                  <div className={styles.heroContainer}>
                    <h1 className={styles.heroTitle}>{item?.title || "Jobblo "}</h1>

                      <h2 className={styles.heroSubTitle}>
                        {item?.subtitle || "Små jobber Store Mulighete"}
                      </h2>

                    <p>{item?.description || "Finn kvalitetssertifisert fagfolk for alle dine prosjekter oppussing, hagearbeid og annet alt på et sted."}</p>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Search and buttons outside slider */}
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
            />
          </div>

          <div className={styles.heroButtonContainer}>
            <Button onClick={() => navigate("/job-listing")}>Utforsk Jobblo</Button>
            <Button type="primary" onClick={() => navigate("/publish-job")}>
              Legg ut annonse
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
