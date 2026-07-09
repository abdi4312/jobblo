import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '../Ui/Input.tsx';
import { Button } from '../Ui/button/Button';

interface Props {
    password: string;
    confirmPassword: string;
    passwordError?: string;
    confirmPasswordError?: string;
    isLoading: boolean;
    onPasswordChange: (val: string) => void;
    onConfirmPasswordChange: (val: string) => void;
    onSubmit: () => void;
}

export default function ForgotPasswordStepNewPassword({
    password,
    confirmPassword,
    passwordError,
    confirmPasswordError,
    isLoading,
    onPasswordChange,
    onConfirmPasswordChange,
    onSubmit,
}: Props) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    return (
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
                        value={password}
                        placeholder="Minimum 8 tegn"
                        onChange={(e) => onPasswordChange(e.target.value)}
                        error={passwordError}
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
                        value={confirmPassword}
                        placeholder="Gjenta passordet"
                        onChange={(e) => onConfirmPasswordChange(e.target.value)}
                        error={confirmPasswordError}
                        className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
                        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
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
                    onClick={onSubmit}
                    loading={isLoading}
                    className="py-3 rounded-lg font-bold"
                    label="Lagre nytt passord"
                />
            </div>
        </>
    );
}
