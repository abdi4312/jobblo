import { Link } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export default function Footer() {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const links = [
    { to: "/om-oss", label: "Om oss" },
    { to: "/tjenester", label: "Tjenester" },
    { to: "/team", label: "Vårt team" },
    { to: "/user-term", label: "Brukervilkår" },
    { to: "/sale-subscription-terms", label: "Vilkår for bruk og abonnement" },
    { to: "/support", label: "Support" },
    { to: "/annonseregler", label: "Annonseregler" },
  ];

  return (
    <>
      <footer className="flex flex-col items-center gap-2.5 bg-gray-900 text-white py-12">
        <p className="font-medium text-2xl mb-2.5">Jobblo</p>
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="font-light text-white! hover:text-gray-300"
          >
            {label}
          </Link>
        ))}
        <a
          onClick={() => setIsPricingModalOpen(true)}
          className="font-light text-white! hover:text-gray-300"
        >
          Se våre priser
        </a>
      </footer>

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </>
  );
}
