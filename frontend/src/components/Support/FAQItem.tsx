import { useState } from "react";
import { ChevronDown } from "lucide-react";
interface FAQData {
  question: string;
  answer: string;
}
function FAQItem() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const faqa: FAQData[] = [
    {
      question: "Hvordan registrerer jeg meg?",
      answer: `Klikk på "Registrer deg" øverst på siden og fyll ut skjemaet med din informasjon. Du vil motta en bekreftelse på e-post når registreringen er fullført.`,
    },
    {
      question: "Hvordan publiserer jeg et oppdrag?",
      answer: `Når du er logget inn, klikk på "+" ikonet i headeren. Fyll ut informasjon om oppdraget, legg til bilder, og publiser. Du vil starte å motta tilbud fra kvalifiserte tjenesteleverandører.`,
    },
    {
      question: "Er det trygt å betale gjennom Jobblo?",
      answer: `Ja! Vi bruker Vipps for sikker betaling. Pengene holdes i deponering til jobben er fullført og godkjent av deg. Dette beskytter både deg som kunde og tjenesteleverandøren.`,
    },
    {
      question: "Hvordan fungerer anmeldelsessystemet?",
      answer:
        "Etter at et oppdrag er fullført, kan både kunde og tjenesteleverandør gi hverandre anmeldelser. Disse anmeldelsene er verifiserte og hjelper andre brukere med å ta informerte beslutninger.",
    },
    {
      question: "Hva koster det å bruke Jobblo?",
      answer: `Det er gratis å registrere seg og browse tjenester. Vi tar en liten provisjon (10%) på fullførte oppdrag for å dekke plattformens kostnader og sikkerhet.`,
    },
    {
      question: "Hvordan kontakter jeg support?",
      answer: `Du kan sende oss en e-post til support@jobblo.no eller bruke kontaktskjemaet nedenfor. Vi svarer som regel innen 24 timer.`,
    },
    // {
    //     question: "Hvordan søker jeg på et oppdrag?",
    //     answer:
    //         "Finn et oppdrag du er interessert i og klikk på 'Send søknad' knappen i annonsen.",
    // },
    // {
    //     question: "Kan jeg kansellere et oppdrag jeg har akseptert?",
    //     answer:
    //         "Ja, men vær oppmerksom på våre avbestillingsregler som varierer ut fra tidspunktet.",
    // },
    // {
    //     question: "Hvordan fungerer vurderingssystemet?",
    //     answer:
    //         "Etter hvert oppdrag kan begge parter gi stjerner og skrive en kort omtale om opplevelsen.",
    // },
    // {
    //     question: "Er mine personlige opplysninger trygge?",
    //     answer:
    //         "Ja, vi bruker kryptering og følger strenge GDPR-regler for å beskytte dine data.",
    // },
    // {
    //     question: "Hvordan rapporterer jeg mistenkelig aktivitet?",
    //     answer:
    //         "Bruk 'Rapporter' knappen på profilen eller i chatten, eller kontakt support direkte.",
    // },
    // {
    //     question: "Hvordan administrerer jeg varslingsinnstillinger?",
    //     answer: "Du finner varslingsvalg under 'Innstillinger' i din profilmeny.",
    // },
    // {
    //     question: "Hvordan kontakter jeg kundeservice?",
    //     answer:
    //         "Du kan sende oss en e-post på support@eksempel.no eller bruke chatten nederst i hjørnet.",
    // },
  ];

  const toggleAccordion = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="py-16 px-4">
      <div className="max-w-[896px] mx-auto">
        <h2 className="text-[23px] sm:text-[28px] md:text-[32px] font-bold text-center text-custom-black mb-10">
          Ofte stilte spørsmål
        </h2>

        <div className="space-y-4">
          {faqa.map((item, index) => (
            <div
              key={index}
              className="bg-[#FFFFFF] rounded-[16px] shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggleAccordion(index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span
                  className={`text-[18px] font-semibold transition-colors duration-200 ${
                    activeIndex === index
                      ? "text-custom-green"
                      : "text-custom-black"
                  }`}
                >
                  {item.question}
                </span>
                <ChevronDown
                  size={20}
                  className={`text-green-600 transition-transform duration-300 ease-in-out ${
                    activeIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Collapsible Answer */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  activeIndex === index
                    ? "max-h-[200px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-5 pb-5 text-[14px] leading-relaxed text-gray-600">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FAQItem;
