import React from "react";
import { ChevronLeft, ChevronRight, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "../Ui/button/Button";

interface FormActionsProps {
  currentStep: number;
  handleBack: () => void;
  handleCancel: () => void;
  handleNext: () => void;
  handleFinalSubmit: () => void;
  setShowPreview: (show: boolean) => void;
  isSubmitting?: boolean;
}

export const FormActions: React.FC<FormActionsProps> = ({
  currentStep,
  handleBack,
  handleCancel,
  handleNext,
  handleFinalSubmit,
  setShowPreview,
  isSubmitting = false,
}) => {
  return (
    <div className="box-card-custom p-4 md:p-6 flex flex-col rounded-[14px] md:flex-row items-center justify-between gap-4 mt-4">
      <Button
        type="button"
        onClick={currentStep === 1 ? handleCancel : handleBack}
        label={currentStep === 1 ? "Avbryt" : "Tilbake"}
        icon={<ChevronLeft size={20} />}
        className="px-8 py-3 md:w-32"
      />

      <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 md:gap-4 order-1 md:order-2">
        <Button
          type="button"
          label="Forhåndsvis"
          icon={<Eye size={20} />}
          iconPosition="left"
          onClick={() => setShowPreview(true)}
          className="px-8 py-3"
        />
        {currentStep < 3 ? (
          <Button
            type="button"
            label="Neste"
            variant="default"
            size="default"
            icon={<ChevronRight size={20} />}
            iconPosition="right"
            onClick={handleNext}
            className="px-8 py-3"
          />
        ) : (
          <Button
            type="submit"
            label="Publiser"
            variant="default"
            icon={<CheckCircle2 size={20} />}
            iconPosition="right"
            onClick={handleFinalSubmit}
            loading={isSubmitting}
            className="px-8 py-3"
          />
        )}
      </div>
    </div>
  );
};
