import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '../Ui/button/Button';
import OtpInput from './OtpInput.tsx';
import OtpCountdown from './OtpCountdown.tsx';

interface Props {
  email: string;
  otp: string;
  otpError: string;
  countdownKey: number;
  isVerifying: boolean;
  isResending: boolean;
  onOtpChange: (val: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
}

export default function ForgotPasswordStepOtp({
  email,
  otp,
  otpError,
  countdownKey,
  isVerifying,
  isResending,
  onOtpChange,
  onSubmit,
  onResend,
  onBack,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-black transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        <span>Tilbake</span>
      </button>

      <div className="mb-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <ShieldCheck size={22} className="text-black" />
        </div>
        <h1 className="text-[28px] font-bold text-black leading-tight mb-2">
          Sjekk e-posten din
        </h1>
        <p className="text-base text-[#6B7280]">
          Vi sendte en 6-sifret kode til{' '}
          <span className="font-semibold text-black">{email}</span>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <OtpInput
          value={otp}
          onChange={(val) => { onOtpChange(val); }}
          onComplete={onSubmit}
          disabled={isVerifying}
        />

        {otpError && (
          <p className="text-sm text-red-500 text-center -mt-2">{otpError}</p>
        )}

        <Button
          onClick={onSubmit}
          loading={isVerifying}
          disabled={otp.length < 6}
          className="py-3 rounded-lg font-bold"
          label="Bekreft kode"
        />

        <OtpCountdown
          key={countdownKey}
          seconds={60}
          onResend={onResend}
          isSending={isResending}
        />
      </div>
    </>
  );
}