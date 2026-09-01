import React from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SafePayStepsProps {
  currentStep: number;
  orderId?: string;
  serviceId?: string;
}

const STEPS = [
  { id: 1, label: 'Velg søker' },
  { id: 2, label: 'Kontrakt og betaling' },
  { id: 3, label: 'Jobb utføres' },
  { id: 4, label: 'Godkjenn og utbetal' },
];

/**
 * The four stages of a SafePay job, shown on every screen in the flow.
 *
 * Two things were wrong beyond the styling. Each node carried a third line reading
 * "Nåværende" / "Fullført" / "Kommende", saying in words exactly what the tick and the
 * fill already showed — three labels per step, twelve strings across the bar.
 *
 * And every step was clickable as soon as an `orderId` existed, including steps ahead of
 * the current one. From the payment screen you could press "Godkjenn og utbetal" and land
 * on the approval page for an order nobody had paid for yet. Only completed steps and the
 * current one navigate now; the rest are inert.
 */
const SafePaySteps: React.FC<SafePayStepsProps> = ({ currentStep, orderId, serviceId }) => {
  const navigate = useNavigate();

  const pathFor = (id: number) => {
    if (id === 1) return serviceId ? `/job-applicants/${serviceId}` : null;
    if (!orderId) return null;
    if (id === 2) return `/safepay/checkout/${orderId}`;
    if (id === 3) return `/safepay/success?orderId=${orderId}`;
    return `/safepay/approval/${orderId}`;
  };

  return (
    <nav aria-label="SafePay-stegene" className="mb-8">
      <ol className="flex items-start">
        {STEPS.map((step, index) => {
          const done = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const href = pathFor(step.id);
          // Never forward — a step you have not reached is not a place you can go.
          const navigable = !!href && step.id <= currentStep && !isCurrent;

          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center gap-2">
              {/* The rail sits behind the nodes but in front of the page. It used to be
                  `-z-10`, which on this non-positioned parent put it behind the page
                  background entirely on some surfaces. */}
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-3.5 z-0 h-px w-full ${
                    done || isCurrent ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
                  }`}
                />
              )}

              <button
                type="button"
                disabled={!navigable}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => navigable && href && navigate(href)}
                className="group relative z-10 flex flex-col items-center gap-2 rounded px-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 disabled:cursor-default"
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-[0.6875rem] font-bold transition-colors ${
                    isCurrent
                      ? 'bg-[#122A1C] text-white'
                      : done
                        ? 'bg-[#2E6641] text-white group-hover:bg-[#255335]'
                        : 'border border-[#E6E7E1] bg-white text-[#9B9E96]'
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : step.id}
                </span>
                <span
                  className={`text-center text-[0.6875rem] leading-tight transition-colors sm:text-[0.75rem] ${
                    isCurrent
                      ? 'font-semibold text-[#0B0B0B]'
                      : done
                        ? 'font-medium text-[#2E6641] group-hover:text-[#255335]'
                        : 'text-[#9B9E96]'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default SafePaySteps;
