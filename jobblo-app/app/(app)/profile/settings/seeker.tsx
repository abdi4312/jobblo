/**
 * Jobbsøker-profil settings screen.
 *
 * Route: /profile/settings/seeker
 *
 * Sections (matching web SeekerSettingsView order):
 *   1. Tilgjengelighet (availabilityText) ─┐
 *   2. Ferdigheter    (skills)             ├── saved together via PUT /api/users/:id
 *      [Lagre endringer]                  ─┘
 *   3. Erfaring       — POST/DELETE /api/users/experience
 *   4. Portfolio      — POST/DELETE /api/users/portfolio        (multipart, field: image)
 *   5. Tidligere prosjekter — POST/DELETE /api/users/previous-projects (multipart, field: image)
 *   6. Sertifiseringer — POST/DELETE /api/users/certifications  (multipart, field: file)
 *
 * All mutations invalidate queryKeys.auth.profile.
 * No direct Axios/fetch in this file — everything goes through hooks.
 */
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
    Award,
    Briefcase,
    ChevronLeft,
    FileText,
    Image as ImageIcon,
    Plus,
    Trash2,
    X,
    type LucideIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { Button } from '../../../../src/components/ui/Button';
import { Dialog } from '../../../../src/components/ui/Dialog';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { FormRow } from '../../../../src/components/ui/FormRow';
import {
    useAddExperience,
    useDeleteExperience,
    useAddPortfolioItem,
    useDeletePortfolioItem,
    useAddPreviousProject,
    useDeletePreviousProject,
    useAddCertification,
    useDeleteCertification,
    type ExperienceInput,
} from '../../../../src/hooks/useSeeker';
import { TC, tc } from '../../../../src/theme/colors';

// ─── Max file size: must match backend (8 MB) ────────────────────────────────
const MAX_BYTES = 8 * 1024 * 1024;

