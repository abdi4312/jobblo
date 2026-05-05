import HeroImage from "../../assets/images/Hero/hero_img.png";
import Search from "./search";

export function Hero() {
  return (
    <div className="max-w-300 mx-auto md:flex md:flex-row mb-12 lg:mb-24 relative min-h-auto">
      {/* Background Image for Mobile and Desktop */}
      <div className="flex flex-col gap-2 items-center justify-center text-center mb-4 md:hidden">
        <h2 className="text-[20px] font-medium text-custom-black leading-5">
          Små jobber.
        </h2>
        <h2 className="text-[28px] md:text-[64px] text-custom-green font-semibold leading-5">
          Store muligheter.
        </h2>

        <p className="text-[12px] text-custom-black font-normal max-w-75">
          Finn eller tilby hjelp til hagearbeid, flytting, maling og mer – raskt
          og enkelt i ditt nærområde
        </p>
      </div>

      <div className="md:absolute relative right-0 bottom-0 md:top-0 w-full md:w-auto">
        <img
          src={HeroImage}
          alt="Hero image"
          className="w-75 sm:w-100 lg:w-138.75 md:max-w-140.75 h-auto object-contain mx-auto"
        />
      </div>

      {/* Content Overlay */}
      <div className="flex -mt-11 md:mt-11 lg:mt-0 inset-0 md:relative z-10 items-center justify-center md:items-start md:justify-start xl:pt-15.75 px-4">
        <div className="max-w-110 sm:max-w-140 lg:max-w-165 flex flex-col gap-10 md:gap-16 w-full lg:w-auto">
          {/* Text Section */}
          <div className="max-w-[70%] lg:max-w-full hidden md:block">
            <h2 className="md:text-[24px] lg:text-[32px] font-medium text-custom-black tracking-[2px]">
              Små jobber.
            </h2>
            <h2 className="md:text-[32px] lg:text-[64px] text-custom-green font-semibold tracking-[2px] leading-tight">
              Store muligheter.
            </h2>

            <p className="text-base text-custom-black font-light md:max-w-100.75 lg:max-w-131.75 mt-4">
              Finn eller tilby hjelp til hagearbeid, flytting, maling og mer –
              raskt og enkelt i ditt nærområde
            </p>
          </div>

          {/* Search Section */}
          <Search />

          {/* Stats Section */}
          <div className="flex text-center justify-center md:justify-start gap-3">
            <div className="p-3 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20 min-w-35">
              <h2 className="text-custom-green text-[24px] font-bold">5000+</h2>
              <p className="text-[#676767] font-light">Aktive oppdrag</p>
            </div>
            <div className="p-3 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20 min-w-35">
              <h2 className="text-custom-green text-[24px] font-bold">5000+</h2>
              <p className="text-[#676767] font-light">Aktive oppdrag</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
