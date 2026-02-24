import { UserPlus, Handshake, CheckCircle } from "lucide-react";

const steps = [
  {
    id: "01",
    title: "Opprett profil",
    description: "Registrer deg gratis på under 2 minutter",
    IconComponent: UserPlus,
  },
  {
    id: "02",
    title: "Finn oppdrag",
    description: "Søk blant tusenvis av spennende jobber",
    IconComponent: UserPlus,

  },
  {
    id: "03",
    title: "Søk og match",
    description: "Send søknad og bli kontaktet av oppdragsgiver",
    IconComponent: Handshake,
  },
  {
    id: "04",
    title: "Få betalt",
    description: "Jobb og motta trygg betaling via plattformen",
    IconComponent: CheckCircle,
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 font-sans pb-15">
      <div className="max-w-300 mx-auto">
        {/* Main Title */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-[40px] font-bold text-[#0A0A0A] mb-4">
            Kom i gang med <span className="text-[#2F7E47]">4 trinn</span>
          </h2>
          <p className="text-[#0A0A0A] text-base font-light">
            Enkelt, raskt og trygt – slik finner du ditt neste oppdrag
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => {
            const Icon = step.IconComponent;
            return (
              <div
                key={step.id}
                className="relative bg-white p-6 rounded-xl shadow-sm flex flex-col items-start min-h-61 border border-gray-100"
              >
                {/* Top Right Green Badge */}
                <div
                  className="absolute top-0 right-4 w-10 h-14 bg-[#2F7E47] text-white font-bold flex items-center justify-center text-sm"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)",
                  }}
                >
                  {step.id}
                </div>

                {/* Icon Container with Neumorphic effect */}
                <div className="size-14 bg-white rounded-lg flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-50 mb-12">
                  <Icon className="size-6 text-[#2F7E47]" strokeWidth={1.5} />
                </div>

                {/* Text Content */}
                <div className="mt-auto">
                  <h3 className="text-xl font-bold text-[#0A0A0A] mb-3.5">
                    {step.title}
                  </h3>
                  <p className="text-[#0A0A0A] text-sm font-light leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}