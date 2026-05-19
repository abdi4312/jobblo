import { useHomeHero } from "../../features/homeHero/hooks";
import Search from "./search";
import HeroDefaultImage from "../../assets/images/Hero/hero_img.png";

export function HomeHero() {
  const { data: hero, isLoading, isError } = useHomeHero();

  if (isLoading) {
    return (
      <div className="max-w-300 mx-auto min-h-100 flex items-center justify-center animate-pulse bg-gray-50 rounded-3xl mb-12 lg:mb-24">
        <div className="text-gray-400 font-medium">Laster...</div>
      </div>
    );
  }

  // Static content as requested
  const staticContent = {
    title1: "Små jobber.",
    title2: "Store muligheter.",
    subtitle: "Finn eller tilby hjelp til hagearbeid, flytting, maling og mer – raskt og enkelt i ditt nærområde",
  };

  const mediaUrl = hero?.mediaUrl || HeroDefaultImage;
  const mediaType = hero?.mediaType || "image";

  return (
    <div className="max-w-300 mx-auto md:flex md:flex-row mb-12 lg:mb-24 relative min-h-auto">
      {/* Background Media for Mobile */}
      <div className="flex flex-col gap-2 items-center justify-center text-center mb-4 md:hidden">
        <h2 className="text-[20px] font-medium text-custom-black leading-5">
          {staticContent.title1}
        </h2>
        <h2 className="text-[28px] md:text-[64px] text-custom-green font-semibold leading-5">
          {staticContent.title2}
        </h2>

        <p className="text-[12px] text-custom-black font-normal max-w-75">
          {staticContent.subtitle}
        </p>
      </div>

      <div className="md:absolute relative right-0 bottom-0 md:top-0 w-full md:w-auto">
        {mediaType === "video" ? (
          <video
            src={mediaUrl}
            className="w-75 sm:w-100 lg:w-138.75 md:max-w-140.75 h-full min-h-71 max-h-71 sm:min-h-121 sm:max-h-121 lg:min-h-141 lg:max-h-141 object-cover mx-auto rounded-tr-[350px] rounded-tl-[350px]"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Hero"
            className="w-75 sm:w-100 lg:w-138.75 md:max-w-140.75 object-cover mx-auto min-h-71 max-h-71 sm:min-h-121 sm:max-h-121 lg:min-h-141 lg:max-h-141 rounded-tr-[350px] rounded-tl-[350px]"
            loading="eager"
          />
        )}
      </div>

      {/* Content Overlay */}
      <div className="flex -mt-11 md:mt-11 lg:mt-0 inset-0 md:relative z-10 items-center justify-center md:items-start md:justify-start xl:pt-15.75 px-4">
        <div className="max-w-110 sm:max-w-140 lg:max-w-165 flex flex-col gap-10 md:gap-16 w-full lg:w-auto">
          {/* Text Section */}
          <div className="max-w-[70%] lg:max-w-full hidden md:block">
            <h2 className="md:text-[24px] lg:text-[32px] font-medium text-custom-black tracking-[2px]">
              {staticContent.title1}
            </h2>
            <h2 className="md:text-[32px] lg:text-[64px] text-custom-green font-semibold tracking-[2px] leading-tight">
              {staticContent.title2}
            </h2>

            <p className="text-base text-custom-black font-light md:max-w-100.75 lg:max-w-131.75 mt-4">
              {staticContent.subtitle}
            </p>
          </div>

          {/* Search Section */}
          <Search />

          {/* Stats Section */}
          <div className="flex text-center justify-center md:justify-start gap-3">
            <div className="p-3 box-card-custom rounded-[6px] min-w-35"> 
              <h2 className="text-custom-green text-[24px] font-bold">5000+</h2>
              <p className="text-custom-black/70 font-light">Aktive oppdrag</p>
            </div>
            <div className="p-3 box-card-custom rounded-[6px] min-w-35">
              <h2 className="text-custom-green text-[24px] font-bold">5000+</h2>
              <p className="text-custom-black/70 font-light">Aktive oppdrag</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
