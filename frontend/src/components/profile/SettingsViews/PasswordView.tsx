import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { changePasswordSendOtp, changePasswordVerifyOtp } from '../../../features/auth/Api';
import OtpInput from '../../Auth/OtpInput.tsx';
import OtpCountdown from '../../Auth/OtpCountdown.tsx';

type Step = 'form' | 'otp' | 'done';

// ── Small reusable password field ────────────────────────────────────────────
function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = '••••••••',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-bold text-gray-500 uppercase tracking-tight"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full bg-gray-100 hover:bg-gray-200 focus:bg-white outline-none rounded-2xl px-4 py-3 pr-11',
            'text-gray-900 font-medium transition-colors border',
            error ? 'border-red-400' : 'border-transparent focus:border-gray-300',
          ].join(' ')}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const PasswordView = () => {
  const [step, setStep] = useState<Step>('form');
  const [countdownKey, setCountdownKey] = useState(0);

  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  // ── Mutations ────────────────────────────────────────────────────────────
  const sendOtpMutation = useMutation({
    mutationFn: () => changePasswordSendOtp(currentPassword),
    onSuccess: () => {
      setStep('otp');
      setCountdownKey((k) => k + 1);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      const msg = err.response?.data?.error || 'Noe gikk galt. Prøv igjen.';
      setFormErrors((prev) => ({ ...prev, currentPassword: msg }));
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => changePasswordVerifyOtp(otp, newPassword),
    onSuccess: () => {
      setStep('done');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      setOtpError(err.response?.data?.error || 'Ugyldig eller utløpt kode.');
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Skriv inn nåværende passord';
    if (!newPassword || newPassword.length < 8)
      errors.newPassword = 'Passordet må være minst 8 tegn';
    if (newPassword && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword))
      errors.newPassword = 'Må inneholde stor/liten bokstav og tall';
    if (newPassword !== confirmPassword) errors.confirmPassword = 'Passordene matcher ikke';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSendOtp = () => {
    if (!validateForm()) return;
    sendOtpMutation.mutate();
  };

  const handleVerifyOtp = () => {
    if (otp.length < 6) { setOtpError('Skriv inn alle 6 siffer'); return; }
    setOtpError('');
    verifyOtpMutation.mutate();
  };

  const handleResend = () => {
    sendOtpMutation.mutate(undefined, {
      onSuccess: () => {
        setOtp('');
        setOtpError('');
        setCountdownKey((k) => k + 1);
      },
    });
  };

  const handleReset = () => {
    setStep('form');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtp('');
    setOtpError('');
    setFormErrors({});
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="flex flex-col gap-6 max-w-2xl">

      {/* ── STEP 1: Password form ─────────────────────────────────────── */}
      {step === 'form' && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <Lock size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Endre passord</h2>
              <p className="text-xs text-gray-500">
                Du vil motta en kode på e-post for å bekrefte endringen.
              </p>
            </div>
          </div>

          <PasswordField
            id="currentPassword"
            label="Nåværende passord"
            value={currentPassword}
            onChange={(v) => { setCurrentPassword(v); setFormErrors((p) => ({ ...p, currentPassword: '' })); }}
            error={formErrors.currentPassword}
          />

          <PasswordField
            id="newPassword"
            label="Nytt passord"
            value={newPassword}
            onChange={(v) => { setNewPassword(v); setFormErrors((p) => ({ ...p, newPassword: '' })); }}
            error={formErrors.newPassword}
            placeholder="Minst 8 tegn"
          />

          <PasswordField
            id="confirmPassword"
            label="Bekreft nytt passord"
            value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); setFormErrors((p) => ({ ...p, confirmPassword: '' })); }}
            error={formErrors.confirmPassword}
          />

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sendOtpMutation.isPending}
            className="w-full font-bold text-base py-3.5 rounded-2xl text-white bg-custom-green hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sendOtpMutation.isPending ? 'Sender kode...' : 'Fortsett'}
          </button>
        </>
      )}

      {/* ── STEP 2: OTP ──────────────────────────────────────────────── */}
      {step === 'otp' && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <ShieldCheck size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Bekreft med kode</h2>
              <p className="text-xs text-gray-500">
                Vi sendte en 6-sifret kode til e-posten din.
              </p>
            </div>
          </div>

          <OtpInput
            value={otp}
            onChange={(val) => { setOtp(val); setOtpError(''); }}
            onComplete={handleVerifyOtp}
            disabled={verifyOtpMutation.isPending}
          />

          {otpError && (
            <p className="text-sm text-red-500 text-center -mt-2">{otpError}</p>
          )}

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={otp.length < 6 || verifyOtpMutation.isPending}
            className="w-full font-bold text-base py-3.5 rounded-2xl text-white bg-custom-green hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {verifyOtpMutation.isPending ? 'Bekrefter...' : 'Bekreft kode'}
          </button>

          <OtpCountdown
            key={countdownKey}
            seconds={60}
            onResend={handleResend}
            isSending={sendOtpMutation.isPending}
          />

          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 text-center transition-colors"
          >
            ← Tilbake
          </button>
        </>
      )}

      {/* ── STEP 3: Done ─────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Passordet er oppdatert!</h2>
            <p className="text-sm text-gray-500">
              Neste gang du logger inn, bruk det nye passordet ditt.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 text-sm font-semibold text-gray-700 hover:text-black underline transition-colors"
          >
            Endre passord igjen
          </button>
        </div>
      )}

    </section>
  );
};
