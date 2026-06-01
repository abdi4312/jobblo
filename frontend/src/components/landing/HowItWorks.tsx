import { UserPlus, Search, MessageCircle, ShieldCheck } from "lucide-react";

const steps = [
  {
    id: "01",
    title: "Opprett profil",
    description: "Registrer deg gratis på under 2 minutter og kom i gang med en gang.",
    icon: UserPlus,
  },
  {
    id: "02",
    title: "Finn oppdrag",
    description: "Søk blant tusenvis av spennende jobber i nærområdet ditt.",
    icon: Search,
  },
  {
    id: "03",
    title: "Søk og match",
    description: "Send søknad og bli kontaktet av oppdragsgiver direkte i appen.",
    icon: MessageCircle,
  },
  {
    id: "04",
    title: "Få betalt trygt",
    description: "Jobb og motta trygg betaling via SafePay når jobben er godkjent.",
    icon: ShieldCheck,
  },
];

export function HowItWorks() {
  return (
    <section className="py-7 px-5 sm:px-12 max-w-275 mx-auto">
      <div className="text-center mb-9">
        <h2 className="text-[28px] font-normal text-custom-black">
          Kom i gang med <em className="text-custom-green not-italic">4 trinn</em>
        </h2>
        <p className="text-[14px] text-custom-black/50 mt-1.5">Enkelt, raskt og trygt – slik finner du ditt neste oppdrag</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className="bg-white border border-black/10 rounded-[16px] p-6 relative overflow-hidden group hover:border-custom-green transition-colors"
          >
            <div className="absolute top-3.5 right-3.5 width-[28px] height-[28px] bg-custom-green text-white rounded-lg text-[12px] font-medium flex items-center justify-center w-7 h-7">
              {step.id}
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#f0faf0] flex items-center justify-center mb-4">
              <step.icon className="text-custom-green" size={24} />
            </div>
            <h3 className="text-[14px] font-medium text-custom-black mb-1.5">{step.title}</h3>
            <p className="text-[12px] text-custom-black/50 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
