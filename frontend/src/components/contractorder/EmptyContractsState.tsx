import React from "react";
import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";

interface EmptyContractsStateProps {
  activeFilter: "Alle" | "Sendte" | "Mottatte";
}

export const EmptyContractsState: React.FC<EmptyContractsStateProps> = ({
  activeFilter,
}) => {
  return (
    <div className="rounded-2xl p-16 text-center">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <SearchX className="text-slate-300" size={40} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">
        {activeFilter === "Alle"
          ? "Skrivebordet ditt er tomt"
          : activeFilter === "Sendte"
            ? "Ingen sendte kontrakter"
            : "Ingen mottatte kontrakter"}
      </h2>
      <p className="text-slate-500 mb-8 max-w-sm mx-auto">
        {activeFilter === "Alle"
          ? "Du har ingen ventende eller aktive kontrakter akkurat nå."
          : activeFilter === "Sendte"
            ? "Du har ikke sendt noen tjenesteavtaler ennå."
            : "Du har ikke mottatt noen tjenesteavtaler ennå."}
      </p>
      {activeFilter === "Alle" && (
        <Link
          to="/home"
          className="inline-flex items-center px-6 py-3 bg-[#3F8F6B] text-white rounded-full font-semibold hover:bg-[#327a58] transition-colors shadow-md hover:shadow-lg"
        >
          Browse Services
        </Link>
      )}
    </div>
  );
};
