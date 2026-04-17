import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const UsernameView = () => {
  // Anta at 'user'-data også kommer i konteksten for sammenligning
  const { form, updateUser, handleChange, handleUpdate, user } =
    useOutletContext<SettingsContextType>();

  const usernameLength = form.name.trim().length;

  // Logikk: Hvis navnet ikke er endret eller hvis lengdekravene ikke er oppfylt
  const isUnchanged = form.name === user?.name;
  const isInvalid = usernameLength < 4 || usernameLength > 30;
  const isDisabled = isUnchanged || updateUser.isPending || isInvalid;

  return (
    <section className="flex flex-col gap-8 max-w-2xl">
      <p className="text-gray-600 text-[15px] leading-relaxed">
        Du kan bare endre brukernavnet en gang hver 30. dag. Dette betyr at du
        kanskje ikke kan få tilbake ditt nåværende brukernavn hvis du bestemmer
        deg for å endre det.
      </p>

      <div className="flex flex-col gap-2">
        <div className="relative group">
          <label
            htmlFor="username"
            className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight"
          >
            Brukernavn
          </label>
          <input
            id="username"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
          />
        </div>
        <p className="text-[13px] text-gray-500 px-1 leading-tight">
          {usernameLength}/30 tegn - Brukernavnet må være mellom 4–30 tegn, og
          kan kun inneholde bokstaver (a-z), tall og understrek (_)
        </p>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled || updateUser.isPending}
        style={{
          backgroundColor: "#2F7E47",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
        className={`w-full text-[#ffffff] font-bold text-lg py-3.5 rounded-2xl shadow-sm transition-all mt-2 
          ${isDisabled ? "opacity-80" : ""}`}
      >
        {updateUser.isPending ? "Oppdaterer..." : "Oppdater brukernavn"}
      </button>
    </section>
  );
};
