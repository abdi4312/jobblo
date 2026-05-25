import ChooseImage from "../../assets/images/Hero/choose_img.png";
import { Target, Users, TrendingUp, ShieldCheck, UserCircle } from "lucide-react";

const features = [
  {
    title: "Presisjon",
    description: "Vår smarte matching-algoritme sikrer at du finner de mest relevante oppdragene for dine ferdigheter.",
    icon: Target,
  },
  {
    title: "Fellesskap",
    description: "Bli en del av et voksende nettverk av dyktige fagfolk og innovative bedrifter.",
    icon: Users,
  },
  {
    title: "Vekst",
    description: "Utvikle karrieren din med varierte prosjekter som utfordrer og inspirerer.",
    icon: TrendingUp,
  },
  {
    title: "Trygghet",
    description: "Alle oppdrag er kvalitetssikret, og vi garanterer trygg betaling for utført arbeid via SafePay.",
    icon: ShieldCheck,
  },
];

export function Guide() {
  return (
    <section className="py-15 px-12 max-w-[1100px] mx-auto">
      <div className="text-center mb-9">
        <h2 className="text-[28px] font-normal text-custom-black">
          Hvorfor velge <em className="text-custom-green not-italic">Jobblo</em>?
        </h2>
        <p className="text-[14px] text-custom-black/50 mt-1.5">Vi gjør det enkelt, trygt og lønnsomt</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Left: Image Side */}
        <div className="bg-[#e8e0d0] rounded-[50%_50%_50%_50%_/_55%_55%_45%_45%] h-[380px] flex items-center justify-center relative overflow-hidden">
          {ChooseImage ? (
            <img src={ChooseImage} alt="Worker" className="w-full h-full object-cover" />
          ) : (            <UserCircle size={80} className="text-black/20" />
          )}
          <div className="absolute bottom-[30px] left-[30px] bg-custom-green text-white rounded-xl p-2.5 px-4 shadow-lg">
            <strong className="block text-[22px] font-medium">250+</strong>
            <span className="text-[11px] opacity-85">Jobber per dag</span>
          </div>
        </div>

        {/* Right: Feature Cards Side */}
        <div className="flex flex-col gap-3">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-white border border-black/10 rounded-[14px] p-4 flex items-start gap-3.5 hover:border-custom-green transition-colors"
            >
              <div className="w-[38px] h-[38px] rounded-lg bg-[#f0faf0] flex items-center justify-center shrink-0">
                <feature.icon className="text-custom-green" size={20} />
              </div>
              <div>
                <h3 className="text-[14px] font-medium text-custom-black mb-0.5">{feature.title}</h3>
                <p className="text-[12px] text-custom-black/50 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
