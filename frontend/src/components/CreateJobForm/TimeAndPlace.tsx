import React from "react";
import {
  MapPin,
  Calendar,
  Clock,
  Info,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useLocationTree } from "../../features/locations/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../Ui/select";

interface TimeAndPlaceProps {
  address: string;
  setAddress: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  countyCode?: string;
  setCountyCode?: (val: string) => void;
  municipalityCode?: string;
  setMunicipalityCode?: (val: string) => void;
  areaCode?: string;
  setAreaCode?: (val: string) => void;
  durationValue: string | number;
  setDurationValue: (val: string) => void;
  durationUnit: string;
  setDurationUnit: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  errors?: any;
}

export const TimeAndPlace: React.FC<TimeAndPlaceProps> = ({
  address,
  setAddress,
  city,
  setCity,
  countyCode,
  setCountyCode,
  municipalityCode,
  setMunicipalityCode,
  areaCode,
  setAreaCode,
  durationValue,
  setDurationValue,
  durationUnit,
  setDurationUnit,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  errors,
}) => {
  const { data: locationTree = [], isLoading } = useLocationTree();

  // Get selected county
  const selectedCounty = locationTree.find((c) => c.code === countyCode);
  // Get selected municipality from county's children
  const selectedMunicipality = selectedCounty?.children?.find(
    (m) => m.code === municipalityCode,
  );
  // Get selected area from municipality's children
  const selectedArea = selectedMunicipality?.children?.find(
    (a) => a.code === areaCode,
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* 1. Location Section */}
      <div className="box-card-custom rounded-[14px] p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">
              Hvor skal det gjøres?
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Oppgi adresse og lokasjon for oppdraget
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* County */}
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Fylke
            </label>
            <Select
              value={countyCode || undefined}
              onValueChange={(value) => {
                setCountyCode?.(value || "");
                setMunicipalityCode?.("");
                setAreaCode?.("");
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5">
                <SelectValue placeholder="Velg fylke" />
              </SelectTrigger>
              <SelectContent>
                {locationTree.map((county) => (
                  <SelectItem key={county.code} value={county.code}>
                    {county.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Municipality */}
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Kommune
            </label>
            <Select
              value={municipalityCode || undefined}
              onValueChange={(value) => {
                const newMunicipalityCode = value || "";
                setMunicipalityCode?.(newMunicipalityCode);
                setAreaCode?.("");
                // Also update city text field with municipality name
                const county = locationTree.find((c) => c.code === countyCode);
                const municipality = county?.children?.find(
                  (m) => m.code === newMunicipalityCode,
                );
                if (municipality) {
                  setCity(municipality.name);
                } else {
                  setCity?.("");
                }
              }}
              disabled={!countyCode || isLoading}
            >
              <SelectTrigger className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5">
                <SelectValue placeholder="Velg kommune" />
              </SelectTrigger>
              <SelectContent>
                {selectedCounty?.children?.map((municipality) => (
                  <SelectItem key={municipality.code} value={municipality.code}>
                    {municipality.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Area */}
          {selectedMunicipality?.children &&
            selectedMunicipality.children.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Bydel / Område
                </label>
                <Select
                  value={areaCode || undefined}
                  onValueChange={(value) => setAreaCode?.(value || "")}
                  disabled={!municipalityCode || isLoading}
                >
                  <SelectTrigger className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5">
                    <SelectValue placeholder="Velg bydel (valgfritt)" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedMunicipality.children.map((area) => (
                      <SelectItem key={area.code} value={area.code}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          {/* Address */}
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
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all
                ${errors?.address ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5" : "border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5"}`}
            />
            {errors?.address && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.address}
              </p>
            )}
          </div>

          {/* City (kept for backwards compatibility) */}
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              By / Sted *
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!!municipalityCode}
              required
              placeholder="F.eks. Oslo"
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all
                ${errors?.city ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5" : "border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5"}
                ${!!municipalityCode ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            {errors?.city && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.city}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Time Section */}
      <div className="box-card-custom rounded-[14px] p-4 md:p-6">
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
              Fra dato *
            </label>
            <input
              title="Velg fra dato"
              required
              type="date"
              value={fromDate ? fromDate.split("T")[0] : ""}
              onChange={(e) => setFromDate(e.target.value)}
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all cursor-pointer
                ${errors?.fromDate ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5" : "border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5"}`}
            />
            {errors?.fromDate && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.fromDate}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Til dato *
            </label>
            <input
              title="Velg til dato"
              required
              type="date"
              value={toDate ? toDate.split("T")[0] : ""}
              onChange={(e) => setToDate(e.target.value)}
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all cursor-pointer
                ${errors?.toDate ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5" : "border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5"}`}
            />
            {errors?.toDate && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.toDate}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 md:mt-6 flex items-start gap-3 p-3 md:p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-xs md:text-sm">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>La feltene stå tomme dersom du er fleksibel på tidspunkt.</p>
        </div>
      </div>

      {/* 3. Duration Section */}
      <div className="box-card-custom rounded-[14px] p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">
              Forventet varighet *
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Hvor lang tid antar du oppdraget tar?
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          <div className="flex-1 space-y-2">
            <input
              type="number"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              placeholder="0"
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all
                ${errors?.durationValue ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5" : "border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5"}`}
            />
            {errors?.durationValue && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.durationValue}
              </p>
            )}
          </div>
          <div className="h-fit">
            <Select
              value={durationUnit || undefined}
              onValueChange={(value) => setDurationUnit(value)}
            >
              <SelectTrigger className="w-full sm:w-32 md:w-40 px-4 md:px-4 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base font-bold text-[#2D7A4D]">
                <SelectValue placeholder="Velg" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutter</SelectItem>
                <SelectItem value="hours">Timer</SelectItem>
                <SelectItem value="days">Dager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
