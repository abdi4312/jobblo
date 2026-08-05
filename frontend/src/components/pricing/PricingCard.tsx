import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import type { Plan } from '../../features/plans/types';

interface PricingCardProps {
  plan: Plan;
  isPopular: boolean;
  onUpgradeClick: (plan: Plan) => void;
}

export const PricingCard: React.FC<PricingCardProps> = ({ plan, isPopular, onUpgradeClick }) => {
  const isFree = plan.price === 0;

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden transition-all ${isPopular
          ? 'bg-[#1a3a1a] text-white shadow-xl ring-2 ring-[#4ade80]/30'
          : 'bg-white text-gray-900 shadow-sm border border-gray-100'
        }`}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute top-4 right-4 bg-[#4ade80] text-[#1a3a1a] text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
          Mest valgt
        </div>
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Plan name */}
        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isPopular ? 'text-[#4ade80]' : 'text-custom-green'}`}>
          {plan.type === 'business' ? 'Bedrift' : 'Privatperson'}
        </p>
        <h3 className="text-xl font-black mb-4">{plan.name}</h3>

        {/* Price */}
        <div className="mb-6">
          {isFree ? (
            <div>
              <span className="text-4xl font-black">Gratis</span>
              <p className={`text-xs mt-1 ${isPopular ? 'text-white/50' : 'text-gray-400'}`}>
                Ingen kredittkort nødvendig
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className={`text-base font-medium ${isPopular ? 'text-white/60' : 'text-gray-400'}`}>kr / mnd</span>
              </div>
              <p className={`text-xs mt-1 ${isPopular ? 'text-white/50' : 'text-gray-400'}`}>
                Betales månedlig · si opp når som helst
              </p>
            </div>
          )}
        </div>

        {/* Features */}
        {plan.featuresText && plan.featuresText.length > 0 && (
          <ul className="space-y-2.5 mb-7 flex-1">
            {plan.featuresText.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${isPopular ? 'bg-[#4ade80]/20' : 'bg-custom-green/10'
                  }`}>
                  <Check size={10} strokeWidth={3} className={isPopular ? 'text-[#4ade80]' : 'text-custom-green'} />
                </div>
                <span className={isPopular ? 'text-white/80' : 'text-gray-600'}>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <button
          onClick={() => onUpgradeClick(plan)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${isPopular
              ? 'bg-white text-[#1a3a1a] hover:bg-[#f0faf0]'
              : isFree
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-[#1a3a1a] text-white hover:bg-[#254d25]'
            }`}
        >
          {isFree ? 'Kom i gang gratis' : 'Velg denne planen'}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
