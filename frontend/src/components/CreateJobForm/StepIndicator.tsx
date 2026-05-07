import React from "react";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = ["Grunnleggende", "Tid & Sted", "Kontakt"];
  return (
    <div className="flex items-start justify-between mb-12 px-4 md:px-5 max-w-lg mx-auto relative">
      {/* Progress Line Container */}
      <div className="absolute top-4 md:top-5 left-8 md:left-10 right-8 md:right-10 h-[2px] bg-white z-0">
        {/* Active Line Overlay */}
        <div
          className="h-full bg-[#2D7A4D] transition-all duration-500 ease-out"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />
      </div>

      {steps.map((step, index) => (
        <div
          key={index}
          className="flex flex-col items-center relative z-10 shrink-0"
        >
          <div
            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              currentStep > index + 1
                ? "bg-[#2D7A4D] border-[#2D7A4D] text-white"
                : currentStep === index + 1
                  ? "bg-white border-[#2D7A4D] text-[#2D7A4D] shadow-lg scale-110"
                  : "bg-white border-gray-200 text-gray-400"
            }`}
          >
            {currentStep > index + 1 ? (
              <Check size={18} strokeWidth={3} className="md:w-5 md:h-5" />
            ) : (
              <span className="text-sm md:text-base font-bold">
                {index + 1}
              </span>
            )}
          </div>
          <span
            className={`absolute top-10 md:top-12 text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors duration-300 ${
              currentStep === index + 1 ? "text-[#2D7A4D]" : "text-gray-400"
            } hidden xs:block`}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
};
