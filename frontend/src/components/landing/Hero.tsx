import HeroImage from "../../assets/images/Hero/hero_img.png";
import { Input as AppInput } from "../Ui/Input";
import { Button as AppButton } from "../Ui/Button";
import { MapPin, Search } from "lucide-react";


export function Hero() {

  return (
    <div className="max-w-300 mx-auto md:flex md:flex-row mb-12 lg:mb-24 relative overflow-hidden min-h-auto">
      {/* Background Image for Mobile and Desktop */}
      <div className="flex flex-col gap-2 items-center justify-center text-center mb-4 md:hidden">
        <h2 className="text-[20px] font-medium text-[#0A0A0A] leading-5">
          Små jobber.
        </h2>
        <h2 className="text-[28px] md:text-[64px] text-[#2F7E47] font-semibold leading-5">
          Store muligheter.
        </h2>

        <p className="text-[12px] text-[#0A0A0A] font-normal max-w-75">
          Finn eller tilby hjelp til hagearbeid, flytting, maling og mer –
          raskt og enkelt i ditt nærområde
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
            <h2 className="md:text-[24px] lg:text-[32px] font-medium text-[#0A0A0A] tracking-[2px]">
              Små jobber.
            </h2>
            <h2 className="md:text-[32px] lg:text-[64px] text-[#2F7E47] font-semibold tracking-[2px] leading-tight">
              Store muligheter.
            </h2>

            <p className="text-base text-[#0A0A0A] font-light md:max-w-100.75 lg:max-w-131.75 mt-4">
              Finn eller tilby hjelp til hagearbeid, flytting, maling og mer –
              raskt og enkelt i ditt nærområde
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-white/40 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 w-full max-w-5xl mx-auto">
            {/* First Input - 4 columns on desktop */}
            <div className="md:col-span-4">
              <AppInput
                placeholder="Hvor?"
                icon={<MapPin size={15} color="#0A0A0A9E" />}
                iconPosition="left"
                containerClassName="max-w-[194px] sm:max-w-[240px] mx-auto"
              />
            </div>

            {/* Second Input - 6 columns on desktop */}
            <div className="md:col-span-8 flex gap-4 w-full">
              <div className="w-full">
                <AppInput
                  placeholder="Hva trenger du hjelp til?"
                  icon={<Search size={15} color="#0A0A0A9E" />}
                  iconPosition="left"
                  containerClassName="w-full lg:max-w-[314px]"
                />
              </div>

              {/* Button - 2 columns on desktop */}
              <div className="">
                <AppButton
                  label="Søk"
                  className="w-full py-3 px-0 rounded-2xl bg-[#E48A3C] text-white font-bold h-full hidden! lg:block!"
                  size="lg"
                />
                <AppButton
                  icon={<Search size={24} />}
                  className="w-full p-2.5! rounded-2xl bg-[#E48A3C] text-white font-bold h-full lg:hidden"
                />
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="flex text-center justify-center md:justify-start gap-3">
            <div className="p-3 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20 min-w-35">
              <h2 className="text-[#2F7E47] text-[24px] font-bold">5000+</h2>
              <p className="text-[#676767] font-light">Aktive oppdrag</p>
            </div>
            <div className="p-3 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20 min-w-35">
              <h2 className="text-[#2F7E47] text-[24px] font-bold">5000+</h2>
              <p className="text-[#676767] font-light">Aktive oppdrag</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
