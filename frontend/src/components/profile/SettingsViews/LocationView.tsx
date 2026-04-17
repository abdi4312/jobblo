import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const LocationView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om landet i input er det samme som det opprinnelige landet
  const isUnchanged = form.country === user?.country;
  const isDisabled = isUnchanged || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label htmlFor="country" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Land
        </label>
        <input
          id="country"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.country}
          onChange={(event) => handleChange("country", event.target.value)}
        />
      </div>

      {/* Din knappestil */}
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200
          ${isDisabled
            ? "bg-[#2F7E47] cursor-not-allowed opacity-80"
            : "bg-[#2F7E47] hover:bg-[#2F7E47] active:scale-[0.98]"
          }`}
      >
        {updateUser?.isPending ? "Oppdaterer..." : "Oppdater lokasjon"}
      </button>
    </section>
  );
};