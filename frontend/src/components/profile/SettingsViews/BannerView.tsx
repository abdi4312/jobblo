import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import { Camera, Image as ImageIcon, Plus, X } from "lucide-react";
import { Input } from "../../Ui/Input";
import { useState } from "react";

export const BannerView = () => {
  const {
    user,
    form,
    handleChange,
    handleUpdate,
    updateUser,
    fileInputRef,
    handlePhotoSelect,
    handleFileChange,
  } = useOutletContext<SettingsContextType>();

  const [newSkill, setNewSkill] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const addSkill = () => {
    if (newSkill.trim()) {
      handleChange("skills", [...(form.skills || []), newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    const updated = [...form.skills];
    updated.splice(index, 1);
    handleChange("skills", updated);
  };

  const addLocation = () => {
    if (newLocation.trim()) {
      handleChange("locations", [
        ...(form.locations || []),
        newLocation.trim(),
      ]);
      setNewLocation("");
    }
  };

  const removeLocation = (index: number) => {
    const updated = [...form.locations];
    updated.splice(index, 1);
    handleChange("locations", updated);
  };

  return (
    <section className="flex flex-col gap-10 py-6 px-4 max-w-4xl mx-auto">
      {/* Banner Section */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold text-gray-900">Bedriftens banner</h3>
          <p className="text-gray-500 text-sm">
            Dette bildet vil vises øverst på din bedriftsprofil.
          </p>
        </div>

        <div className="relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 group">
          <img
            src={
              user?.bannerUrl ||
              "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200"
            }
            alt="Banner"
            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handlePhotoSelect}
              className="bg-white px-4 py-2 rounded-xl text-sm font-bold text-gray-900 shadow-lg flex items-center gap-2"
            >
              <ImageIcon size={18} />
              Bytt banner
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          title="Last opp bannerbilde"
        />
      </div>

      <div className="h-px bg-gray-100" />

      {/* Portfolio Management */}
      <div className="flex flex-col gap-8">
        <h3 className="text-2xl font-bold text-gray-900">Portfolio Manager</h3>

        {/* About Us */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-bold text-gray-700 uppercase">
            Om oss (Beskrivelse)
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            className="w-full min-h-32 p-4 rounded-xl border border-gray-200 focus:border-black outline-none transition-all resize-none text-gray-800"
            placeholder="Fortell litt om bedriften din..."
          />
        </div>

        {/* Skills / Services */}
        <div className="flex flex-col gap-4">
          <label className="text-sm font-bold text-gray-700 uppercase">
            Dette tilbyr vi (Tjenester)
          </label>
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="F.eks. Maler, Snekker..."
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
            />
            <button
              onClick={addSkill}
              className="bg-black text-white p-3 rounded-lg hover:bg-black/80 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.skills?.map((skill: string, index: number) => (
              <span
                key={index}
                className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-sm font-bold text-gray-700"
              >
                {skill}
                <button
                  onClick={() => removeSkill(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Locations */}
        <div className="flex flex-col gap-4">
          <label className="text-sm font-bold text-gray-700 uppercase">
            Her kan vi hjelpe (Lokasjoner)
          </label>
          <div className="flex gap-2">
            <Input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="F.eks. Oslo, Trondheim..."
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
            />
            <button
              onClick={addLocation}
              className="bg-black text-white p-3 rounded-lg hover:bg-black/80 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.locations?.map((loc: string, index: number) => (
              <span
                key={index}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#E1F3FD] rounded-full text-sm font-bold text-[#0066A2]"
              >
                {loc}
                <button
                  onClick={() => removeLocation(index)}
                  className="text-[#0066A2]/50 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Bedriftsnavn"
            value={form.companyName}
            onChange={(e) => handleChange("companyName", e.target.value)}
          />
          <Input
            label="Nettside"
            value={form.website}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="https://www.bedrift.no"
          />
          <Input
            label="Telefon"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
          <Input
            label="Organisasjonstype"
            value={form.orgType}
            onChange={(e) => handleChange("orgType", e.target.value)}
            placeholder="F.eks. Aksjeselskap"
          />
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleUpdate}
            disabled={updateUser.isPending}
            className="w-full bg-custom-green text-white py-4 rounded-xl font-bold text-lg hover:bg-custom-green/90 transition-all shadow-lg disabled:opacity-50"
          >
            {updateUser.isPending ? "Lagrer..." : "Lagre portfolio"}
          </button>
        </div>
      </div>
    </section>
  );
};
