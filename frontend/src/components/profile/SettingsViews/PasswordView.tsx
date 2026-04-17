import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import toast from "react-hot-toast";

export const PasswordView = () => {
  // const { form, handleChange, handleUpdate, updateUser } = useOutletContext<SettingsContextType>();
  const { form, handleChange, updateUser } = useOutletContext<SettingsContextType>();

  // Logikk: Knappen aktiveres bare når begge feltene er fylt ut og forespørselen ikke er ventende
  // I passordvisning sjekker vi 'isEmpty' i stedet for 'isUnchanged'
  const isDisabled = !form.currentPassword || !form.newPassword || updateUser?.isPending;
  const handleUpdate = () => {
    toast.success("Kommer snart");
  }

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      {/* Nåværende passord */}
      <div className="relative group">
        <label htmlFor="currentPassword" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Nåværende passord
        </label>
        <input
          id="currentPassword"
          type="password"
          placeholder="••••••••"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.currentPassword || ""}
          onChange={(event) => handleChange("currentPassword", event.target.value)}
        />
      </div>

      {/* Nytt passord */}
      <div className="relative group">
        <label htmlFor="newPassword" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Nytt passord
        </label>
        <input
          id="newPassword"
          type="password"
          placeholder="••••••••"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.newPassword || ""}
          onChange={(event) => handleChange("newPassword", event.target.value)}
        />
      </div>

      {/* Handling-knapp */}
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
        {updateUser?.isPending ? "Oppdaterer..." : "Endre passord"}
      </button>
    </section>
  );
};