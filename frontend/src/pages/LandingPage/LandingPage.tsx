import styles from "./LandingPage.module.css";
import { Hero } from "../../components/landing/hero/Hero.tsx";
import { Info } from "../../components/landing/info/Info.tsx";
import { Guide } from "../../components/landing/guide/Guide.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import { Subscription } from "../../components/landing/subscription/Subscription.tsx";
import { Testimonials } from "../../components/landing/testemonials/Testimonials.tsx";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem('hasVisitedLanding');
    // Check if they came from internal navigation (location.state will be set)
    const isInternalNavigation = location.state?.fromInternal;
    
    // Only redirect if they've visited before AND NOT from internal navigation
    if (hasVisited && !isInternalNavigation) {
      navigate('/job-listing');
    } else if (!hasVisited) {
      // Mark as visited on first visit
      localStorage.setItem('hasVisitedLanding', 'true');
    }
  }, [navigate, location]);

  return (
    <>
      <div className={styles.landingPageContent}>
        <div>
          <Hero />
          <div className={styles.orangeBar} />
        </div>
        <Info />
        <Guide />
        <Categories />
        {/* <Subscription /> */}
        <Testimonials />
      </div>
    </>
  );
}
