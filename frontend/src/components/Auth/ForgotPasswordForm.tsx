import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Input } from '../Ui/Input.tsx';
import { Button } from '../Ui/button/Button';
import { useForm } from '../../hooks/useForm.ts';
import { forgotPassword, verifyOtp, resetPassword } from '../../features/auth/Api';
import {
    forgotPasswordValidationSchema,
    resetPasswordValidationSchema,
    type ForgotPasswordFormValues,
    type ResetPasswordFormValues,
} from '../../validations/authValidations';

type Step = 'email' | 'otp' | 'newPassword';

// ─── OTP Input: 6 individual boxes ───────────────────────────────────────────
function OtpInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

    const focus = (i: number) => inputs.current[i]?.focus();

    const handleKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
        if (e.key === 'Backspace') {
            if (digits[i]) {
                const next = [...digits];
                next[i] = '';
                onChange(next.join(''));
            } else if (i > 0) {
                focus(i - 1);
            }
        }
    };

    const handleChange = (char: string, i: number) => {
        const sanitized = char.replace(/\D/g, '').slice(-1);
        if (!sanitized) return;
        const next = [...digits];
        next[i] = sanitized;
        onChange(next.join(''));
        if (i < 5) focus(i + 1);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted) {
            onChange(pasted.padEnd(6, '').slice(0, 6));
            focus(Math.min(pasted.length, 5));
        }
        e.preventDefault();
    };

    return (
        <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => {
                        inputs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    aria-label={`OTP siffer ${i + 1}`}
                    onChange={(e) => handleChange(e.target.value, i)}
                    onKeyDown={(e) => handleKey(e, i)}
                    className={[
                        'w-12 h-14 text-center text-[22px] font-bold rounded-xl border-2 outline-none transition-all',
                        'focus:border-black focus:ring-2 focus:ring-black/10',
                        d ? 'border-black bg-gray-50' : 'border-gray-200 bg-white',
                    ].join(' ')}
                />
            ))}
        </div>
    );
}

