import styles from "./LandingPage.module.css";
import { Hero } from "../../components/landing/hero/Hero.tsx";
import { Info } from "../../components/landing/info/Info.tsx";
import { Guide } from "../../components/landing/guide/Guide.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import { Subscription } from "../../components/landing/subscription/Subscription.tsx";
import { Testimonials } from "../../components/landing/testemonials/Testimonials.tsx";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem('hasVisitedLanding');
    
    if (hasVisited) {
      // Redirect to job listing page if they've visited before
      navigate('/job-listing');
    } else {
      // Mark as visited for future visits
      localStorage.setItem('hasVisitedLanding', 'true');
    }
  }, [navigate]);

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
