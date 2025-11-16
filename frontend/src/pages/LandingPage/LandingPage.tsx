import styles from "./LandingPage.module.css";
import { Hero } from "../../components/landing/hero/Hero.tsx";
import { Info } from "../../components/landing/info/Info.tsx";
import { Guide } from "../../components/landing/guide/Guide.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import { Subscription } from "../../components/landing/subscription/Subscription.tsx";
import { Testimonials } from "../../components/landing/testemonials/Testimonials.tsx";

export default function LandingPage() {
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
        <Subscription />
        <Testimonials />
      </div>
    </>
  );
}
