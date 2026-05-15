import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import { Camera, Image as ImageIcon } from "lucide-react";

export const BannerView = () => {
  const { user, fileInputRef, handlePhotoSelect, handleFileChange } = useOutletContext<SettingsContextType>();

  return (
    <section className="flex flex-col items-center gap-6 py-10 px-4">
      <div className="flex flex-col gap-2 w-full max-w-2xl">
        <h3 className="text-xl font-bold text-gray-900">Bedriftens banner</h3>
        <p className="text-gray-500 text-sm">Dette bildet vil vises øverst på din bedriftsprofil.</p>
      </div>

      <div className="relative w-full max-w-2xl h-48 sm:h-64 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 group">
        <img
          src={user?.bannerUrl || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200"}
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
      
      <div className="flex flex-col gap-4 items-center mt-4">
        <button
          type="button"
          onClick={handlePhotoSelect}
          className="bg-custom-green text-white px-8 py-3 rounded-xl font-bold hover:bg-custom-green/90 transition-all shadow-md"
        >
          Velg bilde fra datamaskinen
        </button>
        <p className="text-xs text-gray-400">Anbefalt størrelse: 1200x400 px. Maks 5MB.</p>
      </div>
    </section>
  );
};
