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
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useRegisterMutation } from '@/hooks/useRegisterMutation';
import { useRegistrationStore } from '@/store/registrationStore';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'identity' | 'credentials';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { response?: { data?: { error?: string; message?: string } } };
    const serverMessage = err.response?.data?.error ?? err.response?.data?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }
  }
  return fallback;
}

export default function RegisterScreen() {
  const router = useRouter();
  const registerMutation = useRegisterMutation();
  const { formData, setFormData } = useRegistrationStore();
  const [step, setStep] = useState<Step>('identity');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState('');

  const isCompany = formData.role === 'company';

  const currentErrorText = useMemo(
    () =>
      registerMutation.error
        ? getErrorMessage(registerMutation.error, 'Registreringen mislyktes. Prøv igjen.')
        : serverMessage,
    [registerMutation.error, serverMessage]
  );

  const validateStep = (fields: string[]) => {
    const nextErrors: Record<string, string> = {};

    if (isCompany) {
      if (!formData.companyName?.trim()) nextErrors.companyName = 'Vennligst skriv inn bedriftsnavn';
      if (!/^\d{9}$/.test(formData.orgNumber ?? '')) nextErrors.orgNumber = 'Organisasjonsnummer må være nøyaktig 9 siffer';
    } else {
      if (!formData.name.trim()) nextErrors.name = 'Vennligst skriv inn fornavn';
      if (!formData.lastName.trim()) nextErrors.lastName = 'Vennligst skriv inn etternavn';
    }

    const filtered = Object.fromEntries(
      Object.entries(nextErrors).filter(([key]) => fields.includes(key))
    );

    setErrors(filtered);
    return Object.keys(filtered).length === 0;
  };

  const validateCredentials = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      nextErrors.email = 'Vennligst skriv inn e-post';
    } else if (!emailPattern.test(formData.email.trim())) {
      nextErrors.email = 'Vennligst skriv inn en gyldig e-post';
    }

    if (!formData.password) {
      nextErrors.password = 'Vennligst skriv inn passord';
    } else if (formData.password.length < 8 || !/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      nextErrors.password = 'Passordet må være minst 8 tegn og inneholde stor bokstav, liten bokstav og tall';
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Vennligst bekreft passord';
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passordene matcher ikke';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    const fields = isCompany ? ['companyName', 'orgNumber'] : ['name', 'lastName'];
    if (!validateStep(fields)) return;
    setStep('credentials');
  };

  const handleSubmit = () => {
    if (!validateCredentials()) return;
    setServerMessage('');

    registerMutation.mutate(
      {
        name: formData.name,
        lastName: formData.lastName,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        ...(isCompany && {
          companyName: formData.companyName,
          orgNumber: formData.orgNumber,
        }),
      },
      { onSuccess: () => router.replace('/(app)/' as any) }
    );
  };

  const goBack = () => {
    if (step === 'credentials') {
      setStep('identity');
      setErrors({});
      setServerMessage('');
      return;
    }
    router.back();
  };

  const renderRoleToggle = () => (
    <View className="gap-2">
      <Text className="text-[13px] font-medium text-ink">Jeg er</Text>
      <View className="relative mt-1 flex-row overflow-hidden rounded-xl bg-[#F0F1EB] p-1">
        <Pressable
          onPress={() => setFormData({ role: 'user' })}
          className={`flex-1 items-center justify-center rounded-[10px] py-2.5 ${formData.role === 'user' ? 'bg-white shadow-sm' : ''
            }`}
        >
          <Text className={`text-[14px] font-semibold ${formData.role === 'user' ? 'text-ink' : 'text-muted'}`}>
            Privatperson
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFormData({ role: 'company' })}
          className={`flex-1 items-center justify-center rounded-[10px] py-2.5 ${formData.role === 'company' ? 'bg-white shadow-sm' : ''
            }`}
        >
          <Text className={`text-[14px] font-semibold ${formData.role === 'company' ? 'text-ink' : 'text-muted'}`}>
            Firma
          </Text>
        </Pressable>
      </View>
    </View>
  );

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
                <Pressable onPress={goBack} className="mb-6 flex-row items-center gap-2">
                  <ArrowLeft size={16} color="#63665F" />
                  <Text className="text-[13px] font-medium text-muted">
                    {step === 'credentials' ? 'Tilbake' : 'Tilbake til innlogging'}
                  </Text>
                </Pressable>

                <View className="mb-5 flex-row items-center gap-2">
                  <View className="h-1.5 flex-1 rounded-full bg-brand" />
                  <View
                    className={`h-1.5 flex-1 rounded-full ${step === 'credentials' ? 'bg-brand' : 'bg-line'
                      }`}
                  />
                  <Text className="ml-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9B9E96]">
                    Steg {step === 'identity' ? '1' : '2'} av 2
                  </Text>
                </View>

                <Text className="text-[30px] font-bold leading-tight tracking-[-0.05em] text-ink">
                  {step === 'identity' ? 'Opprett konto' : 'Sikre kontoen din'}
                </Text>
                <Text className="mt-2 text-[15px] leading-6 text-muted">
                  {step === 'identity'
                    ? 'Gratis å opprette. Legg ut oppdrag eller tilby tjenestene dine.'
                    : 'Velg e-posten og passordet du logger inn med.'}
                </Text>

                {step === 'identity' ? (
                  <View className="mt-6 gap-4">
                    {renderRoleToggle()}

                    {isCompany ? (
                      <View className="gap-4">
                        <View className="gap-2">
                          <Text className="text-[13px] font-medium text-ink">Bedriftsnavn</Text>
                          <TextInput
                            value={formData.companyName ?? ''}
                            placeholder="F.eks. Nordmann Bygg AS"
                            placeholderTextColor="#9B9E96"
                            onChangeText={(value) => {
                              setFormData({ companyName: value });
                              setErrors((current) => {
                                const next = { ...current };
                                delete next.companyName;
                                return next;
                              });
                            }}
                            className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${errors.companyName ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                              }`}
                          />
                          {errors.companyName ? (
                            <Text className="text-[12px] text-[#B0453B]">{errors.companyName}</Text>
                          ) : null}
                        </View>

                        <View className="gap-2">
                          <Text className="text-[13px] font-medium text-ink">Organisasjonsnummer</Text>
                          <TextInput
                            value={formData.orgNumber ?? ''}
                            placeholder="9 siffer"
                            keyboardType="numeric"
                            maxLength={9}
                            placeholderTextColor="#9B9E96"
                            onChangeText={(value) => {
                              const digits = value.replace(/\D/g, '').slice(0, 9);
                              setFormData({ orgNumber: digits });
                              setErrors((current) => {
                                const next = { ...current };
                                delete next.orgNumber;
                                return next;
                              });
                            }}
                            className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${errors.orgNumber ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                              }`}
                          />
                          {errors.orgNumber ? (
                            <Text className="text-[12px] text-[#B0453B]">{errors.orgNumber}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row gap-3">
                        <View className="flex-1 gap-2">
                          <Text className="text-[13px] font-medium text-ink">Fornavn</Text>
                          <TextInput
                            value={formData.name}
                            placeholder="Ola"
                            placeholderTextColor="#9B9E96"
                            onChangeText={(value) => {
                              setFormData({ name: value });
                              setErrors((current) => {
                                const next = { ...current };
                                delete next.name;
                                return next;
                              });
                            }}
                            className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${errors.name ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                              }`}
                          />
                          {errors.name ? <Text className="text-[12px] text-[#B0453B]">{errors.name}</Text> : null}
                        </View>

                        <View className="flex-1 gap-2">
                          <Text className="text-[13px] font-medium text-ink">Etternavn</Text>
                          <TextInput
                            value={formData.lastName}
                            placeholder="Nordmann"
                            placeholderTextColor="#9B9E96"
                            onChangeText={(value) => {
                              setFormData({ lastName: value });
                              setErrors((current) => {
                                const next = { ...current };
                                delete next.lastName;
                                return next;
                              });
                            }}
                            className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${errors.lastName ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                              }`}
                          />
                          {errors.lastName ? (
                            <Text className="text-[12px] text-[#B0453B]">{errors.lastName}</Text>
                          ) : null}
                        </View>
                      </View>
                    )}

                    <Pressable
                      onPress={handleContinue}
                      className="mt-2 h-[46px] items-center justify-center rounded-xl bg-brand"
                    >
                      <Text className="text-[15px] font-semibold text-white">Fortsett</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="mt-6 gap-4">
                    {currentErrorText ? (
                      <View className="rounded-xl border border-[#D8B0AB] bg-[#FCF5F4] px-3 py-2.5">
                        <Text className="text-[13px] leading-5 text-[#B0453B]">{currentErrorText}</Text>
                      </View>
                    ) : null}

                    <View className="gap-2">
                      <Text className="text-[13px] font-medium text-ink">E-postadresse</Text>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        value={formData.email}
                        placeholder="deg@eksempel.no"
                        placeholderTextColor="#9B9E96"
                        onChangeText={(value) => {
                          setFormData({ email: value });
                          setErrors((current) => {
                            const next = { ...current };
                            delete next.email;
                            return next;
                          });
                          setServerMessage('');
                        }}
                        className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 text-[15px] text-ink ${errors.email ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                          }`}
                      />
                      {errors.email ? <Text className="text-[12px] text-[#B0453B]">{errors.email}</Text> : null}
                    </View>

                    <View className="gap-2">
                      <Text className="text-[13px] font-medium text-ink">Passord</Text>
                      <View className="relative">
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry={!showPassword}
                          value={formData.password}
                          placeholder="Velg et passord"
                          placeholderTextColor="#9B9E96"
                          onChangeText={(value) => {
                            setFormData({ password: value });
                            setErrors((current) => {
                              const next = { ...current };
                              delete next.password;
                              return next;
                            });
                          }}
                          className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 pr-12 text-[15px] text-ink ${errors.password ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
                            }`}
                        />
                        <Pressable
                          onPress={() => setShowPassword((current) => !current)}
                          className="absolute right-3 top-0 h-[46px] items-center justify-center"
                        >
                          {showPassword ? <EyeOff size={18} color="#63665F" /> : <Eye size={18} color="#63665F" />}
                        </Pressable>
                      </View>
                      {errors.password ? (
                        <Text className="text-[12px] text-[#B0453B]">{errors.password}</Text>
                      ) : null}
                    </View>

                    <View className="gap-2">
                      <Text className="text-[13px] font-medium text-ink">Bekreft passord</Text>
                      <View className="relative">
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry={!showConfirmPassword}
                          value={formData.confirmPassword}
                          placeholder="Skriv passordet på nytt"
                          placeholderTextColor="#9B9E96"
                          onChangeText={(value) => {
                            setFormData({ confirmPassword: value });
                            setErrors((current) => {
                              const next = { ...current };
                              delete next.confirmPassword;
                              return next;
                            });
                          }}
                          className={`h-[46px] rounded-xl border bg-[#F5F6F1] px-3.5 pr-12 text-[15px] text-ink ${errors.confirmPassword ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'
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
                      {errors.confirmPassword ? (
                        <Text className="text-[12px] text-[#B0453B]">{errors.confirmPassword}</Text>
                      ) : null}
                    </View>

                    <View className="rounded-xl border border-line bg-[#F5F6F1] p-3">
                      <Text className="mb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9B9E96]">
                        Passordkrav
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <ShieldCheck size={14} color={formData.password.length >= 8 ? '#2E6641' : '#9B9E96'} />
                        <Text className="text-[12px] text-muted">Minst 8 tegn</Text>
                      </View>
                      <View className="mt-2 flex-row items-center gap-2">
                        <ShieldCheck size={14} color={/[A-Z]/.test(formData.password) && /[a-z]/.test(formData.password) ? '#2E6641' : '#9B9E96'} />
                        <Text className="text-[12px] text-muted">Stor og liten bokstav</Text>
                      </View>
                      <View className="mt-2 flex-row items-center gap-2">
                        <ShieldCheck size={14} color={/[0-9]/.test(formData.password) ? '#2E6641' : '#9B9E96'} />
                        <Text className="text-[12px] text-muted">Minst ett tall</Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={handleSubmit}
                      disabled={registerMutation.isPending}
                      className={`mt-2 h-[46px] flex-row items-center justify-center rounded-xl bg-brand ${registerMutation.isPending ? 'opacity-80' : ''
                        }`}
                    >
                      {registerMutation.isPending ? (
                        <Loader2 size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                      ) : null}
                      <Text className="text-[15px] font-semibold text-white">
                        {registerMutation.isPending ? 'Oppretter konto…' : 'Opprett konto'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                <Pressable onPress={() => router.push('/(auth)/login' as any)} className="mt-6 flex-row justify-center">
                  <Text className="text-[14px] text-muted">Har du allerede konto? </Text>
                  <Text className="text-[14px] font-semibold text-brand">Logg inn</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
