import React from "react";
import { X as CloseIcon } from "lucide-react";

interface HeroModalProps {
  editingId: string | null;
  formData: any;
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  closeModal: () => void;
}

const HeroModal: React.FC<HeroModalProps> = ({ editingId, formData, setFormData, handleSubmit, closeModal }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={closeModal}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
        >
          <CloseIcon />
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {editingId ? "Update Hero Banner" : "Add New Hero Banner"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Title</label>
            <input
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
              placeholder="E.g. Summer Sale"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Subtitle</label>
            <input
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Image URL</label>
            <input
              required
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Active From</label>
            <input
              type="date"
              required
              value={formData.activeFrom}
              onChange={(e) => setFormData({ ...formData, activeFrom: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 outline-none focus:border-[#2d4a3e]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Expire At</label>
            <input
              type="date"
              required
              value={formData.expireAt}
              onChange={(e) => setFormData({ ...formData, expireAt: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 outline-none focus:border-[#2d4a3e]"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all resize-none"
            />
          </div>
          <button
            type="submit"
            className="col-span-2 mt-2 bg-[#2d4a3e] text-white py-4 rounded-2xl font-bold hover:bg-[#233b31] transition-all shadow-lg active:scale-95"
          >
            {editingId ? "Update Hero Banner" : "Create Hero Banner"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default HeroModal;