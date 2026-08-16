import { useOutletContext } from 'react-router-dom';
import type { SettingsContextType } from '../../../pages/SettingsPage';
import { formatPhone, isValidPhone, phoneDigits } from '../../../utils/norwegianFormat';

export const PhoneView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om inndataverdien er den samme som det opprinnelige telefonnummeret
  const isUnchanged = form.phone === user?.phone;
  const isDisabled = isUnchanged || updateUser?.isPending;

  /**
   * Digits only, country code stripped, capped at eight.
   *
   * This used to keep a leading `+` and everything after it verbatim, so the same person
   * could be stored as `41234567`, `+4741234567` or `004741234567` depending on how they
   * happened to type it — three spellings of one number that no lookup matches across.
   * The `+47` is now a fixed prefix in the field rather than part of the value.
   */
  const handlePhoneChange = (value: string) => handleChange('phone', phoneDigits(value));

  const showError = String(form.phone || '').length >= 8 && !isValidPhone(String(form.phone));

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label
          htmlFor="phone"
          className="absolute left-4 top-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
        >
          Telefonnummer
        </label>{' '}
        {/* Labelen slutter her */}
        <span className="pointer-events-none absolute bottom-3 left-4 select-none text-[0.9375rem] text-[#9B9E96]">
          +47
        </span>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={showError || undefined}
          className={`w-full rounded-2xl border bg-white pt-6 pb-3 pl-14 pr-4 font-medium text-[#0B0B0B] outline-none transition-colors ${
            showError
              ? 'border-[#B4544A] focus:border-[#B4544A] focus:ring-4 focus:ring-[#B4544A]/12'
              : 'border-[#E6E7E1] focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12'
          }`}
          value={formatPhone(String(form.phone || ''))}
          onChange={(event) => handlePhoneChange(event.target.value)}
          placeholder="412 34 567"
        />
      </div>

      {showError && (
        <p className="-mt-3 text-[0.8125rem] text-[#B4544A]">Et norsk nummer har åtte siffer.</p>
      )}

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
        {updateUser?.isPending ? 'Oppdaterer...' : 'Oppdater telefon'}
      </button>
    </section>
  );
};
