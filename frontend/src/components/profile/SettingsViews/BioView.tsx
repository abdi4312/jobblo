import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const BioView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om bio er den samme som allerede var i profilen
  const isUnchanged = form.bio === user?.bio;
  const isDisabled = isUnchanged || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label htmlFor="bio" className="absolute left-4 top-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Bio
        </label>
        <textarea
          id="bio"
          rows={6}
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors resize-none"
          value={form.bio}
          onChange={(event) => handleChange("bio", event.target.value)}
        />
      </div>

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
        {updateUser?.isPending ? "Lagrer..." : "Oppdater bio"}
      </button>
    </section>
  );
};