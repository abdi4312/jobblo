import { useOutletContext } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import type { SettingsContextType } from '../../../pages/SettingsPage';
import { formatPostalCode } from '../../../utils/norwegianFormat';
import { LocationPickerMap } from '../../CreateJobForm/LocationPickerMap';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export const AddressesView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om det er gjort endringer i noen av de tre feltene
  const isUnchanged =
    form.address === user?.address &&
    form.postNumber === user?.postNumber &&
    form.postSted === user?.postSted;

  const isDisabled = isUnchanged || updateUser?.isPending;

  const handleReverseGeocode = ({
    address,
    city,
    postNumber,
    manual,
  }: {
    address: string;
    city: string;
    postNumber?: string;
    manual?: boolean;
  }) => {
    // Fyll kun feltene ved manuelt kartklikk / dragging (ikke automatisk på åpning)
    if (!manual) return;
    if (address) handleChange('address', address);
    if (city) handleChange('postSted', city);
    if (postNumber) handleChange('postNumber', postNumber);
  };

  const locationPicker = (
    <LocationPickerMap onReverseGeocode={handleReverseGeocode} />
  );

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      {/* Gateadresse */}
      <div className="relative group">
        <label
          htmlFor="address"
          className="absolute left-4 top-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
        >
          Gateadresse
        </label>
        <input
          id="address"
          className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.address}
          onChange={(event) => handleChange('address', event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Postnummer */}
        <div className="relative group">
          <label
            htmlFor="postNumber"
            className="absolute left-4 top-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
          >
            Postnummer
          </label>
          {/* Four digits, and kept as text: `type="number"` would strip the leading
              zero from real postcodes like 0150 (Oslo). */}
          <input
            id="postNumber"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            placeholder="0150"
            className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={String(form.postNumber || '')}
            onChange={(event) => handleChange('postNumber', formatPostalCode(event.target.value))}
          />
        </div>

        {/* Sted (Poststed) */}
        <div className="relative group">
          <label
            htmlFor="postSted"
            className="absolute left-4 top-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
          >
            Sted
          </label>
          <input
            id="postSted"
            className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.postSted}
            onChange={(event) => handleChange('postSted', event.target.value)}
          />
        </div>
      </div>

      {/* Kart for å velge adresse */}
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-gray-500 uppercase tracking-tight ml-1">
          <MapPin size={13} />
          Velg adresse på kartet
        </div>
        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
            {locationPicker}
          </APIProvider>
        ) : (
          locationPicker
        )}
        <p className="mt-1.5 text-xs text-gray-400 ml-1">
          Klikk på kartet eller bruk knappen for å fylle inn adressen automatisk.
        </p>
      </div>

      {/* Handling-knapp */}
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200
          ${
            isDisabled
              ? 'cursor-not-allowed border border-[#E6E7E1] bg-[#F4F6F0] text-[#9B9E96]!'
              : 'bg-custom-green hover:bg-[#255335] active:scale-[0.98]'
          }`}
      >
        {updateUser?.isPending ? 'Lagrer...' : 'Lagre adresser'}
      </button>
    </section>
  );
};
