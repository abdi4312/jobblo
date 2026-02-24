import LooperGroup from "../../assets/images/Footer/LooperGroup-1.svg";
import Topographic from "../../assets/images/Footer/Topographic-1.png";
import { Button } from "../Ui/Button";

export default function CtaBanner() {
  return (
    <div className="absolute -top-25 z-25 w-full">
      <div className="relative">
        <div className="max-w-300 mx-auto max-h-36.5 px-6 lg:px-8 py-8">
          <div className="relative bg-[linear-gradient(180deg,#0E2A22_15.07%,#309075_215.07%)]
                          rounded-2xl p-8 flex items-center justify-between flex-wrap gap-4
                          shadow-2xl border border-emerald-600/30">

            <img src={Topographic} alt="Looper Group" className="absolute left-1 object-cover" />

            <img src={LooperGroup} alt="Looper Group" className="absolute right-1 object-cover" />
            <div>

              <h3 className="text-[32px] font-bold text-white mb-2">
                Klar til å ta neste steg?
              </h3>

              <p className="text-emerald-100 text-sm">
                Opprett en gratis profil i dag og få tilgang til tusener av
                spennende oppdrag.
              </p>
            </div>

            <Button label="Bli med nå" size="lg"></Button>

          </div>
        </div>
      </div>
    </div>
  );
}
