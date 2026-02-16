import { Hero } from "../../components/landing/hero/Hero.tsx";
import { Info } from "../../components/landing/info/Info.tsx";
import { Guide } from "../../components/landing/guide/Guide.tsx";
import { HowItWorks } from "../../components/Hero/HowItWorks.tsx";

export default function LandingPage() {
  return (
    <>
      <div>
        <div >
          <Hero />
          <div />
        </div>
        <Info />
        <Guide />
        <div className="">
          <HowItWorks />
        </div>
        {/* <Categories /> */}
        {/* <Subscription /> */}
        {/* <Testimonials /> */}
      </div>
    </>
  );
}
