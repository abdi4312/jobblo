import React from "react";
import { FileText } from "lucide-react";

export const ContractsHeader: React.FC = () => {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
          <FileText size={24} className="text-custom-green" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Aktive kontrakter
        </h1>
      </div>
      <p className="text-slate-500 text-lg ml-1">
        Administrer dine tjenesteavtaler og følg fremgangen effektivt.
      </p>
    </div>
  );
};
