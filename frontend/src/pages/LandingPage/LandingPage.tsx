import { HomeHero } from '../../components/landing/HomeHero';
import { Categories } from '../../components/landing/Categories.tsx';
import { Jobs } from '../../components/landing/Jobs.tsx';
import { Guide } from '../../components/landing/Guide.tsx';
import { HowItWorks } from '../../components/landing/HowItWorks.tsx';
import { TrustBar } from '../../components/landing/TrustBar.tsx';
import { CTABand } from '../../components/landing/CTABand.tsx';

export default function LandingPage() {
  return (
    <div className="bg-[#f5f0e8]">
      <HomeHero />
      <TrustBar />
      <Categories />
      <Jobs />

      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-9283724335529773"
        data-ad-slot="1582904938"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>

      <Guide />
      <HowItWorks />
      <CTABand />
    </div>
  );
}
