import React from 'react';
import { Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

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
    // Only allow clicking steps that are already completed or the current one
    if (stepId >= currentStep) return;

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
      <div className="absolute top-[13.5px] left-0 right-0 h-[1px] bg-[#e8e0d0] -z-10"></div>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            className={`flex flex-col items-center gap-2 flex-1 relative ${
              step.id < currentStep ? 'cursor-pointer group' : ''
            }`}
            onClick={() => handleStepClick(step.id)}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium transition-all z-10 ${
                currentStep > step.id
                  ? 'bg-custom-green text-white group-hover:bg-[#14532d]'
                  : currentStep === step.id
                    ? 'bg-[#1a3a1a] text-white'
                    : 'bg-white border border-[#e8e0d0] text-gray-400'
              }`}
            >
              {currentStep > step.id ? <Check size={14} /> : step.id}
            </div>
            <span
              className={`text-[11px] md:text-[12px] whitespace-nowrap transition-all ${
                currentStep >= step.id ? 'text-gray-900 font-medium' : 'text-gray-400'
              } ${step.id < currentStep ? 'group-hover:text-custom-green' : ''}`}
            >
              {step.label}
            </span>

            {/* Connecting Line for Completed Steps */}
            {index < steps.length - 1 && currentStep > step.id && (
              <div className="absolute top-[13.5px] left-[50%] w-full h-[1px] bg-custom-green -z-0"></div>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default SafePaySteps;
