import HeroImage from "../../../assets/images/Hero/hero_img.png";
import { Input as AppInput } from "../../Ui/Input";
import { Button as AppButton } from "../../Ui/Button";
import { MapPin, Search } from "lucide-react";


export function Hero() {

  return (
    <div className=" max-w-300 mx-auto relative overflow-hidden min-h-150 lg:min-h-0">
      {/* Background Image for Mobile and Desktop */}
      <div className="absolute right-0 bottom-0 w-full lg:w-auto ">
        <img
          src={HeroImage}
          alt="Hero image"
          className="w-full max-w-140.75 h-auto object-contain ml-auto"
        />
      </div>

      {/* Content Overlay */}
      <div className=" flex relative z-10 pt-15.75 px-4 pb-10">
        <div className="pt-11.25 flex flex-col gap-10 md:gap-16 w-full lg:w-auto">

          {/* Text Section */}
          <div>
            <h2 className="text-[32px] font-medium text-[#0A0A0A] tracking-[2px]">
              Små jobber.
            </h2>
            <h2 className="text-[48px] md:text-[64px] text-[#2F7E47] font-semibold tracking-[2px] leading-tight">
              Store muligheter.
            </h2>

            <p className="text-base text-[#0A0A0A] font-light max-w-131.75 mt-4">
              Finn eller tilby hjelp til hagearbeid, flytting, maling og mer –
              raskt og enkelt i ditt nærområde
            </p>
          </div>

          {/* Search Bar - Desktop and Mobile Overlay */}
          <div className="flex flex-col md:flex-row gap-3 p-3 bg-white/60 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
            <AppInput
              placeholder="Hvor?"
              icon={<MapPin size={15} color="#0A0A0A9E" />}
              iconPosition="left"
              containerClassName="flex-1 min-w-[200px]"
            />
            <AppInput
              placeholder="Hva trenger du hjelp til?"
              icon={<Search size={15} color="#0A0A0A9E" />}
              iconPosition="left"
              containerClassName="flex-1 min-w-[280px]"
            />
            <AppButton
              label="Søk"
              className="py-3 px-10 rounded-2xl bg-[#E48A3C] text-white font-bold"
              size="lg"
            />
          </div>

          {/* Stats Section */}
          <div className="flex text-center gap-3">
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
