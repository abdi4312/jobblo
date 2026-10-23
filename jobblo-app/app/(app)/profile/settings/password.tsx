import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { useChangePasswordSendOtp, useChangePasswordVerifyOtp } from '../../../../src/hooks/useChangePassword';
import { TC, tc } from '../../../../src/theme/colors';

type Step = 'form' | 'otp' | 'done';
type Errors = { current?: string; next?: string; confirm?: string };
const inputClass = 'rounded-2xl border border-line bg-surface px-4 py-3 text-[0.9375rem] text-ink';

function PasswordField({ label, value, onChangeText, error, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; error?: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <View className="mb-4"><Text className="mb-1.5 text-[0.8125rem] font-semibold text-ink">{label}</Text><View className="relative"><TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} placeholder={placeholder} autoCapitalize="none" className={[inputClass, 'pr-12'].join(' ')} /><Pressable onPress={() => setVisible((current) => !current)} accessibilityLabel={visible ? 'Skjul passord' : 'Vis passord'} className="absolute right-1 top-1 h-11 w-11 items-center justify-center"><Text>{visible ? <EyeOff size={18} color={tc('#63665F', 'muted')} /> : <Eye size={18} color={tc('#63665F', 'muted')} />}</Text></Pressable></View>{error ? <Text className="mt-1 text-[0.8125rem] text-[#B4544A] dark:text-danger">{error}</Text> : null}</View>;
}

function errorText(error: unknown, fallback: string) {
  const response = (error as { response?: { status?: number; data?: { error?: string; message?: string } } })?.response;
  if (response?.status === 429) return 'For mange forsøk. Vent litt før du prøver igjen.';
  if (response?.status === 401) return 'Økten din er utløpt. Logg inn på nytt.';
  return response?.data?.error || response?.data?.message || fallback;
}

export default function PasswordScreen() {
  const router = useRouter();
  const sendOtp = useChangePasswordSendOtp();
  const verifyOtp = useChangePasswordVerifyOtp();
  const [step, setStep] = useState<Step>('form');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [otpError, setOtpError] = useState('');
  const [remaining, setRemaining] = useState(0);

  useEffect(() => { if (remaining <= 0) return undefined; const timer = setTimeout(() => setRemaining((value) => value - 1), 1000); return () => clearTimeout(timer); }, [remaining]);

  const validate = () => {
    const next: Errors = {};
    if (!currentPassword) next.current = 'Skriv inn nåværende passord';
    if (newPassword.length < 8) next.next = 'Passordet må være minst 8 tegn';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) next.next = 'Må inneholde stor/liten bokstav og tall';
    if (newPassword !== confirmPassword) next.confirm = 'Passordene matcher ikke';
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const send = () => { if (!validate()) return; sendOtp.mutate(currentPassword, { onSuccess: () => { setStep('otp'); setRemaining(60); setOtpError(''); }, onError: (error) => setErrors((current) => ({ ...current, current: errorText(error, 'Nåværende passord er feil') })) }); };
  const verify = () => { if (otp.length !== 6) return setOtpError('Skriv inn alle 6 siffer'); setOtpError(''); verifyOtp.mutate({ otp, newPassword }, { onSuccess: () => setStep('done'), onError: (error) => setOtpError(errorText(error, 'Ugyldig eller utløpt kode.')) }); };
  const resend = () => { if (remaining > 0 || sendOtp.isPending) return; sendOtp.mutate(currentPassword, { onSuccess: () => { setOtp(''); setOtpError(''); setRemaining(60); }, onError: (error) => setOtpError(errorText(error, 'Kunne ikke sende ny kode.')) }); };
  const reset = () => { setStep('form'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setOtp(''); setErrors({}); setOtpError(''); setRemaining(0); };

  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
    <ScreenHeader
      title={step === 'otp' ? 'Bekreft med kode' : 'Endre passord'}
      subtitle={step === 'otp' ? 'Vi sendte en 6-sifret kode til e-posten din.' : step === 'form' ? 'Du vil motta en kode på e-post for å bekrefte endringen.' : undefined}
      icon={step === 'otp' ? ShieldCheck : KeyRound}
      backLabel={step === 'otp' ? 'Tilbake' : 'Innstillinger'}
      onBack={() => step === 'otp' ? reset() : router.back()}
    />
    {step === 'form' ? <View className="rounded-3xl border border-line bg-surface p-5"><PasswordField label="Nåværende passord" value={currentPassword} onChangeText={(value) => { setCurrentPassword(value); setErrors((current) => ({ ...current, current: undefined })); }} error={errors.current} /><PasswordField label="Nytt passord" value={newPassword} onChangeText={(value) => { setNewPassword(value); setErrors((current) => ({ ...current, next: undefined })); }} error={errors.next} placeholder="Minst 8 tegn" /><PasswordField label="Bekreft nytt passord" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirm: undefined })); }} error={errors.confirm} /><Pressable onPress={send} disabled={sendOtp.isPending} className="items-center rounded-xl bg-brand py-3.5 disabled:opacity-50"><Text className="text-sm font-semibold text-white">{sendOtp.isPending ? 'Sender kode...' : 'Fortsett'}</Text></Pressable></View> : null}
    {step === 'otp' ? <View className="rounded-3xl border border-line bg-surface p-5"><TextInput value={otp} onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }} keyboardType="number-pad" maxLength={6} autoFocus className="absolute h-0 w-0 opacity-0" /><Pressable onPress={() => undefined} className="mb-4 flex-row justify-center gap-2">{Array.from({ length: 6 }, (_, index) => <View key={index} className={['h-14 w-11 items-center justify-center rounded-xl border-2', otp[index] ? 'border-brand-text bg-tint' : 'border-line bg-surface'].join(' ')}><Text className="text-xl font-bold text-ink">{otp[index] || ''}</Text></View>)}</Pressable>{otpError ? <Text className="mb-3 text-center text-[0.8125rem] text-[#B4544A] dark:text-danger">{otpError}</Text> : null}<Pressable onPress={verify} disabled={otp.length !== 6 || verifyOtp.isPending} className="items-center rounded-xl bg-brand py-3.5 disabled:opacity-50"><Text className="text-sm font-semibold text-white">{verifyOtp.isPending ? 'Bekrefter...' : 'Bekreft kode'}</Text></Pressable><Pressable onPress={resend} disabled={remaining > 0 || sendOtp.isPending} className="mt-5 items-center"><Text className="text-[0.8125rem] text-muted">{remaining > 0 ? `Send kode på nytt om 0:${String(remaining).padStart(2, '0')}` : sendOtp.isPending ? 'Sender...' : 'Fikk du ikke koden? Send på nytt'}</Text></Pressable></View> : null}
    {step === 'done' ? <View className="items-center rounded-3xl border border-line bg-surface px-5 py-10"><View className="h-16 w-16 items-center justify-center rounded-full bg-tint"><CheckCircle2 size={32} color={TC.brand} /></View><Text className="mt-5 text-lg font-bold text-ink">Passordet er oppdatert!</Text><Text className="mt-2 text-center text-sm leading-5 text-muted">Neste gang du logger inn, bruk det nye passordet ditt.</Text><Pressable onPress={() => router.back()} className="mt-6 rounded-xl bg-brand px-5 py-3"><Text className="text-sm font-semibold text-white">Tilbake til innstillinger</Text></Pressable><Pressable onPress={reset} className="mt-4"><Text className="text-sm font-semibold text-muted">Endre passord igjen</Text></Pressable></View> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
