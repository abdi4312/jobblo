import React, { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, ChevronLeft, Loader2, Plus, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../src/hooks/useProfile';
import { useAuthStore } from '../../../src/store/authStore';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import type { CurrentProfile, ProfileUpdate } from '../../../src/services/profile.service';

const BIO_LIMIT = 600;
const FIELD = 'rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]';
type Draft = { name: string; lastName: string; bio: string; skills: string[]; availabilityText: string; address: string; postNumber: string; postSted: string; companyName: string; orgNumber: string; website: string };
type ImageAsset = { uri: string; name: string; type: string };

const text = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { city?: unknown }).city === 'string') return (value as { city: string }).city;
  return '';
};
const draftFrom = (profile: CurrentProfile): Draft => ({
  name: text(profile.name), lastName: text(profile.lastName), bio: text(profile.bio), skills: Array.isArray(profile.skills) ? [...profile.skills] : [],
  availabilityText: text(profile.availabilityText), address: text(profile.address), postNumber: text(profile.postNumber), postSted: text(profile.postSted),
  companyName: text(profile.companyName), orgNumber: text(profile.orgNumber), website: text(profile.website),
});
const sameDraft = (first: Draft, second: Draft) => JSON.stringify(first) === JSON.stringify(second);

function Field({ label, value, onChangeText, multiline = false, maxLength, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; maxLength?: number; keyboardType?: 'default' | 'numeric' }) {
  return <View><Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} maxLength={maxLength} keyboardType={keyboardType} className={[FIELD, multiline ? 'min-h-[128px] text-top' : ''].join(' ')} textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}

