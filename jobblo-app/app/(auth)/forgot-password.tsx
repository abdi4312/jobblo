import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { forgotPassword, resetPassword, verifyOtp } from '@/services/auth.service';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'otp' | 'newPassword';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const sendOtpMutation = useMutation({
    mutationFn: (requestEmail: string) => forgotPassword(requestEmail),
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      setServerError(err.response?.data?.error ?? err.response?.data?.message ?? 'Kunne ikke sende koden. Prøv igjen.');
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ targetEmail, targetOtp }: { targetEmail: string; targetOtp: string }) =>
      verifyOtp(targetEmail, targetOtp),
    onError: () => {
      setOtpError('Ugyldig eller utløpt kode. Prøv igjen.');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ token, nextPassword }: { token: string; nextPassword: string }) =>
      resetPassword(token, nextPassword),
    onSuccess: () => {
      router.replace('/(auth)/login' as any);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      setPasswordError(err.response?.data?.error ?? err.response?.data?.message ?? 'Noe gikk galt. Start på nytt.');
    },
  });

  const emailValid = useMemo(() => emailPattern.test(email.trim()), [email]);

  const handleSendOtp = () => {
    if (!email.trim()) {
      setEmailError('Vennligst skriv inn e-post');
      return;
    }
    if (!emailValid) {
      setEmailError('Vennligst skriv inn en gyldig e-post');
      return;
    }
    setEmailError('');
    setServerError('');
    sendOtpMutation.mutate(email.trim().toLowerCase(), {
      onSuccess: () => {
        setStep('otp');
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
      { targetEmail: email.trim().toLowerCase(), targetOtp: otp },
      {
        onSuccess: (data) => {
          setResetToken(data.resetToken);
          setStep('newPassword');
        },
      }
    );
  };

  const handleResetPassword = () => {
    if (!password) {
      setPasswordError('Vennligst skriv inn nytt passord');
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError('Passordet må være minst 8 tegn og inneholde stor bokstav, liten bokstav og tall');
      return;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Vennligst bekreft passordet');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passordene matcher ikke');
      return;
    }

    setPasswordError('');
    setConfirmPasswordError('');
    resetPasswordMutation.mutate({ token: resetToken, nextPassword: password });
  };

  return (
    <SafeAreaView className="flex-1 bg-page">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 items-center justify-center px-5 py-6">
            <View className="w-full rounded-[28px] bg-surface shadow-sm">
              <View className="px-5 pb-7 pt-6">
                {step !== 'email' ? (
                  <Pressable
                    onPress={() => {
                      if (step === 'otp') setStep('email');
                      if (step === 'newPassword') setStep('otp');
                    }}
                    className="mb-6 flex-row items-center gap-2"
                  >
                    <ArrowLeft size={16} color="#63665F" />
                    <Text className="text-[13px] font-medium text-muted">Tilbake</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => router.back()} className="mb-6 flex-row items-center gap-2">
                    <ArrowLeft size={16} color="#63665F" />
                    <Text className="text-[13px] font-medium text-muted">Tilbake til innlogging</Text>
                  </Pressable>
                )}

                {step === 'email' ? (
                  <>
                    <View className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-[#F0F1EB]">
                      <Mail size={22} color="#0B0B0B" />
                    </View>
                    <Text className="text-[30px] font-bold leading-tight tracking-[-0.05em] text-ink">
                      Glemt passordet?
                    </Text>
                    <Text className="mt-2 text-[15px] leading-6 text-muted">
                      Skriv inn e-postadressen din. Vi sender deg en 6-sifret kode.
                    </Text>

                    <View className="mt-6 gap-4">
                      {serverError ? (
                        <View className="rounded-xl border border-[#D8B0AB] bg-[#FCF5F4] px-3 py-2.5">
                          <Text className="text-[13px] leading-5 text-[#B0453B]">{serverError}</Text>
                        </View>
                      ) : null}

                      <View className="gap-2">
                        <Text className="text-[13px] font-medium text-ink">E-postadresse</Text>
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          value={email}
                          placeholder="deg@eksempel.no"
                          placeholderTextColor="#9B9E96"
                          onChangeText={(value) => {
                            setEmail(value);
                            setEmailError('');
                            setServerError('');
                          }}
                          className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${
                            emailError ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                          }`}
                        />
                        {emailError ? <Text className="text-[12px] text-[#B0453B]">{emailError}</Text> : null}
                      </View>

                      <Pressable
                        onPress={handleSendOtp}
                        disabled={sendOtpMutation.isPending}
                        className={`mt-2 h-[46px] flex-row items-center justify-center rounded-xl bg-brand ${
                          sendOtpMutation.isPending ? 'opacity-80' : ''
                        }`}
                      >
                        {sendOtpMutation.isPending ? (
                          <Loader2 size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                        ) : null}
                        <Text className="text-[15px] font-semibold text-white">
                          {sendOtpMutation.isPending ? 'Sender kode…' : 'Send kode'}
                        </Text>
                      </Pressable>
                    </View>

                    <View className="mt-6 flex-row justify-center">
                      <Text className="text-[14px] text-muted">Husker du passordet? </Text>
                      <Pressable onPress={() => router.push('/(auth)/login' as any)}>
                        <Text className="text-[14px] font-semibold text-brand">Logg inn</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {step === 'otp' ? (
                  <>
                    <View className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-[#F0F1EB]">
                      <ShieldCheck size={22} color="#0B0B0B" />
                    </View>
                    <Text className="text-[30px] font-bold leading-tight tracking-[-0.05em] text-ink">
                      Sjekk e-posten din
                    </Text>
                    <Text className="mt-2 text-[15px] leading-6 text-muted">
                      Vi sendte en 6-sifret kode til <Text className="font-semibold text-ink">{email}</Text>
                    </Text>

                    <View className="mt-6 gap-4">
                      <View className="flex-row justify-between gap-2">
                        {Array.from({ length: 6 }).map((_, index) => {
                          const digit = otp[index] ?? '';
                          return (
                            <TextInput
                              key={index}
                              value={digit}
                              maxLength={1}
                              keyboardType="number-pad"
                              onChangeText={(value) => {
                                const next = otp.slice(0, index) + value.replace(/\D/g, '').slice(-1) + otp.slice(index + 1);
                                const filtered = next.replace(/\D/g, '').slice(0, 6);
                                setOtp(filtered);
                                setOtpError('');
                              }}
                              className="h-[52px] flex-1 rounded-xl border bg-[#F5F6F1] text-center text-[18px] font-semibold text-ink ${otpError ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'}"
                            />
                          );
                        })}
                      </View>

                      {otpError ? <Text className="text-[12px] text-[#B0453B]">{otpError}</Text> : null}

                      <Pressable
                        onPress={handleVerifyOtp}
                        disabled={verifyOtpMutation.isPending || otp.length < 6}
                        className={`h-[46px] items-center justify-center rounded-xl bg-brand ${
                          verifyOtpMutation.isPending || otp.length < 6 ? 'opacity-80' : ''
                        }`}
                      >
                        {verifyOtpMutation.isPending ? (
                          <Loader2 size={16} color="#FFFFFF" />
                        ) : (
                          <Text className="text-[15px] font-semibold text-white">Bekreft kode</Text>
                        )}
                      </Pressable>

                      <Pressable onPress={() => handleSendOtp()} className="items-center">
                        <Text className="text-[14px] font-medium text-brand">Send ny kode</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {step === 'newPassword' ? (
                  <>
                    <View className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-[#F0F1EB]">
                      <ShieldCheck size={22} color="#0B0B0B" />
                    </View>
                    <Text className="text-[30px] font-bold leading-tight tracking-[-0.05em] text-ink">
                      Nytt passord
                    </Text>
                    <Text className="mt-2 text-[15px] leading-6 text-muted">
                      Velg et sterkt passord med minst 8 tegn.
                    </Text>

                    <View className="mt-6 gap-4">
                      <View className="gap-2">
                        <Text className="text-[13px] font-medium text-ink">Nytt passord</Text>
                        <View className="relative">
                          <TextInput
                            secureTextEntry={!showPassword}
                            value={password}
                            placeholder="Minimum 8 tegn"
                            placeholderTextColor="#9B9E96"
                            onChangeText={(value) => {
                              setPassword(value);
                              setPasswordError('');
                            }}
                            className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 pr-12 text-[15px] text-ink ${
                              passwordError ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                            }`}
                          />
                          <Pressable
                            onPress={() => setShowPassword((current) => !current)}
                            className="absolute right-3 top-0 h-[46px] items-center justify-center"
                          >
                            {showPassword ? <EyeOff size={18} color="#63665F" /> : <Eye size={18} color="#63665F" />}
                          </Pressable>
                        </View>
                        {passwordError ? <Text className="text-[12px] text-[#B0453B]">{passwordError}</Text> : null}
                      </View>

                      <View className="gap-2">
                        <Text className="text-[13px] font-medium text-ink">Bekreft passord</Text>
                        <View className="relative">
                          <TextInput
                            secureTextEntry={!showConfirmPassword}
                            value={confirmPassword}
                            placeholder="Gjenta passordet"
                            placeholderTextColor="#9B9E96"
                            onChangeText={(value) => {
                              setConfirmPassword(value);
                              setConfirmPasswordError('');
                            }}
                            className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 pr-12 text-[15px] text-ink ${
                              confirmPasswordError ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                            }`}
                          />
                          <Pressable
                            onPress={() => setShowConfirmPassword((current) => !current)}
                            className="absolute right-3 top-0 h-[46px] items-center justify-center"
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={18} color="#63665F" />
                            ) : (
                              <Eye size={18} color="#63665F" />
                            )}
                          </Pressable>
                        </View>
                        {confirmPasswordError ? (
                          <Text className="text-[12px] text-[#B0453B]">{confirmPasswordError}</Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={handleResetPassword}
                        disabled={resetPasswordMutation.isPending}
                        className={`h-[46px] items-center justify-center rounded-xl bg-brand ${
                          resetPasswordMutation.isPending ? 'opacity-80' : ''
                        }`}
                      >
                        {resetPasswordMutation.isPending ? (
                          <Loader2 size={16} color="#FFFFFF" />
                        ) : (
                          <Text className="text-[15px] font-semibold text-white">Lagre nytt passord</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
