import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, Plus, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../src/hooks/useProfile';
import { useAuthStore } from '../../../src/store/authStore';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { Card, SectionLabel } from '../../../src/components/ui/Card';
import { FormRow } from '../../../src/components/ui/FormRow';
import type { CurrentProfile, ProfileUpdate } from '../../../src/services/profile.service';

const BIO_LIMIT = 600;
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

  if (isLoading || !draft) return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]"><LoadingIndicator message="Laster redigering..." /></SafeAreaView>;
  if (isError || !profile) return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste profilen" onAction={() => void refetch()} /></SafeAreaView>;

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

  const isCompany = profile.role === 'company';
  const avatarUri = image?.uri || profile.avatarUrl;
  const canSave = dirty && !validation && !update.isPending;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      {/* Top bar: Avbryt · title · Lagre (keeps Save reachable above the keyboard). */}
      <View className="h-14 flex-row items-center justify-between border-b border-[#E6E7E1] bg-[#EFF0EA] px-2">
        <Pressable onPress={leave} hitSlop={8} accessibilityRole="button" className="min-w-[72px] px-2 py-2">
          <Text className="text-[1rem] text-[#3C3F38]">Avbryt</Text>
        </Pressable>
        <Text className="text-[1.0625rem] font-semibold text-[#0B0B0B]">Rediger profil</Text>
        <Pressable
          onPress={save}
          disabled={!canSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          className="min-w-[72px] items-end px-2 py-2"
        >
          {update.isPending ? (
            <ActivityIndicator size="small" color="#2E6641" />
          ) : (
            <Text className={`text-[1rem] font-semibold ${canSave ? 'text-[#2E6641]' : 'text-[#B5B8B0]'}`}>Lagre</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Photo */}
          <View className="mb-6 mt-2 items-center">
            <Pressable onPress={() => void chooseImage()} disabled={update.isPending} accessibilityRole="button" accessibilityLabel="Endre profilbilde">
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#DCEBDD]">
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ width: 96, height: 96 }} />
                ) : (
                  <Text className="text-[2rem] font-semibold text-[#2E6641]">{text(profile.name).slice(0, 1).toUpperCase() || '?'}</Text>
                )}
              </View>
              <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-[#EFF0EA] bg-[#2E6641]">
                <Camera size={15} color="#FFFFFF" />
              </View>
            </Pressable>
            <Pressable onPress={() => void chooseImage()} hitSlop={6} className="mt-3">
              <Text className="text-[0.9375rem] font-semibold text-[#2E6641]">
                {image ? 'Nytt bilde valgt' : 'Endre profilbilde'}
              </Text>
            </Pressable>
          </View>

          <SectionLabel>{isCompany ? 'Bedrift' : 'Navn'}</SectionLabel>
          <Card className="mb-6 overflow-hidden">
            <FormRow
              label="Fornavn"
              value={draft.name}
              onChangeText={(value) => set('name', value)}
              placeholder="Fornavn"
              autoComplete="given-name"
              error={!draft.name.trim() ? 'Fornavn er påkrevd.' : undefined}
            />
            <FormRow
              divider
              label="Etternavn"
              value={draft.lastName}
              onChangeText={(value) => set('lastName', value)}
              placeholder="Etternavn"
              autoComplete="family-name"
            />
            {isCompany ? (
              <>
                <FormRow divider label="Firmanavn" value={draft.companyName} onChangeText={(value) => set('companyName', value)} />
                <FormRow
                  divider
                  label="Organisasjonsnummer"
                  value={draft.orgNumber}
                  onChangeText={(value) => set('orgNumber', value.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={9}
                  placeholder="9 siffer"
                />
                <FormRow
                  divider
                  label="Nettside"
                  value={draft.website}
                  onChangeText={(value) => set('website', value)}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://"
                />
              </>
            ) : null}
          </Card>

          <SectionLabel>Om meg</SectionLabel>
          <Card className="mb-6 overflow-hidden">
            <FormRow
              label="Beskrivelse"
              value={draft.bio}
              onChangeText={(value) => set('bio', value)}
              multiline
              maxLength={BIO_LIMIT}
              showCount
              placeholder="Fortell kort hvem du er og hva du er god på."
            />
          </Card>

          <SectionLabel>Ferdigheter</SectionLabel>
          <Card className="mb-6 overflow-hidden">
            {draft.skills.length ? (
              <View className="flex-row flex-wrap gap-2 px-4 pt-4">
                {draft.skills.map((skill) => (
                  <View key={skill} className="flex-row items-center rounded-full bg-[#EAF1E9] py-1 pl-3 pr-1">
                    <Text className="text-[0.8125rem] font-medium text-[#2E6641]">{skill}</Text>
                    <Pressable onPress={() => removeSkill(skill)} accessibilityLabel={`Fjern ${skill}`} hitSlop={6} className="ml-1 rounded-full p-1">
                      <X size={13} color="#2E6641" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="flex-row items-center gap-3 px-4 py-3">
              <TextInput
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                placeholder={draft.skills.length ? 'Legg til en ferdighet til' : 'F.eks. Maling, Flytting, Rengjøring'}
                placeholderTextColor="#B5B8B0"
                returnKeyType="done"
                accessibilityLabel="Ny ferdighet"
                style={{ paddingVertical: 6, paddingHorizontal: 0 }}
                className="flex-1 text-[1rem] text-[#0B0B0B]"
              />
              <Pressable
                onPress={addSkill}
                disabled={!skillInput.trim()}
                accessibilityRole="button"
                accessibilityLabel="Legg til ferdighet"
                className={`h-9 w-9 items-center justify-center rounded-full ${skillInput.trim() ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'}`}
              >
                <Plus size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          </Card>

          <SectionLabel>Sted og tilgjengelighet</SectionLabel>
          <Card className="overflow-hidden">
            <FormRow label="Adresse" value={draft.address} onChangeText={(value) => set('address', value)} placeholder="Gateadresse" autoComplete="street-address" />
            <FormRow
              divider
              label="Postnummer"
              value={draft.postNumber}
              onChangeText={(value) => set('postNumber', value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
            />
            <FormRow divider label="Poststed" value={draft.postSted} onChangeText={(value) => set('postSted', value)} placeholder="F.eks. Oslo" />
            <FormRow
              divider
              label="Tilgjengelighet"
              value={draft.availabilityText}
              onChangeText={(value) => set('availabilityText', value)}
              placeholder="F.eks. kvelder og helger"
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