function errorMessage(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
  if (response?.status === 413) return 'Bildet er for stort. Velg et bilde under 8 MB.';
  if (response?.status === 403) return 'Du har ikke tilgang til å endre denne profilen.';
  if (response?.status === 400) return response.data?.error || 'Kontroller feltene og prøv igjen.';
  return 'Kunne ikke lagre profilen. Sjekk internettforbindelsen og prøv igjen.';
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();
  const userId = useAuthStore((state) => typeof state.user?._id === 'string' ? state.user._id : undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<Draft | null>(null);
  const [skillInput, setSkillInput] = useState('');
  const [image, setImage] = useState<ImageAsset | null>(null);

  useEffect(() => {
    if (profile && !draft) { const next = draftFrom(profile); setDraft(next); setOriginal(next); }
  }, [profile, draft]);

  const dirty = !!draft && !!original && (!sameDraft(draft, original) || !!image);
  const validation = useMemo(() => {
    if (!draft) return 'Profilen lastes inn.';
    if (!draft.name.trim()) return 'Fornavn er påkrevd.';
    if (draft.bio.length > BIO_LIMIT) return `Om meg kan ikke være lengre enn ${BIO_LIMIT} tegn.`;
    return '';
  }, [draft]);

  if (isLoading || !draft) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster redigering..." /></SafeAreaView>;
  if (isError || !profile) return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste profilen" onAction={() => void refetch()} /></SafeAreaView>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const addSkill = () => { const skill = skillInput.trim(); if (!skill || draft.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) return setSkillInput(''); set('skills', [...draft.skills, skill]); setSkillInput(''); };
  const removeSkill = (skill: string) => set('skills', draft.skills.filter((item) => item !== skill));
  const chooseImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled) { const asset = result.assets[0]; setImage({ uri: asset.uri, name: asset.fileName ?? `profil-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' }); }
  };
  const leave = () => {
    if (!dirty) return router.back();
    Alert.alert('Forkast endringer?', 'Endringene dine blir ikke lagret.', [{ text: 'Fortsett å redigere', style: 'cancel' }, { text: 'Forkast', style: 'destructive', onPress: () => router.back() }]);
  };
  const save = () => {
    if (!userId || !original || !dirty || validation) return;
    const changed: ProfileUpdate = {};
    (Object.keys(draft) as (keyof Draft)[]).forEach((key) => { if (JSON.stringify(draft[key]) !== JSON.stringify(original[key])) Object.assign(changed, { [key]: draft[key] }); });
    let payload: ProfileUpdate | FormData = changed;
    if (image) { const form = new FormData(); Object.entries(changed).forEach(([key, value]) => form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value))); form.append('avatar', image as unknown as Blob); payload = form; }
    update.mutate({ userId, data: payload }, { onSuccess: () => { Alert.alert('Profilen er lagret', 'Endringene dine er oppdatert.'); router.back(); }, onError: (error) => Alert.alert('Kunne ikke lagre', errorMessage(error)) });
  };

  return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3"><Pressable onPress={leave} accessibilityLabel="Tilbake" className="h-10 w-10 items-center justify-center rounded-full"><ChevronLeft size={22} color="#0B0B0B" /></Pressable><Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Rediger profil</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
      <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-base font-semibold text-[#0B0B0B]">Profilbilde</Text><View className="mt-4 flex-row items-center gap-4"><View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">{image || profile.avatarUrl ? <Image source={{ uri: image?.uri || profile.avatarUrl }} className="h-full w-full" /> : <Text className="text-xl font-semibold text-[#2E6641]">{text(profile.name).slice(0, 1).toUpperCase()}</Text>}</View><Pressable onPress={() => void chooseImage()} disabled={update.isPending} className="flex-row items-center rounded-xl border border-[#E6E7E1] px-4 py-3"><Camera size={16} color="#2E6641" /><Text className="ml-2 text-sm font-semibold text-[#0B0B0B]">Bytt bilde</Text></Pressable></View><Text className="mt-2 text-xs text-[#63665F]">JPG, PNG eller WEBP, opptil 8 MB.</Text></View>
      <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="mb-4 text-base font-semibold text-[#0B0B0B]">Identitet</Text><Field label="Fornavn" value={draft.name} onChangeText={(value) => set('name', value)} /><Text className="mt-1 text-xs text-[#B4544A]">{!draft.name.trim() ? 'Fornavn er påkrevd.' : ''}</Text><View className="mt-4"><Field label="Etternavn" value={draft.lastName} onChangeText={(value) => set('lastName', value)} /></View>{profile.role === 'company' ? <><View className="mt-4"><Field label="Firmanavn" value={draft.companyName} onChangeText={(value) => set('companyName', value)} /></View><View className="mt-4"><Field label="Org.nr" value={draft.orgNumber} onChangeText={(value) => set('orgNumber', value)} keyboardType="numeric" /></View><View className="mt-4"><Field label="Nettside" value={draft.website} onChangeText={(value) => set('website', value)} /></View></> : null}</View>
      <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="mb-4 text-base font-semibold text-[#0B0B0B]">Om meg</Text><Field label="Profilbeskrivelse" value={draft.bio} onChangeText={(value) => set('bio', value)} multiline maxLength={BIO_LIMIT} /><Text className="mt-1 text-right text-xs text-[#63665F]">{draft.bio.length} / {BIO_LIMIT}</Text></View>
      <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="text-base font-semibold text-[#0B0B0B]">Ferdigheter</Text><View className="mt-3 flex-row flex-wrap gap-2">{draft.skills.map((skill) => <View key={skill} className="flex-row items-center rounded-full bg-[#EAF1E9] pl-3 pr-1"><Text className="py-2 text-xs font-medium text-[#2E6641]">{skill}</Text><Pressable onPress={() => removeSkill(skill)} accessibilityLabel={`Fjern ${skill}`} className="p-2"><X size={13} color="#2E6641" /></Pressable></View>)}</View><View className="mt-3 flex-row items-center"><TextInput value={skillInput} onChangeText={setSkillInput} onSubmitEditing={addSkill} placeholder="Legg til ferdighet" className={[FIELD, 'flex-1'].join(' ')} returnKeyType="done" /><Pressable onPress={addSkill} disabled={!skillInput.trim()} className="ml-2 h-12 w-12 items-center justify-center rounded-2xl bg-[#2E6641] disabled:opacity-40"><Plus size={18} color="#FFFFFF" /></Pressable></View></View>
      <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5"><Text className="mb-4 text-base font-semibold text-[#0B0B0B]">Sted og tilgjengelighet</Text><Field label="Adresse" value={draft.address} onChangeText={(value) => set('address', value)} /><View className="mt-4"><Field label="Postnr." value={draft.postNumber} onChangeText={(value) => set('postNumber', value)} keyboardType="numeric" /></View><View className="mt-4"><Field label="Poststed" value={draft.postSted} onChangeText={(value) => set('postSted', value)} /></View><View className="mt-4"><Field label="Tilgjengelighet" value={draft.availabilityText} onChangeText={(value) => set('availabilityText', value)} /></View></View>
    </ScrollView>
    <View className="flex-row gap-3 border-t border-[#E6E7E1] bg-white px-4 py-3"><Pressable onPress={leave} className="flex-1 items-center justify-center rounded-full border border-[#E6E7E1] py-3"><Text className="text-sm font-semibold text-[#0B0B0B]">Avbryt</Text></Pressable><Pressable onPress={save} disabled={!dirty || !!validation || update.isPending} className="flex-1 flex-row items-center justify-center rounded-full bg-[#2E6641] py-3 disabled:opacity-50">{update.isPending ? <Loader2 size={16} color="#FFFFFF" /> : null}<Text className="ml-2 text-sm font-semibold text-white">{update.isPending ? 'Lagrer...' : 'Lagre'}</Text></Pressable></View>
  </KeyboardAvoidingView></SafeAreaView>;
}