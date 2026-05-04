import React from "react";

interface FilterButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const FilterButton: React.FC<FilterButtonProps> = ({ label, isActive, onClick }) => (
  <button
    className={`py-2.5 px-6 rounded-2xl text-[14px] font-semibold transition-all duration-200 ${
      isActive
        ? "bg-[#212529] text-white"
        : "bg-[#F8F9FA] text-[#495057] hover:bg-[#E9ECEF]"
    }`}
    onClick={onClick}
  >
    {label}
  </button>
);

export const EmptyChatState = () => (
  <div className="flex flex-col items-center justify-center h-full text-[#ADB5BD] bg-white">
    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm mb-6 border border-gray-100">
      <span className="material-symbols-outlined text-[40px] text-[#CED4DA]">
        chat_bubble
      </span>
    </div>
    <p className="text-[18px] font-medium text-[#495057]">Velg en samtale</p>
    <p className="text-[14px] text-[#6C757D] mt-2 text-center max-w-[280px]">
      Velg en samtale fra listen til venstre for å begynne å chatte.
    </p>
  </div>
);
