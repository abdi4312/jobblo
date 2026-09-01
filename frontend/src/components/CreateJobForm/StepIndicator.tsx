import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const STEPS = ['Grunnleggende', 'Tid & sted', 'Sjekkliste', 'Kontakt'];

/**
 * Where you are in the four steps.
 *
 * The old version drew four circles with two absolutely-positioned labels stacked under
 * each — the step name, and a second line reading "Fullført" / "Nåværende" / "Kommende".
 * Both were `hidden xs:block`, so on an actual phone the circles carried no labels at all
 * and the whole thing said nothing; on desktop the second line repeated in words what the
 * tick and the fill already said.
 *
 * This says it once, in a sentence, and shows progress as four segments. The segments
 * stay tappable for steps already visited — going back to fix something is the one
 * navigation this form needs.
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, setCurrentStep }) => (
  <nav aria-label="Fremdrift" className="mb-8">
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <p className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
        {STEPS[currentStep - 1]}
      </p>
      <p className="shrink-0 text-[0.8125rem] tabular-nums text-[#63665F]">
        Steg {currentStep} av {STEPS.length}
      </p>
    </div>

    <ol className="flex gap-1.5">
      {STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const isDone = currentStep > stepNumber;
        const isCurrent = currentStep === stepNumber;
        const canVisit = stepNumber <= currentStep;

        return (
          <li key={step} className="flex-1">
            <button
              type="button"
              disabled={!canVisit}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Steg ${stepNumber}: ${step}${isDone ? ' (fullført)' : ''}`}
              onClick={() => canVisit && setCurrentStep(stepNumber)}
              className="group flex w-full flex-col gap-2 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 disabled:cursor-default"
            >
              <span
                className={`h-1 w-full rounded-full transition-colors duration-300 ${
                  isDone || isCurrent ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
                } ${canVisit && !isCurrent ? 'group-hover:bg-[#255335]' : ''}`}
              />
              {/* The name under each segment is desktop-only — four Norwegian words do not
                  fit across a phone. The sentence above carries it there instead. */}
              <span
                className={`hidden items-center gap-1 text-[0.75rem] font-medium transition-colors sm:flex ${
                  isCurrent
                    ? 'text-[#0B0B0B]'
                    : isDone
                      ? 'text-[#2E6641]'
                      : 'text-[#9B9E96]'
                }`}
              >
                {isDone && <Check size={11} strokeWidth={3} />}
                {step}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);
