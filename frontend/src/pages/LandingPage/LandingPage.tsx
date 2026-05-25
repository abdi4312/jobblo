import { HomeHero } from "../../components/landing/HomeHero";
import { Categories } from "../../components/landing/Categories.tsx";
import { Guide } from "../../components/landing/Guide.tsx";
import { HowItWorks } from "../../components/landing/HowItWorks.tsx";
import { TrustBar } from "../../components/landing/TrustBar.tsx";
import { CTABand } from "../../components/landing/CTABand.tsx";

export default function LandingPage() {
  return (
    <div className="bg-[#f5f0e8]">
      <HomeHero />
      <TrustBar />
      <Categories />
      <Guide />
      <HowItWorks />
      <CTABand />
    </div>
  );
}
