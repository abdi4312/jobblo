import React from 'react';
import { Check, ArrowLeft, ShoppingCart, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/Ui/button/Button';
import type { Plan } from '../../features/plans/types.ts';

interface CheckoutViewProps {
  selectedPlan: Plan;
  step: 'pricing' | 'checkout';
  setStep: (step: 'pricing' | 'checkout') => void;
  isRedirecting: boolean;
  handleCheckout: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  selectedPlan,
  setStep,
  isRedirecting,
  handleCheckout,
}) => {
  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setStep('pricing')}
          className="flex items-center gap-2 text-[#6C757D] hover:text-[#212529] mb-8 font-semibold transition-colors"
        >
          <ArrowLeft size={20} />
          Tilbake til planer
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E9ECEF]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#1a3a1a]/10 flex items-center justify-center text-[#1a3a1a]">
                <ShoppingCart size={20} />
              </div>
              <h2 className="text-2xl font-bold text-[#212529]">Ordresammendrag</h2>
            </div>

            <div className="space-y-6">
              <div className="pb-6 border-b border-[#F8F9FA]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-[#212529]">{selectedPlan.name}</h3>
                    <p className="text-sm text-[#6C757D]">Månedlig abonnement</p>
                  </div>
                  <span className="text-xl font-black text-[#212529]">{selectedPlan.price} kr</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[#6C757D]">
                  <span>Delsum</span>
                  <span>{selectedPlan.price} kr</span>
                </div>

                <div className="pt-4 border-t border-[#F8F9FA] flex justify-between items-center">
                  <span className="text-lg font-bold text-[#212529]">Totalt å betale</span>
                  <span className="text-3xl font-black text-custom-green">
                    {selectedPlan.price} kr
                  </span>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-sm font-bold text-[#212529] uppercase tracking-wider mb-4">
                  Inkluderte funksjoner
                </p>
                <ul className="space-y-3">
                  {selectedPlan.featuresText?.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#495057]">
                      <Check size={14} className="text-custom-green mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Payment & Promo */}
          <div className="space-y-6">
            {/* Checkout Button */}
            <div className="bg-[#1a3a1a] rounded-3xl p-8 shadow-lg text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Fullfør oppgradering</h3>
                <p className="text-sm text-white/70 mb-8">
                  Du sendes videre til Stripe for sikker betaling.
                </p>
                <Button
                  label={isRedirecting ? 'Sender deg videre...' : 'Gå til betaling'}
                  onClick={handleCheckout}
                  disabled={isRedirecting}
                  className="w-full py-4 !bg-white !text-[#1a3a1a] rounded-2xl font-black text-lg hover:!bg-[#f0faf0] transition-all shadow-xl"
                />
                {/* Was the Stripe logo hotlinked from Wikimedia — a third-party
                    host we don't control, on the checkout screen. */}
                <div className="mt-6 flex items-center justify-center gap-2 opacity-60 text-white text-[12px]">
                  <ShieldCheck size={14} />
                  <span>Sikker betaling med Stripe</span>
                </div>
              </div>
              <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
