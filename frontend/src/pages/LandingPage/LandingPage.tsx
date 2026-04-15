import { Hero } from "../../components/landing/Hero.tsx";
import { Categories } from "../../components/landing/Categories.tsx";
import { Guide } from "../../components/landing/Guide.tsx";
import { HowItWorks } from "../../components/landing/HowItWorks.tsx";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Categories />
      <Guide />
      <HowItWorks />
    </>
  );
}
