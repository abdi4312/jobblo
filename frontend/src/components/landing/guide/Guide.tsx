import React from "react";
import ChooseImage from "../../../assets/images/Hero/choose_img.png";
import * as Icons from "../../../assets/icons";
// Backend se data isi format mein map hoga
const features = [
  {
    title: "Presisjon",
    description:
      "Vår smarte matching-algoritme sikrer at du finner de mest relevante oppdragene for dine ferdigheter.",
    icon: (
      <svg
        className="w-6 h-6 text-green-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="6" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Fellesskap",
    description:
      "Bli en del av et voksende nettverk av dyktige fagfolk og innovative bedrifter.",
    icon: (
      <svg
        className="w-6 h-6 text-orange-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    title: "Vekst",
    description:
      "Utvikle karrieren din med varierte prosjekter som utfordrer og inspirerer.",
    icon: (
      <svg
        className="w-6 h-6 text-green-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
  {
    title: "Trygghet",
    description:
      "Alle oppdrag er kvalitetssikret, og vi garanterer trygg betaling for utført arbeid.",
    icon: (
      <svg
        className="w-6 h-6 text-orange-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
];

export function Guide() {
  return (
    <section className="py-20 px-6 lg:px-20">
      <div className="max-w-300 mx-auto">
        {/* Header - Center aligned with Jobblo Logo touch */}
        <h2 className="text-[40px] font-bold text-center leading-10 mb-16 text-[#0A0A0A]">
          Hvorfor velge
          <span className="inline-flex items-center">
            <Icons.JobbloIcon className="w-full h-full" />
            <span className="">?</span>
          </span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Image Side */}
          <div className="relative">
            {/* Custom Arched Shape Container */}
            <div className="relative ">
              <img
                src={ChooseImage}
                alt="Worker"
                className="max-w-145 max-h-140.75 object-cover"
              />

              {/* Glassmorphism Badge */}
              <div className="absolute max-w-45 max-h-20 bottom-7 left-7 backdrop-blur-[17.6px] p-3 rounded-t-xl rounded-r-xl flex gap-3">
                <span className="text-[40px] font-semibold items-center text-[#2F7E47]">
                  250
                </span>
                <div className="flex flex-col justify-end">
                  <span className="text-base font-light text-[#0A0A0A]">
                    Jobs/Day
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Feature Cards Side */}
          <div className="flex flex-col gap-5">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-6 bg-white/60 p-6 rounded-xl border border-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:bg-white transition-all duration-300 cursor-default"
              >
                {/* Neumorphic Icon Container */}
                <div className="shrink-0 size-14 bg-white rounded-2xl flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.05),0_5px_15px_rgba(0,0,0,0.05)] border border-gray-100">
                  {feature.icon}
                </div>

                <div className="flex-col">
                  <h3 className="text-xl font-bold text-[#0A0A0A]">
                    {feature.title}
                  </h3>
                  <p className="text-[#0A0A0A] text-sm md:text-base font-light max-w-[439px]">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
