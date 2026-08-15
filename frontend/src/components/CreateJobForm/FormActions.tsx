import React from 'react';
import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';

interface FormActionsProps {
  currentStep: number;
  handleBack: () => void;
  handleCancel: () => void;
  handleNext: () => void;
  handleFinalSubmit: () => void;
  setShowPreview: (show: boolean) => void;
  isSubmitting?: boolean;
}

const GHOST =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-50';

const OUTLINE =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#E6E7E1] bg-white px-5 text-[0.9375rem] font-medium text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-50';

const SOLID =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60';

/**
 * The step controls, pinned to the bottom of the viewport.
 *
 * They used to sit in a card at the end of the page, which on a phone meant scrolling
 * past the whole step to reach "Neste" — and back up again after a validation toast
 * pointed at a field near the top. Sticky costs nothing here and removes that round trip.
 *
 * Three buttons, three weights: leaving is a bare label, previewing is outlined, and the
 * one that moves you forward is the only filled thing on screen. Previously all three
 * were the same component at the same size, so the primary action had to be found by
 * reading rather than seen.
 */
export const FormActions: React.FC<FormActionsProps> = ({
  currentStep,
  handleBack,
  handleCancel,
  handleNext,
  handleFinalSubmit,
  setShowPreview,
  isSubmitting = false,
}) => (
  <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-[#E6E7E1] bg-[#EFF0EA]/92 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={currentStep === 1 ? handleCancel : handleBack}
        disabled={isSubmitting}
        className={GHOST}
      >
        <ChevronLeft size={17} strokeWidth={2.2} />
        {currentStep === 1 ? 'Avbryt' : 'Tilbake'}
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={isSubmitting}
          className={OUTLINE}
        >
          <Eye size={16} strokeWidth={2} />
          <span className="hidden min-[420px]:inline">Forhåndsvis</span>
        </button>

        {currentStep < 4 ? (
          <button type="button" onClick={handleNext} className={SOLID}>
            Neste
            <ChevronRight size={17} strokeWidth={2.4} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={isSubmitting}
            className={SOLID}
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? 'Publiserer…' : 'Publiser oppdrag'}
          </button>
        )}
      </div>
    </div>
  </div>
);
