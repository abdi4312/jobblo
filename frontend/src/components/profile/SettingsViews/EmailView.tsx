import { useOutletContext } from 'react-router-dom';
import type { SettingsContextType } from '../../../pages/SettingsPage';

export const EmailView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om e-posten i input er den samme som brukerens opprinnelige e-post
  const isUnchanged = form.email === user?.email;
  const password = typeof form.currentPassword === 'string' ? form.currentPassword : '';
  const isDisabled = isUnchanged || !password || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label
          htmlFor="email"
          className="absolute left-4 top-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
        >
          E-postadresse
        </label>
        <input
          id="email"
          type="email"
          className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.email}
          onChange={(event) => handleChange('email', event.target.value)}
        />
      </div>

      {!isUnchanged && (
        <div className="relative group">
          <label
            htmlFor="email-current-password"
            className="absolute left-4 top-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
          >
            Nåværende passord
          </label>
          <input
            id="email-current-password"
            type="password"
            autoComplete="current-password"
            className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={password}
            onChange={(event) => handleChange('currentPassword', event.target.value)}
          />
          <p className="mt-1.5 text-[0.8125rem] text-[#63665F]">
            Av sikkerhetshensyn må du bekrefte med passordet ditt for å endre e-postadressen.
          </p>
        </div>
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
        {updateUser?.isPending ? 'Oppdaterer...' : 'Oppdater e-post'}
      </button>
    </section>
  );
};
