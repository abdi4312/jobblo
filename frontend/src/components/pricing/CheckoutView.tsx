import React from 'react';
import { Check, X, ArrowLeft, Tag, ShoppingCart } from 'lucide-react';
import { Button } from '../../components/Ui/button/Button';
import { Input } from '../../components/Ui/Input';
import type { Plan } from '../../features/plans/types.ts';

interface CheckoutViewProps {
  selectedPlan: Plan;
  step: 'pricing' | 'checkout';
  setStep: (step: 'pricing' | 'checkout') => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  isApplyingPromo: boolean;
  discountInfo: {
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    code: string;
    type: 'percentage' | 'fixed';
    amount: number;
  } | null;
  setDiscountInfo: (info: any) => void;
  isRedirecting: boolean;
  handleApplyPromo: () => void;
  handleCheckout: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  selectedPlan,
  setStep,
  promoCode,
  setPromoCode,
  isApplyingPromo,
  discountInfo,
  setDiscountInfo,
  isRedirecting,
  handleApplyPromo,
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

                {discountInfo && (
                  <div className="flex justify-between text-[#22C55E] font-medium">
                    <span className="flex items-center gap-1">
                      <Tag size={14} />
                      Rabatt (
                      {discountInfo.type === 'percentage'
                        ? `${discountInfo.amount}%`
                        : `${discountInfo.amount} kr`}
                      )
                    </span>
                    <span>-{discountInfo.discountAmount} kr</span>
                  </div>
                )}

                <div className="pt-4 border-t border-[#F8F9FA] flex justify-between items-center">
                  <span className="text-lg font-bold text-[#212529]">Totalt å betale</span>
                  <span className="text-3xl font-black text-custom-green">
                    {discountInfo ? discountInfo.finalPrice : selectedPlan.price} kr
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
            {/* Promo Code Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E9ECEF]">
              <h3 className="text-lg font-bold text-[#212529] mb-4 flex items-center gap-2">
                <Tag size={18} className="text-custom-green" />
                Har du en rabattkode?
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Skriv inn kode"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="h-12 rounded-xl border-[#E9ECEF] focus:border-custom-green focus:ring-0"
                  disabled={isApplyingPromo || !!discountInfo}
                />
                <Button
                  onClick={handleApplyPromo}
                  loading={isApplyingPromo}
                  disabled={!promoCode.trim() || !!discountInfo}
                  className="h-12 px-6 rounded-xl bg-[#1a3a1a] text-white hover:bg-[#254d25] border-none font-bold"
                >
                  Bruk
                </Button>
              </div>
              {discountInfo && (
                <div className="mt-3 flex items-center justify-between bg-[#F0FFF4] px-4 py-2 rounded-lg border border-[#C6F6D5]">
                  <span className="text-sm text-[#2F855A] font-medium">
                    Kode <strong>{discountInfo.code}</strong> er aktivert!
                  </span>
                  <button
                    title="Fjern rabattkode"
                    onClick={() => {
                      setDiscountInfo(null);
                      setPromoCode('');
                    }}
                    className="text-[#2F855A] hover:text-[#276749]"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

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
                <div className="mt-6 flex items-center justify-center gap-4 opacity-60">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
                    alt="Stripe"
                    className="h-6 brightness-0 invert"
                  />
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
