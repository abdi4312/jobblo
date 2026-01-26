import { Button, Input, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import jobbloSwipe from "../../../assets/images/gardening.png";

// Swiper
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";

// Swiper styles
import "swiper/swiper-bundle.css";

import mainLink from "../../../api/mainURLs";
import { useEffect, useState, useCallback } from "react";

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
      navigate("/job-listing", { state: { searchQuery: value.trim() } });
    } else {
      toast.warning("Vennligst skriv inn et søkeord");
    }
  };

  const getHero = useCallback(async () => {
    try {
      setLoading(true);
      const res = await mainLink.get<HeroItem[]>(`/api/hero`);
      if (res.data && res.data.length > 0) {
        setHero(res.data);
      }
    } catch (error) {
      console.error("Error fetching hero data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getHero();
  }, [getHero]);

  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex justify-center items-center bg-gray-50">
        <Spin size="large" tip="Laster..." />
      </div>
    );
  }

  const heroData =
    hero.length > 0
      ? hero
      : [
          {
            image: jobbloSwipe,
            title: "Jobblo AS",
            subtitle: "Små jobber.",
            subtitleSecondary: "Store Muligheter",
            description:
              "Finn kvalitetssertifisert fagfolk for alle dine prosjekter: oppussing, hagearbeid og annet alt på et sted.",
          },
        ];

  return (
    <div className="w-full relative overflow-hidden">
      <div className="w-full relative">
        <Swiper
          modules={[Autoplay, Navigation, Pagination]}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          navigation
          pagination={{ clickable: true }}
          loop={heroData.length > 1}
          className="w-full h-full"
        >
          {heroData.map((item, index) => (
            <SwiperSlide key={index}>
              {/* FIXED: Added square brackets for arbitrary height values */}
              <div
                className="w-full h-[500px] md:h-[600px] bg-cover bg-center bg-no-repeat relative"
                style={{
                  backgroundImage: `url(${item?.image || jobbloSwipe})`,
                }}
              >
                {/* FIXED: Explicitly added text-white to the overlay container */}
                <div className="absolute inset-0 backdrop-blur-[2px] bg-black/40 flex items-center justify-center px-5 text-white">
                  {/* FIXED: Added square brackets for arbitrary max-width */}
                  <div className="flex flex-col items-center text-center gap-5 max-w-[1000px] w-full mb-16 md:mb-24">
                    <h2 className="text-white text-[20px] md:text-[24px] font-semibold opacity-90 tracking-wide uppercase m-0">
                      {item?.title || "Jobblo AS"}
                    </h2>
                    <h1 className="text-white text-[36px] md:text-[56px] font-bold leading-[1.1] m-0">
                      <span className="text-[28px] md:text-[42px] font-medium inline-block align-middle">
                        {item?.subtitle || "Små jobber"}
                      </span>{" "}
                      <span className="text-[#ff8a00] font-extrabold">
                        {item?.subtitleSecondary || "Store muligheter"}
                      </span>
                    </h1>
                    <p className="text-white max-w-[700px] text-[16px] md:text-[20px] leading-relaxed opacity-95 m-0">
                      {item?.description}
                    </p>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Search & Action Buttons Container */}
        {/* FIXED: Used standard tailwind values or square brackets for spacing */}
        <div className="absolute bottom-10 md:bottom-[110px] left-1/2 -translate-x-1/2 z-10 w-[90%] md:w-auto flex flex-col items-center justify-center">
          <div className="flex gap-3 w-full md:min-w-[500px] items-center justify-center">
            <Button
              icon={<span className="material-symbols-outlined">map</span>}
              size="large"
              shape="circle"
              className="flex items-center justify-center shrink-0 border-none shadow-md"
            />
            <Input.Search
              placeholder="Søk etter oppdrag"
              size="large"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              enterButton
              className="w-full shadow-md"
            />
          </div>

          <div className="flex flex-row justify-center gap-3 w-full mt-6">
            <Button
              onClick={() => navigate("/job-listing")}
              size="large"
              className="h-12 text-[16px] px-8 bg-white/10 text-white border-white hover:bg-white hover:text-black transition-all"
            >
              Utforsk Jobblo
            </Button>

            <Button
              type="primary"
              onClick={() => navigate("/publish-job")}
              size="large"
              className="h-12 text-[16px] px-8"
            >
              Legg ut annonse
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .swiper-pagination-bullet { background: white; opacity: 0.6; }
        .swiper-pagination-bullet-active { background: #EA7E15 !important; opacity: 1; }
        .swiper-button-next, .swiper-button-prev { color: #EA7E15 !important; }
        @media (max-width: 768px) {
          .swiper-button-next, .swiper-button-prev { display: none; }
        }
      `}</style>
    </div>
  );
}