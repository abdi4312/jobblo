import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const PhoneView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logikk: Sjekk om inndataverdien er den samme som det opprinnelige telefonnummeret
  const isUnchanged = form.phone === user?.phone;
  const isDisabled = isUnchanged || updateUser?.isPending;

  // Funksjon for å bare tillate tall
  const handlePhoneChange = (value: string) => {
    // 1. Logikk for å bare tillate tall og '+' i begynnelsen
    const cleaned = value.replace(/[^\d+]/g, ""); // Fjerner alt unntatt siffer og '+'

    // 2. Sørger for at '+' bare kan være i begynnelsen
    const finalValue = cleaned.startsWith('+')
      ? '+' + cleaned.replace(/\+/g, '')
      : cleaned.replace(/\+/g, '');

    handleChange("phone", finalValue);
  };

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label
          htmlFor="phone"
          className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight"
        >
          Telefonnummer
        </label> {/* Labelen slutter her */}

        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.phone}
          onChange={(event) => handlePhoneChange(event.target.value)}
          placeholder="+47 000 00 000"
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
        {updateUser?.isPending ? "Oppdaterer..." : "Oppdater telefon"}
      </button>
    </section>
  );
};