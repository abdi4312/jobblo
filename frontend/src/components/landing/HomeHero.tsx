import { useHomeHero } from "../../features/homeHero/hooks";
import Search from "./search";
import HeroDefaultImage from "../../assets/images/Hero/hero_img.png";
import { MapPin, UserCircle } from "lucide-react";

export function HomeHero() {
  const { data: hero, isLoading } = useHomeHero();

  if (isLoading) {
    return (
      <div className="max-w-275 mx-auto min-h-100 flex items-center justify-center animate-pulse bg-gray-50 rounded-3xl mb-12">
        <div className="text-gray-400 font-medium">Laster...</div>
      </div>
    );
  }

  // Static content as requested
  const staticContent = {
    title1: "Små jobber.",
    title2: "Store muligheter.",
    subtitle: "Finn eller tilby hjelp til hagearbeid, flytting, maling og mer – raskt og enkelt i ditt nærområde.",
  };

  const mediaUrl = hero?.mediaUrl || HeroDefaultImage;
  const mediaType = hero?.mediaType || "image";

  return (
    <div className="bg-[#f5f0e8] pt-5 pb-12">
      <div className="max-w-275 mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-10 px-5 sm:px-12">
        {/* Left Content */}
        <div className="hero-left">
          <div className="flex items-center gap-1.5 text-[13px] text-custom-green font-medium mb-2.5">
            <MapPin size={14} />
            <span>Norges lokale jobbplattform</span>
          </div>
          
          <h1 className="text-[32px] sm:text-[42px] font-normal text-custom-black leading-[1.15] mb-1.5">
            {staticContent.title1}<br />
            <em className="text-custom-green not-italic font-medium">{staticContent.title2}</em>
          </h1>
          
          <p className="text-[15px] text-custom-black/70 leading-relaxed mb-7 max-w-110">
            {staticContent.subtitle}
          </p>

          <div className="mb-6">
            <Search />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-white border border-black/10 rounded-xl p-2.5 px-4 min-w-30">
              <strong className="block text-[18px] font-medium text-custom-green">5 000+</strong>
              <span className="text-[11px] text-custom-black/50">Aktive oppdrag</span>
            </div>
            <div className="bg-white border border-black/10 rounded-xl p-2.5 px-4 min-w-30">
              <strong className="block text-[18px] font-medium text-custom-green">15 000+</strong>
              <span className="text-[11px] text-custom-black/50">Brukere</span>
            </div>
            <div className="bg-white border border-black/10 rounded-xl p-2.5 px-4 min-w-30">
              <strong className="block text-[18px] font-medium text-custom-green">4.8 ★</strong>
              <span className="text-[11px] text-custom-black/50">Snittrating</span>
            </div>
          </div>
        </div>

        {/* Right Content - Image */}
        <div className="flex justify-center items-center">
          <div className="w-85 h-95 bg-[#e8e0d0] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] overflow-hidden flex items-end justify-center relative">
            {mediaType === "video" ? (
              <video
                src={mediaUrl}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : mediaUrl === HeroDefaultImage ? (
              <div className="flex flex-col items-center justify-center gap-2 mb-20 text-black/20">
                <UserCircle size={80} strokeWidth={1} />
                <span className="text-[12px]">Bilde av håndverker</span>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt="Hero"
                className="w-full h-full object-cover"
                loading="eager"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
