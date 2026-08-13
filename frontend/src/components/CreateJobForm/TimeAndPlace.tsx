import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  Info,
  AlertCircle,
  CheckCircle2,
  Crosshair,
} from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useLocationTree } from '../../features/locations/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Ui/select';
import { LocationPickerMap } from './LocationPickerMap';
import { AddressAutocomplete } from './AddressAutocomplete';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

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
  coordinates?: [number, number] | null;
  setCoordinates?: (val: [number, number]) => void;
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
  coordinates,
  setCoordinates,
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

  // Local flag — true once the user has either picked an address from the
  // autocomplete, clicked the map, or used "use my current location".
  // We only consider the location "confirmed" if coordinates are set AND
  // the address field has a value (typed or picked).
  const [locationConfirmed, setLocationConfirmed] = useState<boolean>(
    !!(coordinates && address)
  );

  // Get selected county
  const selectedCounty = locationTree.find((c) => c.code === countyCode);
  // Get selected municipality from county's children
  const selectedMunicipality = selectedCounty?.children?.find(
    (m) => m.code === municipalityCode
  );
  // Get selected area from municipality's children
  const selectedArea = selectedMunicipality?.children?.find(
    (a) => a.code === areaCode
  );

  // Sync the local confirmation state with the actual form state.
  useEffect(() => {
    if (coordinates && address) {
      setLocationConfirmed(true);
    }
  }, [coordinates, address]);

  const handleCoordinatesChange = (coords: [number, number]) => {
    setCoordinates?.(coords);
    setLocationConfirmed(true);
  };

  const handleAddressSelect = ({
    address: fullAddress,
    city: addrCity,
    lat,
    lng,
  }: {
    address: string;
    city: string;
    lat: number;
    lng: number;
  }) => {
    setAddress(fullAddress);
    if (addrCity) setCity(addrCity);
    if (setCoordinates && lat && lng) {
      setCoordinates([lat, lng]);
      setLocationConfirmed(true);
    }
  };

  // Surface a synthetic error for the address/location block when the user has
  // typed something but never confirmed it (no map click, no autocomplete pick,
  // no geolocation). The validation schema itself doesn't know about this
  // state, so we inject it here.
  const locationError =
    errors?.address ||
    (address && !locationConfirmed
      ? 'Trykk på kartet eller velg en adresse fra forslagene for å bekrefte lokasjonen.'
      : !address && errors?.address
        ? errors.address
        : undefined);

  const locationFields = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* County */}
        <div className="space-y-2">
          <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
            Fylke <span className="text-red-500">*</span>
          </label>
          <Select
            value={countyCode || undefined}
            onValueChange={(value) => {
              setCountyCode?.(value || '');
              setMunicipalityCode?.('');
              setAreaCode?.('');
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
            Kommune <span className="text-red-500">*</span>
          </label>
          <Select
            value={municipalityCode || undefined}
            onValueChange={(value) => {
              const newMunicipalityCode = value || '';
              setMunicipalityCode?.(newMunicipalityCode);
              setAreaCode?.('');
              // Also update city text field with municipality name
              const county = locationTree.find((c) => c.code === countyCode);
              const municipality = county?.children?.find(
                (m) => m.code === newMunicipalityCode
              );
              if (municipality) {
                setCity(municipality.name);
              } else {
                setCity?.('');
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
        {selectedMunicipality?.children && selectedMunicipality.children.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Bydel / Område
            </label>
            <Select
              value={areaCode || undefined}
              onValueChange={(value) => setAreaCode?.(value || '')}
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
            Gateadresse <span className="text-red-500">*</span>
          </label>
          <AddressAutocomplete
            value={address}
            onValueChange={setAddress}
            onAddressSelect={handleAddressSelect}
            error={locationError}
            placeholder="F.eks. Storgata 1"
          />
        </div>

        {/* City (kept for backwards compatibility) */}
        <div className="space-y-2">
          <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
            By / Sted <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!!municipalityCode}
            required
            placeholder="F.eks. Oslo"
            className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all
              ${errors?.city ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'}
              ${!!municipalityCode ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
          {errors?.city && (
            <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={12} /> {errors.city}
            </p>
          )}
        </div>
      </div>

      {/* Location map */}
      <div className="mt-5 md:mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crosshair size={15} className="text-[#2D7A4D]" />
            <span className="text-[12px] md:text-[13px] font-bold text-gray-700">
              Bekreft lokasjon på kartet
              <span className="text-red-500 ml-0.5">*</span>
            </span>
          </div>
          {locationConfirmed && coordinates && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
              <CheckCircle2 size={12} />
              {coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}
            </span>
          )}
        </div>

        <LocationPickerMap
          coordinates={coordinates}
          onCoordinatesChange={handleCoordinatesChange}
          onReverseGeocode={({ address: geoAddress, city: geoCity, manual }) => {
            if (geoAddress && (manual || !address)) setAddress(geoAddress);
            // When a kommune is selected the city field is locked to its name, so
            // letting the geocoder write over it would put the two out of sync.
            if (geoCity && !municipalityCode) setCity(geoCity);
          }}
        />

        {!locationConfirmed && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[12px]">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>
              <span className="font-bold">Tips:</span> Klikk på kartet, dra i
              markøren, eller bruk "Bruk min nåværende posisjon" for å bekrefte
              lokasjonen. Bare å skrive adressen er ikke nok.
            </p>
          </div>
        )}
      </div>
    </>
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
              Oppgi adresse og bekreft lokasjon på kartet
            </p>
          </div>
        </div>

        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
            {locationFields}
          </APIProvider>
        ) : (
          locationFields
        )}
      </div>

      {/* 2. Time Section */}
      <div className="box-card-custom rounded-[14px] p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">Når skal det gjøres?</h2>
            <p className="text-gray-500 text-xs md:text-sm">Velg datoer som passer for deg</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Fra dato <span className="text-red-500">*</span>
            </label>
            <input
              title="Velg fra dato"
              required
              type="date"
              value={fromDate ? fromDate.split('T')[0] : ''}
              onChange={(e) => setFromDate(e.target.value)}
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all cursor-pointer
                ${errors?.fromDate ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'}`}
            />
            {errors?.fromDate && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.fromDate}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider ml-1">
              Til dato <span className="text-red-500">*</span>
            </label>
            <input
              title="Velg til dato"
              required
              type="date"
              value={toDate ? toDate.split('T')[0] : ''}
              onChange={(e) => setToDate(e.target.value)}
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all cursor-pointer
                ${errors?.toDate ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'}`}
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
              Forventet varighet <span className="text-red-500">*</span>
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Hvor lang tid antar du at oppdraget tar?
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          <div className="flex-1 space-y-2">
            <input
              type="number"
              min={1}
              value={durationValue ?? ''}
              onChange={(e) => setDurationValue(e.target.value)}
              placeholder="F.eks. 2"
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all
                ${errors?.durationValue ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'}`}
            />
            {errors?.durationValue && (
              <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={12} /> {errors.durationValue}
              </p>
            )}
          </div>
          <div className="h-fit space-y-2">
            <Select
              value={durationUnit || undefined}
              onValueChange={(value) => setDurationUnit(value)}
            >
              <SelectTrigger className="w-full sm:w-32 md:w-40 px-4 md:px-4 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-sm md:text-base font-bold text-[#2D7A4D] focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5">
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

        <div className="mt-4 md:mt-6 flex items-start gap-3 p-3 md:p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-xs md:text-sm">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>
            Et grovt anslag er nok — du kan alltid justere dette senere i samtalen
            med søkere.
          </p>
        </div>
      </div>
    </div>
  );
};
