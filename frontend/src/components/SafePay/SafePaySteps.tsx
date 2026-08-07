import React from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SafePayStepsProps {
  currentStep: number;
  orderId?: string;
  serviceId?: string;
}

const SafePaySteps: React.FC<SafePayStepsProps> = ({ currentStep, orderId, serviceId }) => {
  const navigate = useNavigate();
  const steps = [
    { id: 1, label: 'Velg søker', path: (sid: string) => `/job-applicants/${sid}` },
    {
      id: 2,
      label: 'Kontrakt og betaling',
      path: (oid: string) => `/safepay/checkout/${oid}`,
    },
    { id: 3, label: 'Jobb utføres', path: (oid: string) => `/safepay/success?orderId=${oid}` },
    {
      id: 4,
      label: 'Godkjenn og utbetal',
      path: (oid: string) => `/safepay/approval/${oid}`,
    },
  ];

  const handleStepClick = (stepId: number) => {
    if (stepId === 1 && serviceId) {
      navigate(steps[0].path(serviceId));
    } else if (orderId) {
      const step = steps.find((s) => s.id === stepId);
      if (step && step.path) {
        navigate(step.path(orderId));
      }
    }
  };

  return (
    <div className="flex items-center mb-8 relative">
      <div className="absolute top-[13.5px] left-0 right-0 h-[1px] bg-gray-200 -z-10"></div>
      {steps.map((step, index) => {
        const done = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const status = isCurrent ? 'Nåværende' : done ? 'Fullført' : 'Kommende';
        // A step is only clickable if we actually have the id needed to navigate to it
        const navigable = step.id === 1 ? !!serviceId : !!orderId;

        return (
          <React.Fragment key={step.id}>
            <div
              className={`flex flex-col items-center gap-2 flex-1 relative ${
                navigable ? 'cursor-pointer group' : ''
              }`}
              onClick={() => handleStepClick(step.id)}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all z-10 ${
                  isCurrent
                    ? 'bg-[#1a3a1a] text-white'
                    : done
                      ? 'bg-custom-green text-white group-hover:bg-[#14532d]'
                      : 'bg-white border border-gray-200 text-gray-400'
                }`}
              >
                {done ? (
                  <Check size={14} />
                ) : (
                  <span className="text-[11px] font-bold leading-none">{step.id}</span>
                )}
              </div>
              <span
                className={`text-[11px] md:text-[12px] text-center leading-tight transition-all ${
                  isCurrent
                    ? 'text-[#1a3a1a] font-bold'
                    : done
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-400'
                } ${navigable && !isCurrent ? 'group-hover:text-custom-green' : ''}`}
              >
                {step.label}
              </span>
              <span
                className={`text-[10px] md:text-[11px] whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'text-[#1a3a1a] font-bold'
                    : done
                      ? 'text-custom-green font-medium'
                      : 'text-gray-400'
                }`}
              >
                {status}
              </span>

              {/* Connecting line for the step(s) below */}
              {index < steps.length - 1 && done && (
                <div className="absolute top-[13.5px] left-[50%] w-full h-[1px] bg-custom-green -z-0"></div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SafePaySteps;