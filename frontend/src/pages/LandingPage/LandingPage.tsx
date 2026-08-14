import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HomeHero } from '../../components/landing/HomeHero';
import { Categories } from '../../components/landing/Categories.tsx';
import { SafePayExplainer } from '../../components/landing/SafePayExplainer.tsx';
import { HowItWorks } from '../../components/landing/HowItWorks.tsx';
import { Jobs } from '../../components/landing/Jobs.tsx';
import { TrustBar } from '../../components/landing/TrustBar.tsx';
import { CTABand } from '../../components/landing/CTABand.tsx';
import { getCookieConsent } from '../../utils/cookieConsent';
import { CONTAINER } from '../../theme/brand';

/**
 * The marketing page, ordered as the questions a first-time visitor actually asks:
 *
 *   what do I need? → what can I get help with? → is my money safe? →
 *   how does it work? → who needs help right now?
 *
 * The sections number themselves 01–04 and sit on one page tint; the only breaks in it
 * are the ones that mean something — the moving trust strip under the hero, and the
 * inverted SafePay block, which owns its own background. `Guide` is no longer here — it
 * listed four generic virtues over a stock photo badged "250+ jobber per dag", a figure
 * nothing measured. `SafePayExplainer` replaces it with the thing a customer actually
 * decides on, stated from the real behaviour of the payment code.
 *
 * "What does it cost?" is answered by `/pricing`, which owns that question in full — the
 * hero and the header both link there rather than the page carrying a second, shorter
 * version of the same table that would have to be kept in step with it.
 *
 * The AdSense slot that used to sit mid-page rendered an empty `<ins>` for every visitor
 * whether or not they had accepted cookies, and nothing ever pushed to `adsbygoogle`. Ads
 * are loaded by `cookieConsent.ts` after an explicit accept; the slot only renders once
 * that has happened and a client id is configured.
 */
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

export default function LandingPage() {
  const { hash } = useLocation();
  const showAds = Boolean(ADSENSE_CLIENT) && getCookieConsent() === 'accepted';

  // The header links to #slik-fungerer-det and #kategorier. ScrollToTop runs on
  // navigation, so the jump is deferred a frame to land after it rather than be undone.
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <div className="bg-[#EFF0EA]">
      <HomeHero />
      <TrustBar />

      <Categories />

      <SafePayExplainer />

      <HowItWorks />

      {showAds && (
        <div className={CONTAINER}>
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot="1582904938"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      )}

      <Jobs />

      <CTABand />
    </div>
  );
}
