import { GuideStep } from "./guideSteps/GuideStep.tsx";
import { useState, useEffect } from "react";

export function Guide() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const steps = [
    {
      title: "1. Opprett en bruker helt gratis",
      subtitle:
        "Registrer deg på få sekunder og få tilgang til alle funksjoner uten kostnad",
      icon: "person_add",
    },
    {
      title: "2. Start å søke",
      subtitle:
        "Gjennom jobblo vil du få muligheten til å se gjennom tusenavis av jobbannonser!",
      icon: "search",
    },
    {
      title: "3. Finn det perfekte jobben for deg",
      subtitle:
        "Utforsk jobber i nærheten eller søk etter spesifikke kategorier som passer dine ferdigheter",
      icon: "work",
    },
    {
      title: "4. Kontakt jobb utgiver",
      subtitle:
        "Bli enig på en deal eller kontrakt, og utfør arbeidet på dine egne premisser",
      icon: "handshake",
    },
    {
      title: "5. Legg ut Jobblo",
      subtitle:
        "Legg ut jobber for andre til å utføre for deg, spar tid og få hjelp når du trenger det",
      icon: "post_add",
    },
    {
      title: "6. Bli belønnet for å bruke Jobblo",
      subtitle:
        "Samle coins ved å fullføre oppdrag og bruk dem til eksklusive fordeler i appen",
      icon: "emoji_events",
    },
  ];

  const itemsPerView = isMobile ? 1 : 3;
  const totalPages = Math.ceil(steps.length / itemsPerView);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth / itemsPerView;
    const newIndex = Math.round(scrollLeft / itemWidth);
    setActiveSlide(newIndex);
  };

  const scrollToSlide = (index: number) => {
    const container = document.getElementById("guideStepContainer");
    if (container) {
      const itemWidth = container.offsetWidth / itemsPerView;
      container.scrollTo({ left: itemWidth * index, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    const maxIndex = steps.length - itemsPerView;
    const newIndex = activeSlide > 0 ? activeSlide - itemsPerView : maxIndex;
    scrollToSlide(newIndex);
  };

  const handleNext = () => {
    const maxIndex = steps.length - itemsPerView;
    const newIndex = activeSlide < maxIndex ? activeSlide + itemsPerView : 0;
    scrollToSlide(newIndex);
  };

  const getCurrentPage = () => Math.floor(activeSlide / itemsPerView);

  return (
    <div className="bg-[#183a1d] text-white py-15 px-5 overflow-hidden">
      <div className="max-w-225 mx-auto">
        <h2 className="text-[28px] md:text-[42px] font-bold text-center mb-12 m-0">
          Slik Fungerer Jobblo
        </h2>

        <div className="mt-15 relative">
          <div className="relative md:px-15">
            {/* Scroll Container - 'scrollbar-hide' is standard tailwind plugin class or manual fix */}
            <div
              id="guideStepContainer"
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-5 no-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="min-w-full md:min-w-[calc((100%/3)-14px)] snap-start"
                >
                  <GuideStep
                    title={step.title}
                    subtitle={step.subtitle}
                    icon={step.icon}
                  />
                </div>
              ))}
            </div>

            {/* Navigation Buttons - Hidden on mobile as per your CSS */}
            <button
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#ff8a00] items-center justify-center rounded-full! shadow-lg z-10 transition-all hover:scale-105 active:scale-95"
              onClick={handlePrevious}
            >
              <span className="material-symbols-outlined text-white text-[32px]">
                chevron_left
              </span>
            </button>

            <button
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#ff8a00] items-center justify-center rounded-full! shadow-lg z-10 transition-all hover:scale-105 active:scale-95"
              onClick={handleNext}
            >
              <span className="material-symbols-outlined text-white text-[32px]">
                chevron_right
              </span>
            </button>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: totalPages }).map((_, index) => (
              <div
                key={index}
                onClick={() => scrollToSlide(index * itemsPerView)}
                className={`cursor-pointer transition-all duration-300 h-2 ${
                  index === getCurrentPage()
                    ? "w-6 bg-[#ff8a00] rounded-sm"
                    : "w-2 bg-white/40 rounded-full hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
