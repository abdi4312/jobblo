import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ContactInformationProps {
  phone: string;
  setPhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  summary: {
    title: string;
    categories: string | string[];
    address: string;
    city: string;
    price: string | number;
    paymentType: string;
  };
  errors?: any;
}

export const ContactInformation: React.FC<ContactInformationProps> = ({
  phone,
  setPhone,
  email,
  setEmail,
  summary,
  errors,
}) => {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="box-card-custom p-4 md:p-6 rounded-[14px]">
        <h2 className="font-bold text-lg md:text-xl mb-6">Kontaktinformasjon (Valgfritt)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">
              Telefonnummer
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ditt nummer"
              className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white outline-none focus:border-[#2D7A4D] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">
              E-post
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@epost.no"
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white outline-none transition-all
                ${errors?.email ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'}`}
            />
            {errors?.email && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.email}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="box-card-custom p-4 md:p-6 rounded-[14px]">
        <h3 className="font-bold text-lg mb-4">Oppsummering</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-sm">
          <div className="flex justify-between sm:block">
            <span className="text-gray-500">Tittel:</span>
            <div className="font-semibold truncate sm:mt-1">{summary.title}</div>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-gray-500">Kategori:</span>
            <div className="font-semibold sm:mt-1">
              {Array.isArray(summary.categories)
                ? summary.categories.join(', ')
                : summary.categories}
            </div>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-gray-500">Sted:</span>
            <div className="font-semibold sm:mt-1">
              {summary.address}, {summary.city}
            </div>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-gray-500">Pris:</span>
            <div className="font-semibold sm:mt-1">
              {summary.price} NOK ({summary.paymentType})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
