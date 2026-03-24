import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const PictureView = () => {
  const { user, fileInputRef, handlePhotoSelect, handleFileChange } = useOutletContext<SettingsContextType>();

  return (
    <section className="flex flex-col items-center gap-6 py-10">
      <div className="relative">
        <img
          src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"}
          alt="Profile"
          className="w-48 h-48 rounded-full object-cover border-4 border-white shadow-md"
        />
      </div>
      
      <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*" 
          title="Upload profile picture" 
      />
      
      <button
        type="button"
        onClick={handlePhotoSelect}
        className="text-[#f87171] font-semibold text-xl hover:text-rose-600 transition-colors"
      >
        Select photo
      </button>
    </section>
  );
};
