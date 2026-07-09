import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useForm } from '../../hooks/useForm.ts';
import { forgotPassword, verifyOtp, resetPassword } from '../../features/auth/Api';
import {
    forgotPasswordValidationSchema,
    resetPasswordValidationSchema,
    type ForgotPasswordFormValues,
    type ResetPasswordFormValues,
} from '../../validations/authValidations';

import ForgotPasswordStepEmail from './ForgotPasswordStepEmail.tsx';
import ForgotPasswordStepOtp from './ForgotPasswordStepOtp.tsx';
import ForgotPasswordStepNewPassword from './ForgotPasswordStepNewPassword.tsx';

type Step = 'email' | 'otp' | 'newPassword';

export const ForgotPasswordForm = () => {
    const navigate = useNavigate();

    // ── State ──────────────────────────────────────────────────────────────────
    const [step, setStep] = useState<Step>('email');
    const [emailSent, setEmailSent] = useState('');
    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [countdownKey, setCountdownKey] = useState(0);
    const [emailServerError, setEmailServerError] = useState('');

    const emailForm = useForm<ForgotPasswordFormValues>(
        { email: '' },
        forgotPasswordValidationSchema
    );

    const passwordForm = useForm<ResetPasswordFormValues>(
        { password: '', confirmPassword: '' },
        resetPasswordValidationSchema
    );

    // ── Mutations ──────────────────────────────────────────────────────────────
    const sendOtpMutation = useMutation({
        mutationFn: (email: string) => forgotPassword(email),
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            const msg = err.response?.data?.error || 'Noe gikk galt. Prøv igjen.';
            setEmailServerError(msg);
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: ({ email, otp }: { email: string; otp: string }) => verifyOtp(email, otp),
        onError: () => {
            setOtpError('Ugyldig eller utløpt kode. Prøv igjen.');
        },
    });

    const resetPasswordMutation = useMutation({
        mutationFn: ({ resetToken, password }: { resetToken: string; password: string }) =>
            resetPassword(resetToken, password),
        onSuccess: () => {
            toast.success('Passordet er oppdatert! Du kan nå logge inn.');
            navigate('/login');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || 'Noe gikk galt. Start på nytt.');
        },
    });

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleSendOtp = () => {
        if (!emailForm.validate()) return;
        setEmailServerError('');
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
        resetPasswordMutation.mutate({ resetToken, password: passwordForm.values.password });
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="w-full lg:w-[50%] flex items-center justify-center p-4">
            <div className="w-full max-w-120 p-8">

                {step === 'email' && (
                    <ForgotPasswordStepEmail
                        email={emailForm.values.email}
                        emailError={emailForm.errors.email}
                        serverError={emailServerError}
                        isLoading={sendOtpMutation.isPending}
                        onEmailChange={(val) => {
                            emailForm.handleChange('email', val);
                            setEmailServerError(''); // clear server error on typing
                        }}
                        onSubmit={handleSendOtp}
                    />
                )}

                {step === 'otp' && (
                    <ForgotPasswordStepOtp
                        email={emailSent}
                        otp={otp}
                        otpError={otpError}
                        countdownKey={countdownKey}
                        isVerifying={verifyOtpMutation.isPending}
                        isResending={sendOtpMutation.isPending}
                        onOtpChange={(val) => { setOtp(val); setOtpError(''); }}
                        onSubmit={handleVerifyOtp}
                        onResend={handleResend}
                        onBack={() => { setStep('email'); setOtp(''); setOtpError(''); }}
                    />
                )}

                {step === 'newPassword' && (
                    <ForgotPasswordStepNewPassword
                        password={passwordForm.values.password}
                        confirmPassword={passwordForm.values.confirmPassword}
                        passwordError={passwordForm.errors.password}
                        confirmPasswordError={passwordForm.errors.confirmPassword}
                        isLoading={resetPasswordMutation.isPending}
                        onPasswordChange={(val) => passwordForm.handleChange('password', val)}
                        onConfirmPasswordChange={(val) => passwordForm.handleChange('confirmPassword', val)}
                        onSubmit={handleResetPassword}
                    />
                )}

            </div>
        </div>
    );
};
