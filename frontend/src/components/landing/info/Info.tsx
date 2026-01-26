import * as Icons from "../../../assets/icons";

export function Info() {
  return (
    <div className="max-w-225 mx-auto px-5 py-10">
      {/* Title Section */}
      <div className="flex flex-row justify-center items-center pb-8 text-center">
        <h2 className="text-[32px] md:text-[48px] m-0 font-bold text-black">
          Hva er 
        </h2>
        <Icons.JobbloIcon className="w-37.5 h-15 md:w-50 md:h-20 -translate-y-1 md:-translate-y-2" />
      </div>

      {/* Content Wrapper */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-0 md:gap-4">
        {/* Text Container */}
        <div className="w-full md:w-[55%] p-0 md:p-5 pb-5 flex flex-col gap-5">
          <p className="m-0 text-[18px] md:text-[20px] font-bold leading-[1.7] text-[#ff8a00]">
            Jobblo er en enkel plattfrom som tillatter trygg måte å finne,
            avtale og betale for småjobber og håndverkstjenester i hele Norge.
          </p>
          <p className="m-0 text-[16px] md:text-[18px] leading-[1.7] text-[#555]">
            Enten det gjelder plenklipping, barnepass, maling eller
            flyttehjelp, gjør vi det enkelt å finne folk du kan stole på, rett
            i nærheten. For privatpersoner, bedrifter og alle imellom.
          </p>
        </div>

        {/* Image Section */}
        <div className="w-full md:w-[45%] flex justify-center">
          <img
            className="object-cover w-[60%] md:w-full max-w-62.5 md:max-w-none rounded-xl"
            src="/src/assets/images/woman-gardening.png"
            alt="Person gardening"
          />
        </div>
      </div>
    </div>
  );
}