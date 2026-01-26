import { Divider } from "antd";

export function Testimonials() {
  return (
    <section className="bg-[#fbecd5] py-10 px-5">
      <div className="max-w-[900px] mx-auto">
        
        {/* Title */}
        <h2 className="text-[32px] md:text-[42px] font-bold text-center mb-12 text-[#183A1D] leading-tight">
          Hva andre sier om oss
        </h2>

        {/* Testimonial 1 - Text Left, Image Right (on Desktop) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-5 md:gap-10">
          <p className="text-base md:text-xl font-semibold text-gray-800 text-center md:text-left leading-relaxed">
            Jobblo har bistått oss med å flytte kontor gjentatte ganger med
            dyktige arbeidere som er kvalitet sjekket
          </p>
          <img 
            src="src/assets/images/testimonial2.png" 
            alt="obos logo" 
            className="w-[120px] md:w-[170px] h-auto object-contain shrink-0"
          />
        </div>

        {/* Custom Divider - Tailwind style */}
        <div className="my-8">
          <Divider className="border-gray-300" />
        </div>

        {/* Testimonial 2 - Image Left, Text Right (on Desktop) */}
        <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-5 md:gap-10">
          <img 
            src="src/assets/images/testimonial1.png" 
            alt="user testimonial" 
            className="w-[120px] md:w-[170px] h-auto object-contain shrink-0"
          />
          <p className="text-base md:text-xl font-semibold text-gray-800 text-center md:text-left leading-relaxed">
            Jeg har endelig fått jobb og tjener penger ved bruk av jobblo
          </p>
        </div>

      </div>
    </section>
  );
}