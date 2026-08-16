import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatPhone, isValidPhone, phoneDigits } from '../../utils/norwegianFormat';

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
  // The field is optional, so an empty one is not an error. Only complain once there is
  // something in it that cannot be a Norwegian number — and not while it is half typed.
  const showPhoneError = phone.length >= 8 && !isValidPhone(phone);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="box-card-custom p-4 md:p-6 rounded-[14px]">
        <h2 className="font-bold text-lg md:text-xl mb-6">Kontaktinformasjon (Valgfritt)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">
              Telefonnummer
            </label>
            {/*
              Was `type="number"`, which is wrong for a phone number in every way that
              matters: a number spinner appears beside it, scrolling the wheel over the
              focused field silently changes the value, `e`, `+` and `-` are accepted
              because they are legal in a JS number literal, and any leading zero is
              dropped. It is a `tel` field now, and the digits are grouped as they are
              typed — `412 34 567` for mobile, `22 12 34 56` for landline.

              State stays as bare digits; only the display is masked. Storing "412 34 567"
              would mean the same number is written three ways across the database.
            */}
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 select-none text-[0.9375rem] text-[#9B9E96] md:left-6">
                +47
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={formatPhone(phone)}
                onChange={(e) => setPhone(phoneDigits(e.target.value))}
                placeholder="412 34 567"
                aria-invalid={showPhoneError || undefined}
                className={`w-full rounded-xl border bg-white py-3 pl-14 pr-4 outline-none transition-all md:py-4 md:pl-18 md:pr-6 ${
                  showPhoneError
                    ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5'
                    : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'
                }`}
              />
            </div>
            {showPhoneError && (
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-red-500 animate-in fade-in slide-in-from-top-1 md:text-xs">
                <AlertCircle size={12} /> Et norsk nummer har åtte siffer.
              </p>
            )}
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
