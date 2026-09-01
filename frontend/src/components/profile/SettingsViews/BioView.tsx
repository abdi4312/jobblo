import { useOutletContext } from 'react-router-dom';
import type { SettingsContextType } from '../../../pages/SettingsPage';

export const BioView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om bio er den samme som allerede var i profilen
  const isUnchanged = form.bio === user?.bio;
  const isDisabled = isUnchanged || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label
          htmlFor="bio"
          className="absolute left-4 top-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]"
        >
          Bio
        </label>
        <textarea
          id="bio"
          rows={6}
          className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors resize-none"
          value={form.bio}
          onChange={(event) => handleChange('bio', event.target.value)}
        />
      </div>

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
        {updateUser?.isPending ? 'Lagrer...' : 'Oppdater bio'}
      </button>
    </section>
  );
};
