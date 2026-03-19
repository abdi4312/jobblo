import React from "react";
import { X as CloseIcon } from "lucide-react";

interface HeroModalProps {
  editingId: string | null;
  formData: any;
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  closeModal: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  previewUrl: string | null;
}

const HeroModal: React.FC<HeroModalProps> = ({ editingId, formData, setFormData, handleSubmit, closeModal, handleFileChange, previewUrl }) => {
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
          {/* Image Preview Section */}
          <div className="col-span-2 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-[2rem] p-4 bg-gray-50/50">
            {previewUrl ? (
              <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden shadow-md">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                   <p className="text-white font-bold bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">Current Banner Image</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-10">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 font-medium">No image selected</p>
              </div>
            )}
          </div>

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
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Button Text</label>
            <input
              value={formData.buttonText}
              onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
              placeholder="E.g. Explore Now"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Button URL</label>
            <input
              value={formData.buttonUrl}
              onChange={(e) => setFormData({ ...formData, buttonUrl: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
              placeholder="E.g. /explore or https://..."
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Background Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.bgColor || "#132A22"}
                onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                className="w-16 h-12 rounded-xl border border-gray-100 bg-gray-50 outline-none focus:border-[#2d4a3e] cursor-pointer"
              />
              <input
                type="text"
                value={formData.bgColor || ""}
                onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
                placeholder="#000000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Banner Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
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
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Footer Text</label>
            <textarea
              rows={3}
              value={formData.footerText}
              onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all resize-none"
              placeholder="Footer disclaimer or additional info..."
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