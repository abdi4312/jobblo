import { ChevronLeft, ChevronRight } from "lucide-react";
import { BANNERS_DATA } from "../../../data/banners";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import { useNavigate } from "react-router-dom";
import { usePublicHeroes } from "../../../features/hero/hooks";

export function Banner() {
  const navigate = useNavigate();
  const { data: heroes, isLoading: loading } = usePublicHeroes();

  // Fallback banners agar API se data na mile ya loading ho rahi ho
  const banners = heroes && heroes.length > 0 ? heroes : BANNERS_DATA;

  const handleButtonClick = (url: string) => {
    if (!url) return;
    if (url.startsWith("http")) {
      window.open(url, "_blank");
    } else {
      navigate(url);
    }
  };

  if (loading) return null;

  return (
    <div className="w-full max-w-300 mx-auto py-8 px-2 md:px-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 md:gap-8">

        {/* Left Arrow */}
        <button
          id="banner-prev"
          className="w-10 h-10 md:w-14 md:h-14 bg-transparent rounded-full md:flex items-center
          justify-center border border-[#0A0A0A] hover:border-gray-300 text-gray-700 transition-all shrink-0 shadow-sm z-10 hidden"
          aria-label="Previous slide"
        >
          <ChevronLeft size={24} strokeWidth={1} />
        </button>

        {/* Banner Card */}
        <div className="flex-1 min-w-0 bg-white p-2 md:p-4 rounded-[30px] md:rounded-[48px] shadow-sm border border-gray-100 overflow-hidden relative h-95 md:h-125">

          <Swiper
            // 2. Modules mein Autoplay add karein
            modules={[Navigation, Autoplay]}
            navigation={{
              prevEl: '#banner-prev',
              nextEl: '#banner-next',
            }}
            // 3. Autoplay config add karein (5000ms = 5 sec)
            autoplay={{
              delay: 5000,
              disableOnInteraction: false, // User click kare tab bhi auto chalta rahe
            }}
            speed={700}

            loop={banners.length > 1}
            spaceBetween={16}
            slidesPerView={1}
            className="w-full h-full rounded-[22px] md:rounded-[36px]"
          >
            {banners.map((data) => (
              <SwiperSlide key={data._id || data.id}>
                <div
                  className="w-full h-full relative overflow-hidden flex items-center"
                  style={{ backgroundColor: data.bgColor }}
                >
                  {/* Right Side Image with Gradient Overlay */}
                  <div
                    className="absolute top-0 bottom-0 w-[80%] md:w-[70%]"
                    style={{ right: '-2px' }}
                  >
                    {/* Gradient overlay to blend green into image */}
                    <div
                      className="absolute inset-0 z-10"
                      style={{
                        background: `linear-gradient(to right, ${data.bgColor} 0%, ${data.bgColor}E6 15%, transparent 100%)`
                      }}
                    ></div>
                    <img
                      src={data.image}
                      alt="promo banner"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>

                  {/* Left Side Content */}
                  <div className="relative z-20 pl-6 md:pl-16 w-full md:w-[70%] flex flex-col h-full justify-center">
                    <div className="flex-1 flex flex-col justify-center">
                      <h1 className="text-[#F5F1EB] text-4xl md:text-5xl lg:text-[72px] font-bold tracking-tight mb-1 md:mb-3 leading-tight">
                        {data.title}
                      </h1>
                      <p className="text-[#F5F1EB] text-lg md:text-2xl lg:text-[32px] font-light mb-6 md:mb-10 opacity-95">
                        {data.subtitle}
                      </p>

                      <button
                        onClick={() => handleButtonClick(data.buttonUrl)}
                        className="bg-[#F5F1EB] text-[#132A22] font-semibold text-sm md:text-lg py-3 px-6 md:py-4 md:px-10
                      rounded-xl md:rounded-[20px] w-max hover:bg-white hover:scale-105 transition-all duration-300">
                        {data.buttonText}
                      </button>
                    </div>

                    <p className="text-[#F5F1EB] text-[10px] md:text-sm font-light opacity-80 pb-6 md:pb-8 max-w-62.5 md:max-w-xl">
                      {data.footerText}
                    </p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

        </div>

        {/* Right Arrow */}
        <button
          id="banner-next"
          className="w-10 h-10 md:w-14 md:h-14 bg-transparent rounded-full md:flex items-center justify-center
          border border-[#0A0A0A] hover:border-gray-300 text-gray-700 transition-all shrink-0 shadow-sm z-10 hidden"
          aria-label="Next slide"
        >
          <ChevronRight size={24} strokeWidth={1} />
        </button>

      </div>
    </div>
  );
}