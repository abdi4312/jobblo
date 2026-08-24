import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useChangePasswordSendOtp, useChangePasswordVerifyOtp } from '../../../../src/hooks/useChangePassword';

type Step = 'form' | 'otp' | 'done';
type Errors = { current?: string; next?: string; confirm?: string };
const inputClass = 'rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]';

function PasswordField({ label, value, onChangeText, error, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; error?: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <View className="mb-4"><Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">{label}</Text><View className="relative"><TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} placeholder={placeholder} autoCapitalize="none" className={[inputClass, 'pr-12'].join(' ')} /><Pressable onPress={() => setVisible((current) => !current)} accessibilityLabel={visible ? 'Skjul passord' : 'Vis passord'} className="absolute right-1 top-1 h-11 w-11 items-center justify-center"><Text>{visible ? <EyeOff size={18} color="#63665F" /> : <Eye size={18} color="#63665F" />}</Text></Pressable></View>{error ? <Text className="mt-1 text-xs text-[#B4544A]">{error}</Text> : null}</View>;
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

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
    <Pressable onPress={() => step === 'otp' ? reset() : router.back()} className="mb-5 flex-row items-center self-start py-2"><ArrowLeft size={18} color="#63665F" /><Text className="ml-2 text-sm font-medium text-[#63665F]">{step === 'otp' ? 'Tilbake' : 'Innstillinger'}</Text></Pressable>
    {step === 'form' ? <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5"><View className="mb-5 flex-row items-center"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1E9]"><KeyRound size={18} color="#2E6641" /></View><View className="ml-3 flex-1"><Text className="text-lg font-bold text-[#0B0B0B]">Endre passord</Text><Text className="mt-1 text-xs leading-4 text-[#63665F]">Du vil motta en kode på e-post for å bekrefte endringen.</Text></View></View><PasswordField label="Nåværende passord" value={currentPassword} onChangeText={(value) => { setCurrentPassword(value); setErrors((current) => ({ ...current, current: undefined })); }} error={errors.current} /><PasswordField label="Nytt passord" value={newPassword} onChangeText={(value) => { setNewPassword(value); setErrors((current) => ({ ...current, next: undefined })); }} error={errors.next} placeholder="Minst 8 tegn" /><PasswordField label="Bekreft nytt passord" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirm: undefined })); }} error={errors.confirm} /><Pressable onPress={send} disabled={sendOtp.isPending} className="items-center rounded-xl bg-[#2E6641] py-3.5 disabled:opacity-50"><Text className="text-sm font-semibold text-white">{sendOtp.isPending ? 'Sender kode...' : 'Fortsett'}</Text></Pressable></View> : null}
    {step === 'otp' ? <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5"><View className="mb-6 flex-row items-center"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1E9]"><ShieldCheck size={18} color="#2E6641" /></View><View className="ml-3 flex-1"><Text className="text-lg font-bold text-[#0B0B0B]">Bekreft med kode</Text><Text className="mt-1 text-xs leading-4 text-[#63665F]">Vi sendte en 6-sifret kode til e-posten din.</Text></View></View><TextInput value={otp} onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }} keyboardType="number-pad" maxLength={6} autoFocus className="absolute h-0 w-0 opacity-0" /><Pressable onPress={() => undefined} className="mb-4 flex-row justify-center gap-2">{Array.from({ length: 6 }, (_, index) => <View key={index} className={['h-14 w-11 items-center justify-center rounded-xl border-2', otp[index] ? 'border-[#2E6641] bg-[#EAF1E9]' : 'border-[#E6E7E1] bg-white'].join(' ')}><Text className="text-xl font-bold text-[#0B0B0B]">{otp[index] || ''}</Text></View>)}</Pressable>{otpError ? <Text className="mb-3 text-center text-xs text-[#B4544A]">{otpError}</Text> : null}<Pressable onPress={verify} disabled={otp.length !== 6 || verifyOtp.isPending} className="items-center rounded-xl bg-[#2E6641] py-3.5 disabled:opacity-50"><Text className="text-sm font-semibold text-white">{verifyOtp.isPending ? 'Bekrefter...' : 'Bekreft kode'}</Text></Pressable><Pressable onPress={resend} disabled={remaining > 0 || sendOtp.isPending} className="mt-5 items-center"><Text className="text-xs text-[#63665F]">{remaining > 0 ? `Send kode på nytt om 0:${String(remaining).padStart(2, '0')}` : sendOtp.isPending ? 'Sender...' : 'Fikk du ikke koden? Send på nytt'}</Text></Pressable></View> : null}
    {step === 'done' ? <View className="items-center rounded-3xl border border-[#E6E7E1] bg-white px-5 py-10"><View className="h-16 w-16 items-center justify-center rounded-full bg-[#EAF1E9]"><CheckCircle2 size={32} color="#2E6641" /></View><Text className="mt-5 text-lg font-bold text-[#0B0B0B]">Passordet er oppdatert!</Text><Text className="mt-2 text-center text-sm leading-5 text-[#63665F]">Neste gang du logger inn, bruk det nye passordet ditt.</Text><Pressable onPress={() => router.back()} className="mt-6 rounded-xl bg-[#2E6641] px-5 py-3"><Text className="text-sm font-semibold text-white">Tilbake til innstillinger</Text></Pressable><Pressable onPress={reset} className="mt-4"><Text className="text-sm font-semibold text-[#63665F]">Endre passord igjen</Text></Pressable></View> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}