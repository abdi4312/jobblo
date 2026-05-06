import React from "react";

export const PricingHeader: React.FC = () => {
  return (
    <div className="text-center mb-12">
      <h2 className="text-[40px] font-bold tracking-normal mb-4">
        Choose your <span className="text-custom-green">plan</span>
      </h2>
      <p className="text-lg font-light text-[#0A0A0A9E] max-w-2xl mx-auto">
        Transparent pricing with no hidden costs. Start for free and upgrade
        when you're ready.
      </p>
    </div>
  );
};
