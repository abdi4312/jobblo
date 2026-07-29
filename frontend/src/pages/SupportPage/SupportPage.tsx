import { useEffect } from 'react';
import FAQItem from '../../components/Support/FAQItem';
import Contact from '../../components/Support/Contact';

export default function SupportPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="-mt-6 md:-mt-16">
      {/* Simple Header */}
      <div className="flex flex-col gap-4 justify-center items-center bg-[linear-gradient(180deg,#2F7E47_0%,#1E5230_100%)] text-white py-12 md:py-16 px-4 text-center">
        <h1 className="text-2xl md:text-4xl font-bold">Kundesenter</h1>
        <p className="text-white/80 text-sm md:text-base max-w-md">
          Finn svar på vanlige spørsmål eller ta kontakt med oss
        </p>
      </div>

      <FAQItem />

      <Contact />
    </div>
  );
}
