import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import { useState, useRef } from "react";
import { X, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { useAddPortfolioItem, useDeletePortfolioItem } from "../../../features/profile/hooks";

export const SeekerSettingsView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();
  const [newSkill, setNewSkill] = useState("");
  
  // Portfolio states
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", description: "", link: "" });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPortfolioMutation = useAddPortfolioItem();
  const deletePortfolioMutation = useDeletePortfolioItem();

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

  const handleAddProject = () => {
    const formData = new FormData();
    formData.append("title", projectForm.title);
    formData.append("description", projectForm.description);
    formData.append("link", projectForm.link);
    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    addPortfolioMutation.mutate(formData, {
      onSuccess: () => {
        setIsAddingProject(false);
        setProjectForm({ title: "", description: "", link: "" });
        setSelectedImage(null);
      }
    });
  };

  const handleDeleteProject = (itemId: string) => {
    deletePortfolioMutation.mutate(itemId);
  };

  return (
    <section className="flex flex-col gap-8 max-w-2xl pb-10">
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
        </div>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200 mb-4
          ${
            isDisabled
              ? "bg-[#2F7E47] cursor-not-allowed opacity-80"
              : "bg-[#2F7E47] hover:bg-[#2F7E47] active:scale-[0.98]"
          }`}
      >
        {updateUser?.isPending ? "Lagrer..." : "Lagre endringer"}
      </button>

      {/* Portfolio Section */}
      <div className="flex flex-col gap-6 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Portfolio</h3>
          <button
            onClick={() => setIsAddingProject(!isAddingProject)}
            className="flex items-center gap-2 text-sm font-bold text-[#2F7E47] hover:opacity-80 transition-opacity"
          >
            <Plus size={18} />
            Legg til prosjekt
          </button>
        </div>

        {isAddingProject && (
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Prosjekt tittel"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
              />
              <input
                type="text"
                placeholder="Link (valgfritt)"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={projectForm.link}
                onChange={(e) => setProjectForm({ ...projectForm, link: e.target.value })}
              />
            </div>
            <textarea
              placeholder="Kort beskrivelse"
              rows={2}
              className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium resize-none"
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-colors"
            >
              <input 
                title="Laste opp bilde"
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
              />
              {selectedImage ? (
                <div className="flex items-center gap-2 text-[#2F7E47] font-bold">
                  <ImageIcon size={20} />
                  <span>{selectedImage.name}</span>
                </div>
              ) : (
                <>
                  <ImageIcon size={24} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Klikk for å laste opp bilde</span>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={handleAddProject}
                disabled={addPortfolioMutation.isPending || !projectForm.title}
                className="flex-1 bg-black text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {addPortfolioMutation.isPending ? "Lagrer..." : "Lagre prosjekt"}
              </button>
              <button
                onClick={() => setIsAddingProject(false)}
                className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(user as any)?.portfolio?.map((project: any) => (
            <div key={project._id} className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-center group">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                <img src={project.imageUrl} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{project.title}</h4>
                <p className="text-xs text-gray-500 truncate">{project.description}</p>
              </div>
              <button 
                title="Slett prosjekt"
                onClick={() => handleDeleteProject(project._id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {(user as any)?.portfolio?.length === 0 && !isAddingProject && (
            <div className="col-span-full py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 italic">Ingen prosjekter i portfolioen ennå.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
