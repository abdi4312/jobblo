import React from 'react';
import { Banknote, AlertCircle, Gavel, Clock, Zap, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { MICRO_LABEL } from '../../theme/brand';

interface PaymentInformationProps {
  paymentType: string;
  setPaymentType: (val: string) => void;
  price: string | number;
  setPrice: (val: string) => void;
  hourlyRate: string | number;
  setHourlyRate: (val: string) => void;
  urgent: boolean;
  setUrgent: (val: boolean) => void;
  subscription?: string;
  errors?: any;
}

const PAYMENT_METHODS = [
  {
    id: 'Fastpris',
    label: 'Fastpris',
    icon: Banknote,
    desc: 'Én avtalt sum for hele jobben',
  },
  {
    id: 'Timepris',
    label: 'Timepris',
    icon: Clock,
    desc: 'Betal per time som brukes',
  },
  {
    id: 'Anbud',
    label: 'Anbud',
    icon: Gavel,
    desc: 'La flere gi deg tilbud',
  },
];

export const PaymentInformation: React.FC<PaymentInformationProps> = ({
  paymentType,
  setPaymentType,
  price,
  setPrice,
  hourlyRate,
  setHourlyRate,
  urgent,
  setUrgent,
  subscription = 'Standard',
  errors,
}) => {
  const isPaidSubscriber = subscription !== 'Standard';
  const isHourly = paymentType === 'Timepris';

  const amountLabel = isHourly
    ? 'Timepris'
    : paymentType === 'Anbud'
      ? 'Antatt budsjett'
      : 'Fastpris';

  // On Timepris the field edits `hourlyRate` while validation runs against the derived
  // `price`. The error was rendered under this input regardless, so "budsjett må være
  // over 0" appeared beneath a box the user had just typed a valid hourly rate into.
  // The total is what is actually wrong, so on Timepris the message belongs there.
  const priceError = errors?.price;
  const showErrorOnField = priceError && !isHourly;
  const showErrorOnTotal = priceError && isHourly;

  const total = Number(price) || 0;

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-5 duration-300">
      {/* ── Betalingsmetode ─────────────────────────────────────────────── */}
      <div className="box-card-custom p-5 md:p-6">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
          Betaling
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-[#63665F]">Hvordan vil du avtale prisen?</p>

        <div
          role="radiogroup"
          aria-label="Betalingsmetode"
          className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          {PAYMENT_METHODS.map((method) => {
            const active = paymentType === method.id;
            const Icon = method.icon;
            return (
              <button
                key={method.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPaymentType(method.id)}
                className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                  active
                    ? 'border-[#2E6641] bg-[#EAF1E9]'
                    : 'border-[#E6E7E1] bg-white hover:border-[#2E6641]/45'
                }`}
              >
                <span
                  className={`mb-2.5 flex size-9 items-center justify-center rounded-xl transition-colors ${
                    active ? 'bg-[#2E6641] text-white' : 'bg-[#F4F6F0] text-[#63665F]'
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <p
                  className={`text-[0.9375rem] font-semibold ${
                    active ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
                  }`}
                >
                  {method.label}
                </p>
                <p className="mt-0.5 text-[0.75rem] leading-snug text-[#63665F]">{method.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Beløp ───────────────────────────────────────────────────────── */}
      <div className="box-card-custom p-5 md:p-6">
        <label htmlFor="job-amount" className={MICRO_LABEL}>
          {amountLabel} · påkrevd
        </label>

        <div className="relative mt-3">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[0.9375rem] font-medium text-[#9B9E96]">
            kr
          </span>
          <input
            id="job-amount"
            type="number"
            min="1"
            inputMode="numeric"
            value={isHourly ? hourlyRate : price}
            onChange={(e) => (isHourly ? setHourlyRate(e.target.value) : setPrice(e.target.value))}
            placeholder={paymentType === 'Anbud' ? '5000' : '0'}
            aria-invalid={showErrorOnField ? true : undefined}
            className={`h-13 w-full rounded-xl border bg-white pl-11 pr-4 text-[1.125rem] font-semibold tabular-nums text-[#0B0B0B] outline-none transition-colors placeholder:font-normal placeholder:text-[#9B9E96] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              showErrorOnField
                ? 'border-[#B4453A] focus:ring-4 focus:ring-[#B4453A]/10'
                : 'border-[#E6E7E1] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10'
            }`}
          />
          {isHourly && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.8125rem] text-[#9B9E96]">
              per time
            </span>
          )}
        </div>

        {showErrorOnField && (
          <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-[#B4453A]">
            <AlertCircle size={13} /> {priceError}
          </p>
        )}

        {isHourly && (
          <div
            className={`mt-3 flex items-baseline justify-between gap-3 rounded-xl px-4 py-3 ${
              showErrorOnTotal ? 'bg-[#B4453A]/8' : 'bg-[#F4F6F0]'
            }`}
          >
            <span className="text-[0.8125rem] text-[#63665F]">
              Beregnet totalpris for oppgitt varighet
            </span>
            <span className="shrink-0 text-[1rem] font-bold tabular-nums text-[#0B0B0B]">
              {total.toLocaleString('nb-NO')} kr
            </span>
          </div>
        )}
        {showErrorOnTotal && (
          <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-[#B4453A]">
            <AlertCircle size={13} /> {priceError} Sjekk timepris og varighet.
          </p>
        )}

        {paymentType === 'Anbud' && (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-[#63665F]">
            Budsjettet vises til de som gir tilbud, så de har en økonomisk ramme å forholde seg
            til. Du binder deg ikke til beløpet.
          </p>
        )}
      </div>

      {/* ── Haster ──────────────────────────────────────────────────────── */}
      <div className="box-card-custom p-5 md:p-6">
        <button
          type="button"
          role="switch"
          aria-checked={urgent && isPaidSubscriber}
          onClick={() => {
            if (!isPaidSubscriber) {
              toast.error('Haster er kun tilgjengelig for betalte abonnementer');
              return;
            }
            setUrgent(!urgent);
          }}
          className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                urgent && isPaidSubscriber
                  ? 'bg-[#122A1C] text-white'
                  : 'bg-[#F4F6F0] text-[#63665F]'
              }`}
            >
              <Zap size={16} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[0.9375rem] font-semibold text-[#0B0B0B]">
                Haster oppdraget?
                {!isPaidSubscriber && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[#F4F6F0] px-2 text-[0.625rem] font-bold uppercase tracking-wider text-[#63665F]">
                    <Lock size={9} strokeWidth={2.6} />
                    Betalt
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[#63665F]">
                Merkes med «Haster» og løftes høyere i søket.
              </span>
            </span>
          </span>

          <span
            className={`h-6 w-11 shrink-0 rounded-full p-0.75 transition-colors duration-200 ${
              urgent && isPaidSubscriber ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
            }`}
          >
            <span
              className={`block size-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                urgent && isPaidSubscriber ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
};
