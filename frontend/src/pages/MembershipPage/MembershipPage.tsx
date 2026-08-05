import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, ShieldCheck, Loader2, Tag, X, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePlans } from '../../features/plans/hooks';
import { useUserStore } from '../../stores/userStore';
import mainLink from '../../api/mainURLs';
import type { Plan } from '../../features/plans/types';

export default function MembershipPage() {
    const navigate = useNavigate();
    const { user } = useUserStore();
    const { data: plans, isLoading } = usePlans();

    const defaultType: 'private' | 'business' = user?.role === 'company' ? 'business' : 'private';
    const [userType, setUserType] = useState<'private' | 'business'>(defaultType);
    const typePlans = plans?.filter((p) => p.type === userType) || [];

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);
    const [discount, setDiscount] = useState<{
        originalPrice: number;
        discountAmount: number;
        finalPrice: number;
        code: string;
        type: 'percentage' | 'fixed';
        amount: number;
    } | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const selectedPlan: Plan | null = typePlans.find((p) => p._id === selectedId) ?? null;
    const isFree = selectedPlan?.price === 0;
    const finalPrice = discount ? discount.finalPrice : selectedPlan?.price ?? 0;

    const handleApplyPromo = async () => {
        if (!promoCode.trim() || !selectedPlan) return;
        setIsApplyingPromo(true);
        try {
            const res = await mainLink.post('/api/coupons/validate', {
                planId: selectedPlan._id,
                code: promoCode.trim(),
            });
            setDiscount({ ...res.data.data, code: promoCode.trim() });
            toast.success('Rabattkode aktivert!');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ugyldig kode');
            setDiscount(null);
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleCheckout = async () => {
        if (!selectedPlan || isFree) return;
        setIsRedirecting(true);
        try {
            const payload: { planId: string; couponCode?: string } = { planId: selectedPlan._id };
            if (discount) payload.couponCode = discount.code;
            const res = await mainLink.post('/api/stripe/create-checkout-session', payload);
            window.location.href = res.data.url;
        } catch {
            toast.error('Kunne ikke starte betaling. Prøv igjen.');
            setIsRedirecting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f0e8]">
            {/* Header */}
            <div className=" border-b border-gray-100 px-4 py-4">
                <div className="max-w-5xl mx-auto flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <span className="font-bold text-gray-900">Jobblo Medlemskap</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-start">

                    {/* LEFT — Plan selector */}
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 mb-0.5">Velg ditt abonnement</h2>
                            <p className="text-sm text-gray-400 mb-4">Bytt plan når du vil — si opp når som helst.</p>

                            {/* Type switcher */}
                            <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
                                {(['private', 'business'] as const).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => { setUserType(type); setSelectedId(null); setDiscount(null); setPromoCode(''); }}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${userType === type
                                            ? 'bg-[#1a3a1a] text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {type === 'private' ? 'Privatperson' : 'Bedrift'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center gap-2 py-8 text-gray-400">
                                <Loader2 size={18} className="animate-spin" />
                                <span className="text-sm">Henter planer...</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {typePlans.map((plan) => {
                                    const selected = selectedId === plan._id;
                                    const free = plan.price === 0;
                                    return (
                                        <label
                                            key={plan._id}
                                            className={`flex items-start gap-4 bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all ${selected
                                                ? 'border-[#1a3a1a] shadow-sm'
                                                : 'border-gray-100 hover:border-gray-200'
                                                }`}
                                        >
                                            {/* Radio */}
                                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'border-[#1a3a1a] bg-[#1a3a1a]' : 'border-gray-300 bg-white'
                                                }`}>
                                                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                            <input
                                                type="radio"
                                                name="plan"
                                                value={plan._id}
                                                checked={selected}
                                                onChange={() => { setSelectedId(plan._id); setDiscount(null); setPromoCode(''); }}
                                                className="sr-only"
                                            />

                                            {/* Plan info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="font-black text-gray-900 uppercase tracking-wide text-sm">
                                                        {plan.name}
                                                    </span>
                                                    {free && (
                                                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                            Gjeldende plan
                                                        </span>
                                                    )}
                                                </div>
                                                {selected && plan.featuresText?.length > 0 && (
                                                    <ul className="mt-2 space-y-1">
                                                        {plan.featuresText.slice(0, 4).map((f, i) => (
                                                            <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                                                                <Check size={11} className="text-[#1a3a1a] shrink-0" />
                                                                {f}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>

                                            {/* Price */}
                                            <div className="text-right shrink-0">
                                                <p className="font-black text-gray-900 text-base">
                                                    {free ? '0' : plan.price} kr
                                                    <span className="text-xs font-normal text-gray-400">/mnd</span>
                                                </p>
                                                {free && <p className="text-xs text-gray-400">Alltid gratis</p>}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* Promo code */}
                        {selectedPlan && !isFree && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                                    <Tag size={13} className="text-[#1a3a1a]" /> Rabattkode
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                        placeholder="Skriv inn kode"
                                        disabled={!!discount}
                                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a3a1a] focus:ring-2 focus:ring-[#1a3a1a]/10 transition-all disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyPromo}
                                        disabled={!promoCode.trim() || !!discount || isApplyingPromo}
                                        className="px-4 py-2.5 bg-[#1a3a1a] text-white text-sm font-bold rounded-xl hover:bg-[#254d25] transition-colors disabled:opacity-50"
                                    >
                                        {isApplyingPromo ? <Loader2 size={14} className="animate-spin" /> : 'Bruk'}
                                    </button>
                                </div>
                                {discount && (
                                    <div className="mt-2 flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                        <span className="text-xs text-green-700 font-medium">
                                            Kode <strong>{discount.code}</strong> aktivert — -{discount.discountAmount} kr
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setDiscount(null); setPromoCode(''); }}
                                            className="text-green-600 hover:text-green-800"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT — Summary */}
                    <div className="lg:sticky lg:top-6 space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-5">
                                Sammendrag
                            </h3>

                            {!selectedPlan ? (
                                <p className="text-sm text-gray-400 text-center py-6">
                                    Velg en plan for å se sammendrag
                                </p>
                            ) : (
                                <>
                                    <div className="space-y-3 mb-5">
                                        <div className="flex justify-between text-sm text-gray-500">
                                            <span>Forfaller i dag</span>
                                            <span className="font-semibold text-gray-900">
                                                {isFree ? '0 kr' : `${selectedPlan.price} kr`}
                                            </span>
                                        </div>
                                        {discount && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span>Rabatt</span>
                                                <span className="font-semibold">-{discount.discountAmount} kr</span>
                                            </div>
                                        )}
                                        <div className="border-t border-gray-100 pt-3 flex justify-between">
                                            <span className="font-bold text-gray-900 text-sm">Totalt</span>
                                            <span className="font-black text-[#1a3a1a] text-lg">
                                                {isFree ? '0 kr' : `${finalPrice} kr`}
                                                {!isFree && <span className="text-xs font-normal text-gray-400">/mnd</span>}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={isFree ? () => navigate('/') : handleCheckout}
                                        disabled={isRedirecting}
                                        className="w-full flex items-center justify-center gap-2 bg-[#1a3a1a] text-white font-bold py-3.5 rounded-xl hover:bg-[#254d25] transition-colors disabled:opacity-60 text-sm"
                                    >
                                        {isRedirecting ? (
                                            <><Loader2 size={16} className="animate-spin" /> Sender deg videre...</>
                                        ) : isFree ? (
                                            <><Zap size={15} /> Kom i gang gratis</>
                                        ) : (
                                            <><ShieldCheck size={15} /> Start abonnement</>
                                        )}
                                    </button>

                                    <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
                                        {isFree
                                            ? 'Ingen kredittkort nødvendig.'
                                            : 'Abonnementet fornyes automatisk. Si opp når som helst under innstillinger.'}
                                    </p>

                                    {/* Trust */}
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                                        <ShieldCheck size={13} className="text-[#1a3a1a]" />
                                        Trygg betaling via Stripe
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
