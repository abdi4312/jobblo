import { Link } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export default function Footer() {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  return (
    <>
      <footer className="bg-[#111d15] text-white py-[50px] px-5 flex flex-col items-center gap-[10px]">
        {/* Columns Grid */}
        <div className="w-full max-w-[1100px] grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-[60px] text-left border-t border-[#444] pt-[30px] relative">
          {/* Kolonne 1 – Jobblo */}
          <div className="flex flex-col gap-2">
            <p className="font-medium text-[20px] md:text-[24px] mb-2.5 p-0 leading-none">
              Jobblo
            </p>
            <Link
              to="/om-oss"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Om oss
            </Link>
            <Link
              to="/tjenester"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Tjenester
            </Link>
            <Link
              to="/team"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Vårt team
            </Link>
            <button
              onClick={() => setIsPricingModalOpen(true)}
              className="text-left font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4] bg-transparent border-none p-0 cursor-pointer"
            >
              Se våre priser
            </button>
          </div>

          {/* Kolonne 2 – Kundeservice */}
          <div className="flex flex-col gap-2">
            <p className="font-medium text-[20px] md:text-[24px] mb-2.5 p-0 leading-none">
              Kundeservice
            </p>
            <Link
              to="/support"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Support
            </Link>
            <Link
              to="/annonseregler"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Annonseregler
            </Link>
          </div>

          {/* Kolonne 3 – Rettigheter */}
          <div className="flex flex-col gap-2">
            <p className="font-medium text-[20px] md:text-[24px] mb-2.5 p-0 leading-none">
              Rettigheter
            </p>
            <Link
              to="/user-term"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Brukervilkår
            </Link>
            <Link
              to="/sale-subscription-terms"
              className="text-white! font-extralight text-[14px] md:text-[16px] transition-colors hover:text-[#c4c4c4]"
            >
              Vilkår for bruk og abonnement
            </Link>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-10 text-center text-[14px] text-[#aaa]">
          <p>© 2026 Jobblo. All rights reserved.</p>
        </div>
        <PricingModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
        />
      </footer>
    </>
  );
}
