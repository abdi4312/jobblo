import React from "react";
import { Check } from "lucide-react";
import { Button } from "../../components/Ui/button/Button";
import type { Plan } from "../../features/plans/types";

interface PricingCardProps {
  plan: Plan;
  isPopular: boolean;
  onUpgradeClick: (plan: Plan) => void;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  isPopular,
  onUpgradeClick,
}) => {
  return (
    <div
      className={`box-card-custom flex flex-col rounded-3xl p-8 transition-all duration-300 relative ${
        isPopular
          ? "ring-2 ring-custom-green/50 shadow-2xl scale-105 z-10"
          : "box-card-custom"
      }`}
    >
      {isPopular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-custom px-6 py-1.5 rounded-full shadow-lg">
          <p className="text-sm font-bold text-white uppercase tracking-wider">
            Most Popular
          </p>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-2xl font-bold text-custom-black mb-2">
          {plan.name}
        </h3>
        <p className="text-base text-custom-black/70">
          For serious freelancers
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-black text-custom-black">
            {plan.price}
          </span>
          <span className="text-xl text-custom-black/70">kr</span>
        </div>
        <p className="text-sm text-custom-black/70 mt-1">per month</p>
      </div>

      <Button
        label="Upgrade now"
        onClick={() => onUpgradeClick(plan)}
        size="default"
        variant="default"
        className={`w-full mb-8 py-4 font-bold ${
          isPopular
            ? "bg-custom-green text-white"
            : "bg-transparent text-custom-green border-2 border-custom-green hover:bg-custom-green hover:text-white"
        }`}
      />

      <div className="flex-1">
        <p className="text-sm font-bold text-custom-black uppercase tracking-wider mb-4 px-1">
          Features
        </p>
        <ul className="space-y-4">
          {plan.featuresText?.map((feature, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-[15px] text-custom-black/70"
            >
              <div className="mt-1 shrink-0 w-5 h-5 rounded-full bg-[#E0883515] flex items-center justify-center text-orange-custom">
                <Check size={12} strokeWidth={3} />
              </div>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
