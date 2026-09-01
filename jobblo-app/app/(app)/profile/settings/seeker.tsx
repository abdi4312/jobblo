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
    ArrowLeft,
    Award,
    Briefcase,
    Calendar,
    FileText,
    Image as ImageIcon,
    Loader2,
    Plus,
    Trash2,
    X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { Button } from '../../../../src/components/ui/Button';
import { Dialog } from '../../../../src/components/ui/Dialog';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
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

// ─── Max file size: must match backend (8 MB) ────────────────────────────────
const MAX_BYTES = 8 * 1024 * 1024;

// ─── Tiny reusable primitives ─────────────────────────────────────────────────

function SectionHeader({
    icon: Icon,
    title,
    onAdd,
    addLabel,
}: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    title: string;
    onAdd?: () => void;
    addLabel?: string;
}) {
    return (
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
                <Icon size={18} color="#2E6641" />
                <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">{title}</Text>
            </View>
            {onAdd ? (
                <Pressable
                    onPress={onAdd}
                    className="flex-row items-center gap-1 rounded-full px-3 py-2 active:bg-[#F4F6F0]"
                >
                    <Plus size={15} color="#2E6641" />
                    <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">{addLabel}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

function FieldLabel({ text }: { text: string }) {
    return (
        <Text className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">
            {text}
        </Text>
    );
}

function StyledInput({
    value,
    onChangeText,
    placeholder,
    multiline,
    numberOfLines,
}: {
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
    numberOfLines?: number;
}) {
    return (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9B9E96"
            multiline={multiline}
            numberOfLines={numberOfLines}
            textAlignVertical={multiline ? 'top' : 'auto'}
            className="rounded-xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]"
            style={multiline ? { minHeight: 80 } : undefined}
        />
    );
}

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

    // ─────────────────────────────────────────────────────────────────────────
    // Render guards
    // ─────────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-[#EFF0EA]">
                <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
                    <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full">
                        <ArrowLeft size={22} color="#0B0B0B" />
                    </Pressable>
                    <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Jobbsøker-profil</Text>
                </View>
                <LoadingIndicator />
            </SafeAreaView>
        );
    }

    if (isError || !profile) {
        return (
            <SafeAreaView className="flex-1 bg-[#EFF0EA]">
                <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
                    <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full">
                        <ArrowLeft size={22} color="#0B0B0B" />
                    </Pressable>
                    <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Jobbsøker-profil</Text>
                </View>
                <ErrorState onAction={() => void refetch()} />
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
        <SafeAreaView className="flex-1 bg-[#EFF0EA]">
            {/* Header */}
            <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
                <Pressable
                    onPress={() => router.back()}
                    accessibilityLabel="Tilbake"
                    className="h-10 w-10 items-center justify-center rounded-full"
                >
                    <ArrowLeft size={22} color="#0B0B0B" />
                </Pressable>
                <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Jobbsøker-profil</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >

                    {/* ── 1. Tilgjengelighet ─────────────────────────────────────── */}
                    <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
                        <SectionHeader icon={Calendar} title="Tilgjengelighet" />
                        <View className="mt-4">
                            <FieldLabel text="Når er du tilgjengelig?" />
                            <TextInput
                                value={availability}
                                onChangeText={setAvailability}
                                placeholder="F.eks. Mandag–fredag: 08:00–16:00"
                                placeholderTextColor="#9B9E96"
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                className="rounded-xl border border-[#E6E7E1] bg-[#FBFCF8] px-4 py-3 text-[0.9375rem] text-[#0B0B0B]"
                                style={{ minHeight: 72 }}
                            />
                        </View>
                    </View>

                    {/* ── 2. Ferdigheter ────────────────────────────────────────── */}
                    <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
                        <SectionHeader icon={Briefcase} title="Ferdigheter" />

                        <View className="mt-4 flex-row gap-2">
                            <TextInput
                                value={skillInput}
                                onChangeText={setSkillInput}
                                onSubmitEditing={addSkill}
                                placeholder="Legg til en ferdighet …"
                                placeholderTextColor="#9B9E96"
                                returnKeyType="done"
                                className="flex-1 rounded-xl border border-[#E6E7E1] bg-[#FBFCF8] px-4 py-3 text-[0.9375rem] text-[#0B0B0B]"
                            />
                            <Pressable
                                onPress={addSkill}
                                className="items-center justify-center rounded-xl bg-[#2E6641] px-4"
                            >
                                <Plus size={18} color="#FFFFFF" />
                            </Pressable>
                        </View>

                        {skills.length > 0 && (
                            <View className="mt-3 flex-row flex-wrap gap-2">
                                {skills.map((skill) => (
                                    <View
                                        key={skill}
                                        className="flex-row items-center gap-1.5 rounded-full border border-[#2E6641]/20 bg-[#EAF1E9] px-3 py-1.5"
                                    >
                                        <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">{skill}</Text>
                                        <Pressable onPress={() => setSkills((p) => p.filter((s) => s !== skill))}>
                                            <X size={13} color="#2E6641" />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── Save base fields ────────────────────────────────────────── */}
                    <View className="mt-4">
                        <Button
                            label={updateProfile.isPending ? 'Lagrer …' : 'Lagre endringer'}
                            onPress={saveBase}
                            disabled={baseUnchanged || updateProfile.isPending}
                            fullWidth
                        />
                    </View>

                    {/* ── 3. Erfaring ───────────────────────────────────────────── */}
                    <View className="mt-6 rounded-3xl border border-[#E6E7E1] bg-white p-5">
                        <SectionHeader
                            icon={Briefcase}
                            title="Erfaring"
                            onAdd={() => setExpDialogOpen(true)}
                            addLabel="Legg til"
                        />
                        {experience.length === 0 ? (
                            <EmptyState
                                title="Ingen erfaring lagt til ennå"
                                message="Legg til tidligere arbeidserfaring som vises på profilen din."
                            />
                        ) : (
                            <View className="mt-4 gap-3">
                                {experience.map((exp: any) => (
                                    <View
                                        key={exp._id}
                                        className="rounded-2xl border border-[#E6E7E1] bg-[#FBFCF8] p-4"
                                    >
                                        <View className="flex-row items-start justify-between gap-2">
                                            <View className="flex-1">
                                                <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                                                    {exp.title}
                                                </Text>
                                                {exp.company ? (
                                                    <Text className="mt-0.5 text-[0.875rem] font-semibold text-[#2E6641]">
                                                        {exp.company}
                                                    </Text>
                                                ) : null}
                                                <Text className="mt-1 text-[0.75rem] text-[#9B9E96]">
                                                    {fmtDate(exp.startDate)} – {fmtDate(exp.endDate)}
                                                </Text>
                                                {exp.description ? (
                                                    <Text className="mt-2 text-[0.875rem] leading-5 text-[#63665F]">
                                                        {exp.description}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <Pressable
                                                onPress={() => confirmDeleteExp(exp._id)}
                                                disabled={delExp.isPending}
                                                className="p-2"
                                                accessibilityLabel="Slett erfaring"
                                            >
                                                <Trash2 size={17} color="#B4544A" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── 4. Portfolio ─────────────────────────────────────────── */}
                    <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
                        <SectionHeader
                            icon={ImageIcon}
                            title="Portfolio"
                            onAdd={() => setPortDialogOpen(true)}
                            addLabel="Legg til"
                        />
                        {portfolio.length === 0 ? (
                            <EmptyState
                                title="Ingen portfolio-elementer ennå"
                                message="Legg til bilder som viser frem arbeidet ditt."
                            />
                        ) : (
                            <View className="mt-4 flex-row flex-wrap gap-3">
                                {portfolio.map((item: any) => (
                                    <View
                                        key={item._id}
                                        className="relative overflow-hidden rounded-2xl border border-[#E6E7E1]"
                                        style={{ width: '47%', aspectRatio: 1 }}
                                    >
                                        {item.imageUrl ? (
                                            <Image
                                                source={{ uri: item.imageUrl }}
                                                className="h-full w-full"
                                                resizeMode="cover"
                                                accessibilityLabel={item.title}
                                            />
                                        ) : (
                                            <View className="h-full w-full items-center justify-center bg-[#F4F6F0]">
                                                <ImageIcon size={24} color="#9B9E96" />
                                            </View>
                                        )}
                                        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between bg-[#0B0B0B]/60 px-2 py-1.5">
                                            <Text
                                                className="flex-1 text-[0.75rem] font-semibold text-white"
                                                numberOfLines={1}
                                            >
                                                {item.title}
                                            </Text>
                                            <Pressable
                                                onPress={() => confirmDeletePort(item._id)}
                                                disabled={delPort.isPending}
                                                className="ml-2 p-1"
                                                accessibilityLabel="Slett"
                                            >
                                                <Trash2 size={14} color="#FFFFFF" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── 5. Tidligere prosjekter ───────────────────────────────── */}
                    <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
                        <SectionHeader
                            icon={FileText}
                            title="Tidligere prosjekter"
                            onAdd={() => setProjDialogOpen(true)}
                            addLabel="Legg til"
                        />
                        {previousProjects.length === 0 ? (
                            <EmptyState
                                title="Ingen prosjekter lagt til ennå"
                                message="Vis frem tidligere oppdrag du er stolt av."
                            />
                        ) : (
                            <View className="mt-4 gap-3">
                                {previousProjects.map((proj: any) => (
                                    <View
                                        key={proj._id}
                                        className="flex-row items-center gap-3 rounded-2xl border border-[#E6E7E1] bg-[#FBFCF8] p-4"
                                    >
                                        {proj.imageUrl ? (
                                            <Image
                                                source={{ uri: proj.imageUrl }}
                                                className="h-14 w-14 rounded-xl"
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View className="h-14 w-14 items-center justify-center rounded-xl bg-[#F4F6F0]">
                                                <FileText size={20} color="#9B9E96" />
                                            </View>
                                        )}
                                        <View className="flex-1">
                                            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                                                {proj.title}
                                            </Text>
                                            {proj.category ? (
                                                <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">
                                                    {proj.category}
                                                </Text>
                                            ) : null}
                                            {proj.date ? (
                                                <Text className="text-[0.75rem] text-[#9B9E96]">
                                                    {new Date(proj.date).getFullYear()}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <Pressable
                                            onPress={() => confirmDeleteProj(proj._id)}
                                            disabled={delProj.isPending}
                                            className="p-2"
                                            accessibilityLabel="Slett prosjekt"
                                        >
                                            <Trash2 size={17} color="#B4544A" />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── 6. Sertifiseringer ───────────────────────────────────── */}
                    <View className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
                        <SectionHeader
                            icon={Award}
                            title="Sertifiseringer / Fagbrev"
                            onAdd={() => setCertDialogOpen(true)}
                            addLabel="Legg til"
                        />
                        {certifications.length === 0 ? (
                            <EmptyState
                                title="Ingen sertifiseringer ennå"
                                message="Legg til fagbrev, kurs eller andre sertifikater."
                            />
                        ) : (
                            <View className="mt-4 gap-3">
                                {certifications.map((cert: any) => (
                                    <View
                                        key={cert._id}
                                        className="flex-row items-center gap-3 rounded-2xl border border-[#E6E7E1] bg-[#FBFCF8] p-4"
                                    >
                                        <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]">
                                            <Award size={20} color="#2E6641" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                                                {cert.title}
                                            </Text>
                                            {cert.issuedBy ? (
                                                <Text className="text-[0.8125rem] text-[#63665F]">{cert.issuedBy}</Text>
                                            ) : null}
                                        </View>
                                        <Pressable
                                            onPress={() => confirmDeleteCert(cert._id)}
                                            disabled={delCert.isPending}
                                            className="p-2"
                                            accessibilityLabel="Slett sertifisering"
                                        >
                                            <Trash2 size={17} color="#B4544A" />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Dialog: Add Experience ──────────────────────────────────────── */}
            <Dialog visible={expDialogOpen} onClose={() => setExpDialogOpen(false)}>
                <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">Legg til erfaring</Text>
                <View className="mt-4 gap-3">
                    <View>
                        <FieldLabel text="Jobbtittel *" />
                        <StyledInput
                            value={expForm.title}
                            onChangeText={(v) => setExpForm((p) => ({ ...p, title: v }))}
                            placeholder="F.eks. Snekker"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Bedrift / klient" />
                        <StyledInput
                            value={expForm.company}
                            onChangeText={(v) => setExpForm((p) => ({ ...p, company: v }))}
                            placeholder="F.eks. Johansen Bygg AS"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Startdato (ÅÅÅÅ-MM-DD)" />
                        <StyledInput
                            value={expForm.startDate}
                            onChangeText={(v) => setExpForm((p) => ({ ...p, startDate: v }))}
                            placeholder="2022-01-15"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Sluttdato (valgfritt)" />
                        <StyledInput
                            value={expForm.endDate ?? ''}
                            onChangeText={(v) => setExpForm((p) => ({ ...p, endDate: v }))}
                            placeholder="2024-06-30 – la stå tomt for nåværende"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Beskrivelse (valgfritt)" />
                        <StyledInput
                            value={expForm.description ?? ''}
                            onChangeText={(v) => setExpForm((p) => ({ ...p, description: v }))}
                            placeholder="Beskriv arbeidsoppgavene …"
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>
                <View className="mt-5 flex-row gap-3">
                    <Pressable
                        onPress={() => setExpDialogOpen(false)}
                        className="flex-1 items-center rounded-full border border-[#E6E7E1] py-3"
                    >
                        <Text className="text-[0.875rem] font-semibold text-[#63665F]">Avbryt</Text>
                    </Pressable>
                    <Pressable
                        onPress={submitExperience}
                        disabled={!expForm.title.trim() || addExp.isPending}
                        className="flex-1 items-center rounded-full bg-[#2E6641] py-3 disabled:opacity-50"
                    >
                        {addExp.isPending ? (
                            <Loader2 size={16} color="#FFFFFF" />
                        ) : (
                            <Text className="text-[0.875rem] font-semibold text-white">Lagre</Text>
                        )}
                    </Pressable>
                </View>
            </Dialog>

            {/* ── Dialog: Add Portfolio ────────────────────────────────────────── */}
            <Dialog visible={portDialogOpen} onClose={() => setPortDialogOpen(false)}>
                <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">Legg til portfolio-element</Text>
                <View className="mt-4 gap-3">
                    <View>
                        <FieldLabel text="Tittel *" />
                        <StyledInput
                            value={portForm.title}
                            onChangeText={(v) => setPortForm((p) => ({ ...p, title: v }))}
                            placeholder="F.eks. Kjøkkenrenovering"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Beskrivelse" />
                        <StyledInput
                            value={portForm.description}
                            onChangeText={(v) => setPortForm((p) => ({ ...p, description: v }))}
                            placeholder="Kort beskrivelse …"
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                    <View>
                        <FieldLabel text="Lenke (valgfritt)" />
                        <StyledInput
                            value={portForm.link}
                            onChangeText={(v) => setPortForm((p) => ({ ...p, link: v }))}
                            placeholder="https://"
                        />
                    </View>
                    <Pressable
                        onPress={() => void pickPortImage()}
                        className="flex-row items-center gap-2 rounded-xl border border-dashed border-[#E6E7E1] px-4 py-3"
                    >
                        <ImageIcon size={18} color={portImageUri ? '#2E6641' : '#9B9E96'} />
                        <Text
                            className="flex-1 text-[0.875rem]"
                            style={{ color: portImageUri ? '#2E6641' : '#9B9E96' }}
                            numberOfLines={1}
                        >
                            {portImageName ?? 'Velg bilde (valgfritt)'}
                        </Text>
                    </Pressable>
                </View>
                <View className="mt-5 flex-row gap-3">
                    <Pressable
                        onPress={() => setPortDialogOpen(false)}
                        className="flex-1 items-center rounded-full border border-[#E6E7E1] py-3"
                    >
                        <Text className="text-[0.875rem] font-semibold text-[#63665F]">Avbryt</Text>
                    </Pressable>
                    <Pressable
                        onPress={submitPortfolio}
                        disabled={!portForm.title.trim() || addPort.isPending}
                        className="flex-1 items-center rounded-full bg-[#2E6641] py-3 disabled:opacity-50"
                    >
                        {addPort.isPending ? (
                            <Loader2 size={16} color="#FFFFFF" />
                        ) : (
                            <Text className="text-[0.875rem] font-semibold text-white">Lagre</Text>
                        )}
                    </Pressable>
                </View>
            </Dialog>

            {/* ── Dialog: Add Previous Project ─────────────────────────────────── */}
            <Dialog visible={projDialogOpen} onClose={() => setProjDialogOpen(false)}>
                <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">Legg til prosjekt</Text>
                <View className="mt-4 gap-3">
                    <View>
                        <FieldLabel text="Tittel *" />
                        <StyledInput
                            value={projForm.title}
                            onChangeText={(v) => setProjForm((p) => ({ ...p, title: v }))}
                            placeholder="F.eks. Baderomsrenovering"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Kategori" />
                        <StyledInput
                            value={projForm.category}
                            onChangeText={(v) => setProjForm((p) => ({ ...p, category: v }))}
                            placeholder="F.eks. Maling, Snekker"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Dato (ÅÅÅÅ-MM-DD, valgfritt)" />
                        <StyledInput
                            value={projForm.date}
                            onChangeText={(v) => setProjForm((p) => ({ ...p, date: v }))}
                            placeholder="2024-03-01"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Lenke (valgfritt)" />
                        <StyledInput
                            value={projForm.link}
                            onChangeText={(v) => setProjForm((p) => ({ ...p, link: v }))}
                            placeholder="https://"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Beskrivelse" />
                        <StyledInput
                            value={projForm.description}
                            onChangeText={(v) => setProjForm((p) => ({ ...p, description: v }))}
                            placeholder="Beskriv prosjektet …"
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                    <Pressable
                        onPress={() => void pickProjImage()}
                        className="flex-row items-center gap-2 rounded-xl border border-dashed border-[#E6E7E1] px-4 py-3"
                    >
                        <ImageIcon size={18} color={projImageUri ? '#2E6641' : '#9B9E96'} />
                        <Text
                            className="flex-1 text-[0.875rem]"
                            style={{ color: projImageUri ? '#2E6641' : '#9B9E96' }}
                            numberOfLines={1}
                        >
                            {projImageName ?? 'Velg bilde (valgfritt)'}
                        </Text>
                    </Pressable>
                </View>
                <View className="mt-5 flex-row gap-3">
                    <Pressable
                        onPress={() => setProjDialogOpen(false)}
                        className="flex-1 items-center rounded-full border border-[#E6E7E1] py-3"
                    >
                        <Text className="text-[0.875rem] font-semibold text-[#63665F]">Avbryt</Text>
                    </Pressable>
                    <Pressable
                        onPress={submitProject}
                        disabled={!projForm.title.trim() || addProj.isPending}
                        className="flex-1 items-center rounded-full bg-[#2E6641] py-3 disabled:opacity-50"
                    >
                        {addProj.isPending ? (
                            <Loader2 size={16} color="#FFFFFF" />
                        ) : (
                            <Text className="text-[0.875rem] font-semibold text-white">Lagre</Text>
                        )}
                    </Pressable>
                </View>
            </Dialog>

            {/* ── Dialog: Add Certification ────────────────────────────────────── */}
            <Dialog visible={certDialogOpen} onClose={() => setCertDialogOpen(false)}>
                <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">Legg til sertifisering</Text>
                <View className="mt-4 gap-3">
                    <View>
                        <FieldLabel text="Tittel *" />
                        <StyledInput
                            value={certForm.title}
                            onChangeText={(v) => setCertForm((p) => ({ ...p, title: v }))}
                            placeholder="F.eks. Fagbrev tømrer"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Utstedt av" />
                        <StyledInput
                            value={certForm.issuedBy}
                            onChangeText={(v) => setCertForm((p) => ({ ...p, issuedBy: v }))}
                            placeholder="F.eks. Fagopplæringskontoret"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Dato (ÅÅÅÅ-MM-DD, valgfritt)" />
                        <StyledInput
                            value={certForm.date}
                            onChangeText={(v) => setCertForm((p) => ({ ...p, date: v }))}
                            placeholder="2020-06-15"
                        />
                    </View>
                    <View>
                        <FieldLabel text="Beskrivelse (valgfritt)" />
                        <StyledInput
                            value={certForm.description}
                            onChangeText={(v) => setCertForm((p) => ({ ...p, description: v }))}
                            placeholder="Kort beskrivelse …"
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                    <Pressable
                        onPress={() => void pickCertFile()}
                        className="flex-row items-center gap-2 rounded-xl border border-dashed border-[#E6E7E1] px-4 py-3"
                    >
                        <FileText size={18} color={certFileUri ? '#2E6641' : '#9B9E96'} />
                        <Text
                            className="flex-1 text-[0.875rem]"
                            style={{ color: certFileUri ? '#2E6641' : '#9B9E96' }}
                            numberOfLines={1}
                        >
                            {certFileName ?? 'Velg fil — PDF eller bilde (valgfritt, maks 8 MB)'}
                        </Text>
                    </Pressable>
                </View>
                <View className="mt-5 flex-row gap-3">
                    <Pressable
                        onPress={() => setCertDialogOpen(false)}
                        className="flex-1 items-center rounded-full border border-[#E6E7E1] py-3"
                    >
                        <Text className="text-[0.875rem] font-semibold text-[#63665F]">Avbryt</Text>
                    </Pressable>
                    <Pressable
                        onPress={submitCertification}
                        disabled={!certForm.title.trim() || addCert.isPending}
                        className="flex-1 items-center rounded-full bg-[#2E6641] py-3 disabled:opacity-50"
                    >
                        {addCert.isPending ? (
                            <Loader2 size={16} color="#FFFFFF" />
                        ) : (
                            <Text className="text-[0.875rem] font-semibold text-white">Lagre</Text>
                        )}
                    </Pressable>
                </View>
            </Dialog>
        </SafeAreaView>
    );
}
