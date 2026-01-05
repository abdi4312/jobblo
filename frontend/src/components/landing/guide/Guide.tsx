import styles from "./Guide.module.css";
import { GuideStep } from "./guideSteps/GuideStep.tsx";
import { useState, useEffect } from "react";

export function Guide() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const steps = [
    {
      title: "1. Opprett en bruker helt gratis",
      subtitle: "Registrer deg på få sekunder og få tilgang til alle funksjoner uten kostnad",
      icon: "person_add"
    },
    {
      title: "2. Start å søke",
      subtitle: "Gjennom jobblo vil du få muligheten til å se gjennom tusenavis av jobbannonser!",
      icon: "search"
    },
    {
      title: "3. Finn det perfekte jobben for deg",
      subtitle: "Utforsk jobber i nærheten eller søk etter spesifikke kategorier som passer dine ferdigheter",
      icon: "work"
    },
    {
      title: "4. Kontakt jobb utgiver",
      subtitle: "Bli enig på en deal eller kontrakt, og utfør arbeidet på dine egne premisser",
      icon: "handshake"
    },
    {
      title: "5. Legg ut Jobblo",
      subtitle: "Legg ut jobber for andre til å utføre for deg, spar tid og få hjelp når du trenger det",
      icon: "post_add"
    },
    {
      title: "6. Bli belønnet for å bruke Jobblo",
      subtitle: "Samle coins ved å fullføre oppdrag og bruk dem til eksklusive fordeler i appen",
      icon: "emoji_events"
    }
  ];

  const itemsPerView = isMobile ? 1 : 3;
  const totalPages = Math.ceil(steps.length / itemsPerView);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth / itemsPerView;
    const newIndex = Math.round(scrollLeft / itemWidth);
    setActiveSlide(newIndex);
  };

  const scrollToSlide = (index: number) => {
    const container = document.getElementById('guideStepContainer');
    if (container) {
      const itemWidth = container.offsetWidth / itemsPerView;
      container.scrollTo({
        left: itemWidth * index,
        behavior: 'smooth'
      });
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

  const getCurrentPage = () => {
    return Math.floor(activeSlide / itemsPerView);
  };

  return (
    <>
      <div className={styles.guideContainer}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 className={styles.guideHeading}>Slik Fungerer Jobblo</h2>
          <div style={{ marginTop: "60px" }}>
          <div className={styles.carouselWrapper}>
            <div className={styles.guideStepContainer} id="guideStepContainer" onScroll={handleScroll}>
              {steps.map((step, index) => (
                <GuideStep
                  key={index}
                  title={step.title}
                  subtitle={step.subtitle}
                  icon={step.icon}
                />
              ))}
            </div>
            <button className={styles.navButtonLeft} onClick={handlePrevious}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className={styles.navButtonRight} onClick={handleNext}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className={styles.carouselDots}>
            {Array.from({ length: totalPages }).map((_, index) => (
              <div
                key={index}
                className={`${styles.dot} ${index === getCurrentPage() ? styles.activeDot : ''}`}
                onClick={() => scrollToSlide(index * itemsPerView)}
              />
            ))}
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