// ─── Countdown + resend ───────────────────────────────────────────────────────
function Countdown({
    seconds,
    onResend,
    isSending,
}: {
    seconds: number;
    onResend: () => void;
    isSending: boolean;
}) {
    const [remaining, setRemaining] = useState(seconds);

    useEffect(() => {
        setRemaining(seconds);
    }, [seconds]);

    useEffect(() => {
        if (remaining <= 0) return;
        const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
        return () => clearTimeout(t);
    }, [remaining]);

    if (remaining > 0) {
        return (
            <p className="text-sm text-[#6B7280] text-center">
                Send kode på nytt om{' '}
                <span className="font-semibold text-black">
                    {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                </span>
            </p>
        );
    }

    return (
        <p className="text-sm text-[#6B7280] text-center">
            Fikk du ikke koden?{' '}
            <button
                type="button"
                disabled={isSending}
                onClick={onResend}
                className="font-bold text-black hover:underline disabled:opacity-50"
            >
                {isSending ? 'Sender...' : 'Send på nytt'}
            </button>
        </p>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const ForgotPasswordForm = () => {
    const navigate = useNavigate();

    // All state – declared unconditionally at the top
    const [step, setStep] = useState<Step>('email');
    const [emailSent, setEmailSent] = useState('');
    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [countdownKey, setCountdownKey] = useState(0);

    const emailForm = useForm<ForgotPasswordFormValues>(
        { email: '' },
        forgotPasswordValidationSchema
    );

    const passwordForm = useForm<ResetPasswordFormValues>(
        { password: '', confirmPassword: '' },
        resetPasswordValidationSchema
    );

    // Mutations – all declared unconditionally
    const sendOtpMutation = useMutation({
        mutationFn: (email: string) => forgotPassword(email),
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || 'Noe gikk galt. Prøv igjen.');
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: ({ email, otp }: { email: string; otp: string }) => verifyOtp(email, otp),
        onError: () => {
            setOtpError('Ugyldig eller utløpt kode. Prøv igjen.');
        },
    });

    const resetPasswordMutation = useMutation({
        mutationFn: ({ token, password }: { token: string; password: string }) =>
            resetPassword(token, password),
        onSuccess: () => {
            toast.success('Passordet er oppdatert! Du kan nå logge inn.');
            navigate('/login');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || 'Noe gikk galt. Start på nytt.');
        },
    });

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSendOtp = () => {
        if (!emailForm.validate()) {
            toast.error('Vennligst skriv inn en gyldig e-postadresse');
            return;
        }
        sendOtpMutation.mutate(emailForm.values.email, {
            onSuccess: () => {
                setEmailSent(emailForm.values.email);
                setStep('otp');
                setCountdownKey((k) => k + 1);
            },
        });
    };

    const handleVerifyOtp = () => {
        if (otp.length < 6) {
            setOtpError('Skriv inn alle 6 siffer');
            return;
        }
        setOtpError('');
        verifyOtpMutation.mutate(
            { email: emailSent, otp },
            {
                onSuccess: (data: { resetToken: string }) => {
                    setResetToken(data.resetToken);
                    setStep('newPassword');
                },
            }
        );
    };

    const handleResend = () => {
        sendOtpMutation.mutate(emailSent, {
            onSuccess: () => {
                setOtp('');
                setOtpError('');
                setCountdownKey((k) => k + 1);
                toast.success('Ny kode er sendt!');
            },
        });
    };

    const handleResetPassword = () => {
        if (!passwordForm.validate()) {
            toast.error('Vennligst fyll ut alle felt riktig');
            return;
        }
        resetPasswordMutation.mutate({ token: resetToken, password: passwordForm.values.password });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full lg:w-[50%] flex items-center justify-center p-4">
            <div className="w-full max-w-120 p-8">

                {/* ── STEP 1: Email ──────────────────────────────────────────────── */}
                {step === 'email' && (
                    <>
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-black transition-colors mb-8"
                        >
                            <ArrowLeft size={16} />
                            <span>Tilbake til innlogging</span>
                        </button>

                        <div className="mb-8">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <Mail size={22} className="text-black" />
                            </div>
                            <h1 className="text-[28px] font-bold text-black leading-tight mb-2">
                                Glemt passordet?
                            </h1>
                            <p className="text-base text-[#6B7280]">
                                Skriv inn e-postadressen din. Vi sender deg en 6-sifret kode.
                            </p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                                    E-postadresse
                                </label>
                                <Input
                                    type="email"
                                    value={emailForm.values.email}
                                    placeholder="deg@eksempel.no"
                                    onChange={(e) => emailForm.handleChange('email', e.target.value)}
                                    error={emailForm.errors.email}
                                    className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                                />
                            </div>

                            <Button
                                onClick={handleSendOtp}
                                loading={sendOtpMutation.isPending}
                                className="py-3 rounded-lg font-bold"
                                label="Send kode"
                            />
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-sm text-[#6B7280]">
                                Husker du passordet?{' '}
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="font-bold text-black hover:underline"
                                >
                                    Logg inn
                                </button>
                            </p>
                        </div>
                    </>
                )}

                {/* ── STEP 2: OTP ────────────────────────────────────────────────── */}
                {step === 'otp' && (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('email');
                                setOtp('');
                                setOtpError('');
                            }}
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
                                <span className="font-semibold text-black">{emailSent}</span>
                            </p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <OtpInput
                                value={otp}
                                onChange={(val) => {
                                    setOtp(val);
                                    setOtpError('');
                                }}
                            />

                            {otpError && (
                                <p className="text-sm text-red-500 text-center -mt-2">{otpError}</p>
                            )}

                            <Button
                                onClick={handleVerifyOtp}
                                loading={verifyOtpMutation.isPending}
                                disabled={otp.length < 6}
                                className="py-3 rounded-lg font-bold"
                                label="Bekreft kode"
                            />

                            <Countdown
                                key={countdownKey}
                                seconds={60}
                                onResend={handleResend}
                                isSending={sendOtpMutation.isPending}
                            />
                        </div>
                    </>
                )}

                {/* ── STEP 3: New Password ────────────────────────────────────────── */}
                {step === 'newPassword' && (
                    <>
                        <div className="mb-8">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <Lock size={22} className="text-black" />
                            </div>
                            <h1 className="text-[28px] font-bold text-black leading-tight mb-2">
                                Nytt passord
                            </h1>
                            <p className="text-base text-[#6B7280]">
                                Velg et sterkt passord med minst 8 tegn.
                            </p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                                    Nytt passord
                                </label>
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    value={passwordForm.values.password}
                                    placeholder="Minimum 8 tegn"
                                    onChange={(e) => passwordForm.handleChange('password', e.target.value)}
                                    error={passwordForm.errors.password}
                                    className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
                                    rightIcon={
                                        <button
                                            type="button"
                                            className="text-gray-400 hover:text-black transition-colors"
                                            onClick={() => setShowPassword((p) => !p)}
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                                    Bekreft passord
                                </label>
                                <Input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={passwordForm.values.confirmPassword}
                                    placeholder="Gjenta passordet"
                                    onChange={(e) => passwordForm.handleChange('confirmPassword', e.target.value)}
                                    error={passwordForm.errors.confirmPassword}
                                    className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
                                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                                    rightIcon={
                                        <button
                                            type="button"
                                            className="text-gray-400 hover:text-black transition-colors"
                                            onClick={() => setShowConfirm((p) => !p)}
                                        >
                                            {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    }
                                />
                            </div>

                            <Button
                                onClick={handleResetPassword}
                                loading={resetPasswordMutation.isPending}
                                className="py-3 rounded-lg font-bold"
                                label="Lagre nytt passord"
                            />
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};
