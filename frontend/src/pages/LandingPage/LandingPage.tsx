import { Hero } from "../../components/landing/Hero.tsx";
import { Info } from "../../components/landing/Categories.tsx";
import { Guide } from "../../components/landing/Guide.tsx";
import { HowItWorks } from "../../components/landing/HowItWorks.tsx";

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
