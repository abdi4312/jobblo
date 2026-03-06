import React from "react";
import { Eye } from "lucide-react"; // Eye icon ke liye lucide-react use kiya hai

interface FormActionsProps {
  onCancel: () => void;
  onPreview: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  onPreview,
  onSubmit,
  isSubmitting = false,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full">
      {/* 1. Avbryt Button */}
      <button
        type="button"
        onClick={onCancel}
        className="w-full sm:flex-1 py-3 px-6 rounded-[12px] border border-[#e0e0e0] bg-[#f8f9fa] text-[#2c3e50] font-semibold hover:bg-gray-100 transition-all"
      >
        Avbryt
      </button>

      {/* 2. Forhåndsvisning Button */}
      <button
        type="button"
        onClick={onPreview}
        className="w-full sm:flex-1 py-3 px-6 rounded-[12px] border-2 border-[#2D7A4D] bg-white text-[#2D7A4D] font-semibold flex items-center justify-center gap-2 hover:bg-[#f0f9f0] transition-all"
      >
        <Eye size={20} />
        Forhåndsvisning
      </button>

      {/* 3. Publiser oppdrag Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        onClick={(e) => {
            e.preventDefault();
            onSubmit();
        }}
        className="w-full sm:flex-[1.5] py-3 px-6 rounded-[12px] bg-[#2D7A4D] text-white font-semibold shadow-md hover:bg-[#25633e] disabled:opacity-70 disabled:cursor-not-allowed transition-all"
      >
        {isSubmitting ? "Publiserer..." : "Publiser oppdrag"}
      </button>
    </div>
  );
};