// Norwegian locale date display — YYYY-MM-DD → "12. jan. 2023"
function fmtDate(iso: string | undefined): string {
    if (!iso) return 'Nåværende';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SeekerScreen() {
    const router = useRouter();
    const { data: profile, isLoading, isError, refetch } = useProfile();
    const updateProfile = useUpdateProfile();
    const userId = useAuthStore((s) => s.user?._id);

    // ── Base fields (availabilityText + skills) ──────────────────────────────
    const [availability, setAvailability] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState('');

    // Sync from server profile (once loaded)
    const [synced, setSynced] = useState(false);
    if (profile && !synced) {
        setAvailability(profile.availabilityText ?? '');
        setSkills((profile.skills as string[] | undefined) ?? []);
        setSynced(true);
    }

    const baseUnchanged =
        availability === (profile?.availabilityText ?? '') &&
        JSON.stringify(skills) === JSON.stringify((profile?.skills as string[] | undefined) ?? []);

    const saveBase = () => {
        if (!userId) {
            Alert.alert('Feil', 'Bruker-ID mangler. Prøv å logge inn på nytt.');
            return;
        }
        updateProfile.mutate(
            { userId: userId as string, data: { availabilityText: availability, skills } },
            {
                onSuccess: () => setSynced(false), // re-sync on next render
                onError: () =>
                    Alert.alert('Feil', 'Kunne ikke lagre endringene. Prøv igjen.'),
            }
        );
    };

    const addSkill = () => {
        const s = skillInput.trim();
        if (!s) return;
        if (skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
            setSkillInput('');
            return;
        }
        setSkills((prev) => [...prev, s]);
        setSkillInput('');
    };

    // ── Experience ────────────────────────────────────────────────────────────
    const addExp = useAddExperience();
    const delExp = useDeleteExperience();
    const [expDialogOpen, setExpDialogOpen] = useState(false);
    const [expForm, setExpForm] = useState<ExperienceInput>({
        title: '',
        company: '',
        startDate: '',
        endDate: '',
        description: '',
    });

    const submitExperience = () => {
        if (!expForm.title.trim()) return;
        addExp.mutate(
            { ...expForm, endDate: expForm.endDate?.trim() || undefined },
            {
                onSuccess: () => {
                    setExpDialogOpen(false);
                    setExpForm({ title: '', company: '', startDate: '', endDate: '', description: '' });
                },
                onError: () => Alert.alert('Feil', 'Kunne ikke lagre erfaring. Prøv igjen.'),
            }
        );
    };

    const confirmDeleteExp = (expId: string) =>
        Alert.alert('Slett erfaring', 'Er du sikker på at du vil slette denne erfaringen?', [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Slett',
                style: 'destructive',
                onPress: () =>
                    delExp.mutate(expId, {
                        onError: () => Alert.alert('Feil', 'Kunne ikke slette. Prøv igjen.'),
                    }),
            },
        ]);

    // ── Portfolio ─────────────────────────────────────────────────────────────
    const addPort = useAddPortfolioItem();
    const delPort = useDeletePortfolioItem();
    const [portDialogOpen, setPortDialogOpen] = useState(false);
    const [portForm, setPortForm] = useState({ title: '', description: '', link: '' });
    const [portImageUri, setPortImageUri] = useState<string | null>(null);
    const [portImageName, setPortImageName] = useState<string | null>(null);
    const [portImageType, setPortImageType] = useState<string | null>(null);

    const pickPortImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (res.canceled) return;
        const asset = res.assets[0];
        if (!asset) return;
        const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        setPortImageUri(asset.uri);
        setPortImageName(asset.fileName ?? `portfolio.${ext}`);
        setPortImageType(mime);
    };

    const submitPortfolio = () => {
        if (!portForm.title.trim()) return;
        const fd = new FormData();
        fd.append('title', portForm.title.trim());
        fd.append('description', portForm.description.trim());
        fd.append('link', portForm.link.trim());
        if (portImageUri && portImageName && portImageType) {
            // React Native FormData accepts { uri, name, type }
            fd.append('image', { uri: portImageUri, name: portImageName, type: portImageType } as any);
        }
        addPort.mutate(fd, {
            onSuccess: () => {
                setPortDialogOpen(false);
                setPortForm({ title: '', description: '', link: '' });
                setPortImageUri(null);
                setPortImageName(null);
                setPortImageType(null);
            },
            onError: () => Alert.alert('Feil', 'Kunne ikke lagre portfolio-element. Prøv igjen.'),
        });
    };

    const confirmDeletePort = (itemId: string) =>
        Alert.alert('Slett portfolio-element', 'Er du sikker?', [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Slett',
                style: 'destructive',
                onPress: () =>
                    delPort.mutate(itemId, {
                        onError: () => Alert.alert('Feil', 'Kunne ikke slette. Prøv igjen.'),
                    }),
            },
        ]);

    // ── Previous Projects ─────────────────────────────────────────────────────
    const addProj = useAddPreviousProject();
    const delProj = useDeletePreviousProject();
    const [projDialogOpen, setProjDialogOpen] = useState(false);
    const [projForm, setProjForm] = useState({
        title: '',
        description: '',
        category: '',
        date: '',
        link: '',
    });
    const [projImageUri, setProjImageUri] = useState<string | null>(null);
    const [projImageName, setProjImageName] = useState<string | null>(null);
    const [projImageType, setProjImageType] = useState<string | null>(null);

    const pickProjImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (res.canceled) return;
        const asset = res.assets[0];
        if (!asset) return;
        const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        setProjImageUri(asset.uri);
        setProjImageName(asset.fileName ?? `project.${ext}`);
        setProjImageType(mime);
    };

    const submitProject = () => {
        if (!projForm.title.trim()) return;
        const fd = new FormData();
        Object.entries(projForm).forEach(([k, v]) => fd.append(k, v.trim()));
        if (projImageUri && projImageName && projImageType) {
            fd.append('image', { uri: projImageUri, name: projImageName, type: projImageType } as any);
        }
        addProj.mutate(fd, {
            onSuccess: () => {
                setProjDialogOpen(false);
                setProjForm({ title: '', description: '', category: '', date: '', link: '' });
                setProjImageUri(null);
                setProjImageName(null);
                setProjImageType(null);
            },
            onError: () => Alert.alert('Feil', 'Kunne ikke lagre prosjekt. Prøv igjen.'),
        });
    };

    const confirmDeleteProj = (projectId: string) =>
        Alert.alert('Slett prosjekt', 'Er du sikker på at du vil slette dette prosjektet?', [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Slett',
                style: 'destructive',
                onPress: () =>
                    delProj.mutate(projectId, {
                        onError: () => Alert.alert('Feil', 'Kunne ikke slette. Prøv igjen.'),
                    }),
            },
        ]);

    // ── Certifications ────────────────────────────────────────────────────────
    const addCert = useAddCertification();
    const delCert = useDeleteCertification();
    const [certDialogOpen, setCertDialogOpen] = useState(false);
    const [certForm, setCertForm] = useState({
        title: '',
        issuedBy: '',
        date: '',
        description: '',
    });
    const [certFileUri, setCertFileUri] = useState<string | null>(null);
    const [certFileName, setCertFileName] = useState<string | null>(null);
    const [certFileMime, setCertFileMime] = useState<string | null>(null);

    const pickCertFile = async () => {
        const res = await DocumentPicker.getDocumentAsync({
            type: ['image/*', 'application/pdf'],
            copyToCacheDirectory: true,
        });
        if (res.canceled) return;
        const asset = res.assets?.[0];
        if (!asset) return;
        if (asset.size && asset.size > MAX_BYTES) {
            Alert.alert('Filen er for stor', 'Maksimal filstørrelse er 8 MB.');
            return;
        }
        setCertFileUri(asset.uri);
        setCertFileName(asset.name ?? 'sertifikat');
        setCertFileMime(asset.mimeType ?? 'application/octet-stream');
    };

    const submitCertification = () => {
        if (!certForm.title.trim()) return;
        const fd = new FormData();
        Object.entries(certForm).forEach(([k, v]) => fd.append(k, v.trim()));
        if (certFileUri && certFileName && certFileMime) {
            fd.append('file', { uri: certFileUri, name: certFileName, type: certFileMime } as any);
        }
        addCert.mutate(fd, {
            onSuccess: () => {
                setCertDialogOpen(false);
                setCertForm({ title: '', issuedBy: '', date: '', description: '' });
                setCertFileUri(null);
                setCertFileName(null);
                setCertFileMime(null);
            },
            onError: () => Alert.alert('Feil', 'Kunne ikke lagre sertifisering. Prøv igjen.'),
        });
    };

    const confirmDeleteCert = (certId: string) =>
        Alert.alert('Slett sertifisering', 'Er du sikker?', [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Slett',
                style: 'destructive',
                onPress: () =>
                    delCert.mutate(certId, {
                        onError: () => Alert.alert('Feil', 'Kunne ikke slette. Prøv igjen.'),
                    }),
            },
        ]);

    const leave = () => {
        if (baseUnchanged) return router.back();
        Alert.alert('Forkast endringer?', 'Endringer i tilgjengelighet og ferdigheter blir ikke lagret.', [
            { text: 'Fortsett å redigere', style: 'cancel' },
            { text: 'Forkast', style: 'destructive', onPress: () => router.back() },
        ]);
    };
    const canSaveBase = !baseUnchanged && !updateProfile.isPending;

    // ─────────────────────────────────────────────────────────────────────────
    // Render guards
    // ─────────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
                <LoadingIndicator variant="form" message="Laster jobbsøker-profil..." />
            </SafeAreaView>
        );
    }

    if (isError || !profile) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
                <ErrorState title="Kunne ikke laste profilen" onAction={() => void refetch()} />
            </SafeAreaView>
        );
    }

    const experience: any[] = (profile as any).experience ?? [];
    const portfolio: any[] = (profile as any).portfolio ?? [];
    const previousProjects: any[] = (profile as any).previousProjects ?? [];
    const certifications: any[] = (profile as any).certifications ?? [];

    // ─────────────────────────────────────────────────────────────────────────
    // Main render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
            {/* Top bar: Tilbake · title · Lagre (Lagre saves availability + skills). */}
            <View className="h-14 flex-row items-center justify-between border-b border-line bg-page px-2">
                <Pressable onPress={leave} hitSlop={8} accessibilityRole="button" className="min-w-[72px] flex-row items-center px-2 py-2">
                    <ChevronLeft size={20} color={TC.ink2} />
                    <Text className="text-[1rem] text-ink-2">Tilbake</Text>
                </Pressable>
                <Text className="text-[1.0625rem] font-semibold text-ink">Jobbsøker-profil</Text>
                <Pressable
                    onPress={saveBase}
                    disabled={!canSaveBase}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSaveBase }}
                    className="min-w-[72px] items-end px-2 py-2"
                >
                    {updateProfile.isPending ? (
                        <ActivityIndicator size="small" color={TC.brandText} />
                    ) : (
                        <Text className={`text-[1rem] font-semibold ${canSaveBase ? 'text-brand-text' : 'text-[#B5B8B0]'}`}>Lagre</Text>
                    )}
                </Pressable>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text className="mb-5 px-1 text-[0.875rem] leading-5 text-muted">
                        Det oppdragsgivere ser når de vurderer deg. Erfaring, portfolio, prosjekter og
                        sertifiseringer lagres med en gang du legger dem til.
                    </Text>

                    {/* ── 1. Tilgjengelighet ── */}
                    <SectionLabel>Tilgjengelighet</SectionLabel>
                    <Card className="mb-6 overflow-hidden">
                        <FormRow
                            label="Når er du tilgjengelig?"
                            value={availability}
                            onChangeText={setAvailability}
                            placeholder="F.eks. Mandag–fredag 08–16, og helger"
                            multiline
                        />
                    </Card>

                    {/* ── 2. Ferdigheter ── */}
                    <SectionLabel>Ferdigheter</SectionLabel>
                    <Card className="mb-2 overflow-hidden">
                        {skills.length ? (
                            <View className="flex-row flex-wrap gap-2 px-4 pt-4">
                                {skills.map((skill) => (
                                    <View key={skill} className="flex-row items-center rounded-full bg-tint py-1 pl-3 pr-1">
                                        <Text className="text-[0.8125rem] font-medium text-brand-text">{skill}</Text>
                                        <Pressable
                                            onPress={() => setSkills((p) => p.filter((s) => s !== skill))}
                                            accessibilityLabel={`Fjern ${skill}`}
                                            hitSlop={6}
                                            className="ml-1 rounded-full p-1"
                                        >
                                            <X size={13} color={TC.brandText} />
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
                                placeholder={skills.length ? 'Legg til en ferdighet til' : 'F.eks. Maling, Flytting, Rengjøring'}
                                placeholderTextColor="#B5B8B0"
                                returnKeyType="done"
                                accessibilityLabel="Ny ferdighet"
                                style={{ paddingVertical: 6, paddingHorizontal: 0 }}
                                className="flex-1 text-[1rem] text-ink"
                            />
                            <Pressable
                                onPress={addSkill}
                                disabled={!skillInput.trim()}
                                accessibilityRole="button"
                                accessibilityLabel="Legg til ferdighet"
                                className={`h-9 w-9 items-center justify-center rounded-full ${skillInput.trim() ? 'bg-brand' : 'bg-line'}`}
                            >
                                <Plus size={17} color="#FFFFFF" />
                            </Pressable>
                        </View>
                    </Card>
                    <Text className="mb-6 px-1 text-[0.8125rem] text-subtle">
                        {baseUnchanged ? 'Tilgjengelighet og ferdigheter er lagret.' : 'Trykk «Lagre» øverst for å lagre endringene.'}
                    </Text>

                    {/* ── 3. Erfaring ── */}
                    <GroupHeader title="Erfaring" onAdd={() => setExpDialogOpen(true)} />
                    <Card className="mb-6 overflow-hidden">
                        {experience.length === 0 ? (
                            <EmptyRow icon={Briefcase} text="Legg til tidligere arbeidserfaring som vises på profilen din." />
                        ) : (
                            experience.map((exp: any, index: number) => (
                                <View key={exp._id} className={`flex-row items-start gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-line-soft' : ''}`}>
                                    <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-tint">
                                        <Briefcase size={16} color={TC.brandText} />
                                    </View>
                                    <View className="min-w-0 flex-1">
                                        <Text className="text-[0.9375rem] font-semibold text-ink">{exp.title}</Text>
                                        {exp.company ? <Text className="mt-0.5 text-[0.8125rem] text-ink-2">{exp.company}</Text> : null}
                                        <Text className="mt-0.5 text-[0.8125rem] text-subtle">
                                            {fmtDate(exp.startDate)} – {fmtDate(exp.endDate)}
                                        </Text>
                                        {exp.description ? (
                                            <Text className="mt-1.5 text-[0.8125rem] leading-5 text-muted">{exp.description}</Text>
                                        ) : null}
                                    </View>
                                    <DeleteButton label="Slett erfaring" disabled={delExp.isPending} onPress={() => confirmDeleteExp(exp._id)} />
                                </View>
                            ))
                        )}
                    </Card>

                    {/* ── 4. Portfolio ── */}
                    <GroupHeader title="Portfolio" onAdd={() => setPortDialogOpen(true)} />
                    <Card className="mb-6 overflow-hidden">
                        {portfolio.length === 0 ? (
                            <EmptyRow icon={ImageIcon} text="Legg til bilder som viser frem arbeidet ditt." />
                        ) : (
                            <View className="flex-row flex-wrap justify-between gap-y-3 p-3">
                                {portfolio.map((item: any) => (
                                    <View key={item._id} className="overflow-hidden rounded-2xl bg-surface-2" style={{ width: '48.5%', aspectRatio: 1 }}>
                                        {item.imageUrl ? (
                                            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={item.title} />
                                        ) : (
                                            <View className="h-full w-full items-center justify-center">
                                                <ImageIcon size={24} color={tc('#9B9E96', 'subtle')} />
                                            </View>
                                        )}
                                        <View className="absolute bottom-0 left-0 right-0 flex-row items-center bg-[#0B0B0B]/55 py-1.5 pl-2.5 pr-1">
                                            <Text className="flex-1 text-[0.8125rem] font-semibold text-white" numberOfLines={1}>{item.title}</Text>
                                            <Pressable onPress={() => confirmDeletePort(item._id)} disabled={delPort.isPending} hitSlop={6} className="p-1" accessibilityLabel={`Slett ${item.title}`}>
                                                <Trash2 size={14} color="#FFFFFF" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </Card>

                    {/* ── 5. Tidligere prosjekter ── */}
                    <GroupHeader title="Tidligere prosjekter" onAdd={() => setProjDialogOpen(true)} />
                    <Card className="mb-6 overflow-hidden">
                        {previousProjects.length === 0 ? (
                            <EmptyRow icon={FileText} text="Vis frem tidligere oppdrag du er stolt av." />
                        ) : (
                            previousProjects.map((proj: any, index: number) => (
                                <View key={proj._id} className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-line-soft' : ''}`}>
                                    {proj.imageUrl ? (
                                        <Image source={{ uri: proj.imageUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} resizeMode="cover" />
                                    ) : (
                                        <View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-surface-2">
                                            <FileText size={20} color={tc('#9B9E96', 'subtle')} />
                                        </View>
                                    )}
                                    <View className="min-w-0 flex-1">
                                        <Text className="text-[0.9375rem] font-semibold text-ink" numberOfLines={1}>{proj.title}</Text>
                                        <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>
                                            {[proj.category, proj.date ? new Date(proj.date).getFullYear() : null].filter(Boolean).join(' · ') || 'Prosjekt'}
                                        </Text>
                                    </View>
                                    <DeleteButton label="Slett prosjekt" disabled={delProj.isPending} onPress={() => confirmDeleteProj(proj._id)} />
                                </View>
                            ))
                        )}
                    </Card>

                    {/* ── 6. Sertifiseringer ── */}
                    <GroupHeader title="Sertifiseringer og fagbrev" onAdd={() => setCertDialogOpen(true)} />
                    <Card className="overflow-hidden">
                        {certifications.length === 0 ? (
                            <EmptyRow icon={Award} text="Legg til fagbrev, kurs eller andre sertifikater." />
                        ) : (
                            certifications.map((cert: any, index: number) => (
                                <View key={cert._id} className={`flex-row items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-line-soft' : ''}`}>
                                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-tint">
                                        <Award size={17} color={TC.brandText} />
                                    </View>
                                    <View className="min-w-0 flex-1">
                                        <Text className="text-[0.9375rem] font-semibold text-ink">{cert.title}</Text>
                                        {cert.issuedBy ? <Text className="mt-0.5 text-[0.8125rem] text-muted">{cert.issuedBy}</Text> : null}
                                    </View>
                                    <DeleteButton label="Slett sertifisering" disabled={delCert.isPending} onPress={() => confirmDeleteCert(cert._id)} />
                                </View>
                            ))
                        )}
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Dialog: Add Experience ── */}
            <FormDialog
                visible={expDialogOpen}
                title="Legg til erfaring"
                onClose={() => setExpDialogOpen(false)}
                onSubmit={submitExperience}
                canSubmit={!!expForm.title.trim()}
                pending={addExp.isPending}
            >
                <FormRow label="Jobbtittel *" value={expForm.title} onChangeText={(v) => setExpForm((p) => ({ ...p, title: v }))} placeholder="F.eks. Snekker" />
                <FormRow divider label="Bedrift / klient" value={expForm.company} onChangeText={(v) => setExpForm((p) => ({ ...p, company: v }))} placeholder="F.eks. Johansen Bygg AS" />
                <FormRow divider label="Startdato (ÅÅÅÅ-MM-DD)" value={expForm.startDate} onChangeText={(v) => setExpForm((p) => ({ ...p, startDate: v }))} placeholder="2022-01-15" keyboardType="numbers-and-punctuation" />
                <FormRow divider label="Sluttdato (tom = nåværende)" value={expForm.endDate ?? ''} onChangeText={(v) => setExpForm((p) => ({ ...p, endDate: v }))} placeholder="2024-06-30" keyboardType="numbers-and-punctuation" />
                <FormRow divider label="Beskrivelse" value={expForm.description ?? ''} onChangeText={(v) => setExpForm((p) => ({ ...p, description: v }))} placeholder="Beskriv arbeidsoppgavene …" multiline />
            </FormDialog>

            {/* ── Dialog: Add Portfolio ── */}
            <FormDialog
                visible={portDialogOpen}
                title="Legg til i portfolio"
                onClose={() => setPortDialogOpen(false)}
                onSubmit={submitPortfolio}
                canSubmit={!!portForm.title.trim()}
                pending={addPort.isPending}
                attachment={{ icon: ImageIcon, label: portImageName ?? 'Velg bilde (valgfritt)', chosen: !!portImageUri, onPress: () => void pickPortImage() }}
            >
                <FormRow label="Tittel *" value={portForm.title} onChangeText={(v) => setPortForm((p) => ({ ...p, title: v }))} placeholder="F.eks. Kjøkkenrenovering" />
                <FormRow divider label="Beskrivelse" value={portForm.description} onChangeText={(v) => setPortForm((p) => ({ ...p, description: v }))} placeholder="Kort beskrivelse …" multiline />
                <FormRow divider label="Lenke" value={portForm.link} onChangeText={(v) => setPortForm((p) => ({ ...p, link: v }))} placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
            </FormDialog>

            {/* ── Dialog: Add Previous Project ── */}
            <FormDialog
                visible={projDialogOpen}
                title="Legg til prosjekt"
                onClose={() => setProjDialogOpen(false)}
                onSubmit={submitProject}
                canSubmit={!!projForm.title.trim()}
                pending={addProj.isPending}
                attachment={{ icon: ImageIcon, label: projImageName ?? 'Velg bilde (valgfritt)', chosen: !!projImageUri, onPress: () => void pickProjImage() }}
            >
                <FormRow label="Tittel *" value={projForm.title} onChangeText={(v) => setProjForm((p) => ({ ...p, title: v }))} placeholder="F.eks. Baderomsrenovering" />
                <FormRow divider label="Kategori" value={projForm.category} onChangeText={(v) => setProjForm((p) => ({ ...p, category: v }))} placeholder="F.eks. Maling, Snekker" />
                <FormRow divider label="Dato (ÅÅÅÅ-MM-DD)" value={projForm.date} onChangeText={(v) => setProjForm((p) => ({ ...p, date: v }))} placeholder="2024-03-01" keyboardType="numbers-and-punctuation" />
                <FormRow divider label="Lenke" value={projForm.link} onChangeText={(v) => setProjForm((p) => ({ ...p, link: v }))} placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
                <FormRow divider label="Beskrivelse" value={projForm.description} onChangeText={(v) => setProjForm((p) => ({ ...p, description: v }))} placeholder="Beskriv prosjektet …" multiline />
            </FormDialog>

            {/* ── Dialog: Add Certification ── */}
            <FormDialog
                visible={certDialogOpen}
                title="Legg til sertifisering"
                onClose={() => setCertDialogOpen(false)}
                onSubmit={submitCertification}
                canSubmit={!!certForm.title.trim()}
                pending={addCert.isPending}
                attachment={{ icon: FileText, label: certFileName ?? 'Velg fil – PDF eller bilde (maks 8 MB)', chosen: !!certFileUri, onPress: () => void pickCertFile() }}
            >
                <FormRow label="Tittel *" value={certForm.title} onChangeText={(v) => setCertForm((p) => ({ ...p, title: v }))} placeholder="F.eks. Fagbrev tømrer" />
                <FormRow divider label="Utstedt av" value={certForm.issuedBy} onChangeText={(v) => setCertForm((p) => ({ ...p, issuedBy: v }))} placeholder="F.eks. Fagopplæringskontoret" />
                <FormRow divider label="Dato (ÅÅÅÅ-MM-DD)" value={certForm.date} onChangeText={(v) => setCertForm((p) => ({ ...p, date: v }))} placeholder="2020-06-15" keyboardType="numbers-and-punctuation" />
                <FormRow divider label="Beskrivelse" value={certForm.description} onChangeText={(v) => setCertForm((p) => ({ ...p, description: v }))} placeholder="Kort beskrivelse …" multiline />
            </FormDialog>
        </SafeAreaView>
    );
}

// ─── Small pieces used only on this screen ────────────────────────────────────

/** Section title with a "+ Legg til" action on the right. */
function GroupHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
    return (
        <View className="mb-2 flex-row items-center justify-between px-1">
            <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">{title}</Text>
            <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Legg til ${title.toLowerCase()}`} className="flex-row items-center gap-1">
                <Plus size={15} color={TC.brandText} />
                <Text className="text-[0.8125rem] font-semibold text-brand-text">Legg til</Text>
            </Pressable>
        </View>
    );
}

/** One-line empty state inside a Card (no nested card). */
function EmptyRow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return (
        <View className="flex-row items-center gap-3 px-4 py-4">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                <Icon size={17} color={tc('#9B9E96', 'subtle')} />
            </View>
            <Text className="flex-1 text-[0.8125rem] leading-5 text-muted">{text}</Text>
        </View>
    );
}

function DeleteButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
    return (
        <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} className="h-8 w-8 items-center justify-center rounded-full active:bg-danger-tint">
            <Trash2 size={16} color={tc('#B4544A', 'danger')} />
        </Pressable>
    );
}

/** Add-item dialog: title, grouped FormRows, optional file picker, Avbryt / Lagre. */
function FormDialog({
    visible,
    title,
    onClose,
    onSubmit,
    canSubmit,
    pending,
    attachment,
    children,
}: {
    visible: boolean;
    title: string;
    onClose: () => void;
    onSubmit: () => void;
    canSubmit: boolean;
    pending: boolean;
    attachment?: { icon: LucideIcon; label: string; chosen: boolean; onPress: () => void };
    children: React.ReactNode;
}) {
    const AttachIcon = attachment?.icon;
    return (
        <Dialog visible={visible} onClose={onClose} contentClassName="p-5">
            <Text className="text-[1.125rem] font-bold text-ink">{title}</Text>
            <View className="mt-4 overflow-hidden rounded-2xl border border-line">{children}</View>
            {attachment && AttachIcon ? (
                <Pressable
                    onPress={attachment.onPress}
                    accessibilityRole="button"
                    className={`mt-3 flex-row items-center gap-2.5 rounded-2xl border border-dashed px-4 py-3 ${attachment.chosen ? 'border-brand-text bg-tint' : 'border-line-strong'}`}
                >
                    <AttachIcon size={18} color={attachment.chosen ? TC.brandText : tc('#9B9E96', 'subtle')} />
                    <Text className={`flex-1 text-[0.875rem] ${attachment.chosen ? 'font-medium text-brand-text' : 'text-muted'}`} numberOfLines={1}>
                        {attachment.label}
                    </Text>
                </Pressable>
            ) : null}
            <View className="mt-5 flex-row gap-3">
                <View className="flex-1">
                    <Button label="Avbryt" variant="secondary" fullWidth onPress={onClose} />
                </View>
                <View className="flex-1">
                    <Button label={pending ? 'Lagrer…' : 'Lagre'} fullWidth onPress={onSubmit} disabled={!canSubmit || pending} />
                </View>
            </View>
        </Dialog>
    );
}
