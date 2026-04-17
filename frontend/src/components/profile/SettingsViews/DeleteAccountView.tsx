import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import toast from "react-hot-toast";

export const DeleteAccountView = () => {
  // const { form, handleChange, handleUpdate, updateUser } = useOutletContext<SettingsContextType>();
  const { form, handleChange, updateUser } = useOutletContext<SettingsContextType>();

  // Logikk: Hvis tilbakemeldingen er tom, forblir knappen deaktivert
  const isDisabled = !form.feedback?.trim() || updateUser?.isPending;

  const handleUpdate = () => {
    toast.success("Kommer snart");
  };

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      {/* Øvre tekst */}
      <div className="flex flex-col gap-4 text-gray-700">
        <p className="text-[15px] leading-relaxed">
          Det er trist å se deg dra! Vi ønsker alltid å forbedre oss, og vil sette pris på alle nyttige tilbakemeldinger i skjemaet nedenfor.
        </p>
        <p className="text-[15px] leading-relaxed">
          Sletting av profilen din er irreversibel, og alt tilknyttet innhold vil bli slettet fra Jobblo. Du må opprette en ny profil hvis du vil bli med senere.
        </p>
      </div>

      {/* Tilbakemeldingsfelt */}
      <div className="relative group">
        <textarea
          id="feedback"
          rows={5}
          placeholder="Tilbakemelding"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-5 py-4 text-gray-900 font-medium transition-colors resize-none"
          value={form.feedback || ""}
          onChange={(event) => handleChange("feedback", event.target.value)}
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
        {updateUser?.isPending ? "Behandler..." : "Slett profil"}
      </button>
    </section>
  );
};