import React from "react";
import { MapPin, Calendar, Clock, Info } from "lucide-react";

interface TimeAndPlaceProps {
  address: string;
  setAddress: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  durationValue: string | number;
  setDurationValue: (val: string) => void;
  durationUnit: string;
  setDurationUnit: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
}

export const TimeAndPlace: React.FC<TimeAndPlaceProps> = ({
  address,
  setAddress,
  city,
  setCity,
  durationValue,
  setDurationValue,
  durationUnit,
  setDurationUnit,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}) => {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* 1. Location Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">
              Hvor skal det gjøres?
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Oppgi adresse og by for oppdraget
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Gateadresse *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              placeholder="F.eks. Storgata 1"
              className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base outline-none focus:border-[#2D7A4D] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              By / Sted *
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="F.eks. Oslo"
              className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base outline-none focus:border-[#2D7A4D] transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. Time Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">
              Når skal det gjøres?
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Velg datoer som passer for deg
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Fra dato
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base outline-none focus:border-[#2D7A4D] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Til dato
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base outline-none focus:border-[#2D7A4D] transition-all"
            />
          </div>
        </div>

        <div className="mt-4 md:mt-6 flex items-start gap-3 p-3 md:p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-xs md:text-sm">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>La feltene stå tomme dersom du er fleksibel på tidspunkt.</p>
        </div>
      </div>

      {/* 3. Duration Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">
              Forventet varighet
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Hvor lang tid antar du oppdraget tar?
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                    <input
                        type="number"
                        value={durationValue}
                        onChange={(e) => setDurationValue(e.target.value)}
                        placeholder="0"
                        className="flex-1 px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base outline-none focus:border-[#2D7A4D] transition-all"
                    />
                    <div className="relative">
                        <select
                            value={durationUnit}
                            onChange={(e) => setDurationUnit(e.target.value)}
                            className="w-full sm:w-32 md:w-40 px-4 md:px-4 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base font-bold text-[#2D7A4D] outline-none focus:border-[#2D7A4D] transition-all appearance-none cursor-pointer pr-10"
                        >
                            <option value="minutes">Minutter</option>
                            <option value="hours">Timer</option>
                            <option value="days">Dager</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#2D7A4D]">
                            <Clock size={16} />
                        </div>
                    </div>
                </div>
      </div>
    </div>
  );
};
