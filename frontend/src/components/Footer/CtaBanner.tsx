import LooperGroup from "../../assets/images/Footer/LooperGroup-1.svg";
import Topographic from "../../assets/images/Footer/Topographic-1.png";
import { Button } from "../Ui/Button";

export default function CtaBanner() {
  return (
      <div className="relative">
        <div className="max-w-300 mx-auto max-h-auto ">
          <div className="relative bg-[linear-gradient(180deg,#0E2A22_15.07%,#309075_215.07%)]
                          rounded-2xl p-5 md:p-8 m-4 flex items-center justify-between gap-4
                          shadow-2xl border border-emerald-600/30">

            <img src={Topographic} alt="Looper Group" className="absolute left-1 object-cover hidden md:block" />

            <img src={LooperGroup} alt="Looper Group" className="absolute right-1 object-cover hidden md:block" />
            <div>

              <h3 className="text-[28px] md:text-[32px] font-bold text-[#FFFFFF] mb-2">
                Klar til å ta neste steg?
              </h3>

              <p className="text-[#FFFFFFE5] text-sm">
                Opprett en gratis profil i dag og få tilgang til tusener av
                spennende oppdrag.
              </p>
            </div>

            <Button label="Bli med nå" className="text-[16px]! min-w-[110px] rounded-[10px] font-semibold!"/>

          </div>
        </div>
    </div>
  );
}
