import React from 'react';

export const PricingHeader: React.FC = () => {
  return (
    <div className="text-center mb-10">
      <span className="inline-block text-xs font-bold uppercase tracking-widest text-custom-green bg-custom-green/8 px-3 py-1 rounded-full mb-4">
        Medlemskap
      </span>
      <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3 leading-tight">
        Velg det som passer deg
      </h1>
      <p className="text-base text-gray-500 max-w-xl mx-auto">
        Jobblo er bygget for det norske markedet. Start gratis — oppgrader når du er klar.
      </p>
    </div>
  );
};
