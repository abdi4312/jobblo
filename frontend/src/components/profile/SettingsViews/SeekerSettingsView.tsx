import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import { useState } from "react";
import { X } from "lucide-react";

export const SeekerSettingsView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();
  const [newSkill, setNewSkill] = useState("");

  const isUnchanged =
    form.availabilityText === (user as any)?.availabilityText &&
    JSON.stringify(form.skills) === JSON.stringify((user as any)?.skills);

  const isDisabled = isUnchanged || updateUser?.isPending;

  const addSkill = () => {
    if (newSkill.trim() && !form.skills.includes(newSkill.trim())) {
      handleChange("skills", [...form.skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    handleChange(
      "skills",
      form.skills.filter((s) => s !== skillToRemove),
    );
  };

  return (
    <section className="flex flex-col gap-8 max-w-2xl">
      {/* Availability Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-gray-900">Tilgjengelighet</h3>
        <div className="relative group">
          <label
            htmlFor="availability"
            className="absolute left-4 top-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-tight"
          >
            Når er du tilgjengelig?
          </label>
          <textarea
            id="availability"
            rows={3}
            placeholder="F.eks. Mandag - Fredag: 08:00 - 16:00"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors resize-none"
            value={form.availabilityText}
            onChange={(event) =>
              handleChange("availabilityText", event.target.value)
            }
          />
        </div>
      </div>

      {/* Skills Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-gray-900">Ferdigheter</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Legg til en ferdighet..."
            className="flex-1 bg-gray-100 outline-none rounded-xl px-4 py-3 text-gray-900 font-medium"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
          />
          <button
            onClick={addSkill}
            className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            Legg til
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {form.skills.map((skill) => (
            <div
              key={skill}
              className="flex items-center gap-2 bg-[#2F7E4715] px-4 py-2 rounded-full border border-[#2F7E4720]"
            >
              <span className="text-sm font-bold text-[#2F7E47]">{skill}</span>
              <button
                title="Fjern"
                type="button"
                onClick={() => removeSkill(skill)}
                className="text-[#2F7E47] hover:text-[#1a4a2a] opacity-60 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {form.skills.length === 0 && (
            <p className="text-gray-400 text-sm italic">
              Ingen ferdigheter lagt til ennå.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200
          ${
            isDisabled
              ? "bg-[#2F7E47] cursor-not-allowed opacity-80"
              : "bg-[#2F7E47] hover:bg-[#2F7E47] active:scale-[0.98]"
          }`}
      >
        {updateUser?.isPending ? "Lagrer..." : "Lagre endringer"}
      </button>
    </section>
  );
};
