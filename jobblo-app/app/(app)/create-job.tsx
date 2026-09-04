import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@expo/ui/community/datetime-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Banknote,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  Gavel,
  ListChecks,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import { useCategories } from '../../src/hooks/useCategories';
import { useLocationTree } from '../../src/hooks/useLocationTree';
import { useCreateJobMutation, useUpdateJobMutation } from '../../src/hooks/useCreateJob';
import { useMyJobs } from '../../src/hooks/useMyJobs';
import { useSmartFillMutation, useAnalyzeImageMutation } from '../../src/hooks/useSmartFill';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { CreateJobLocationMap } from '../../src/components/create-job/CreateJobLocationMap';
import { Select } from '../../src/components/ui/Select';
import { Button } from '../../src/components/ui/Button';
import { draftStorage } from '../../src/utils/draftStorage';
import { useAuthStore } from '../../src/store/authStore';
import type {
  CreateJobFormValues,
  CreateJobImage,
  DurationUnit,
  PaymentType,
} from '../../src/services/createJob.service';

const DRAFT_KEY = 'jobblo-create-job-draft';
const STEPS = ['Grunnleggende', 'Tid & sted', 'Sjekkliste', 'Kontakt'];
const PAYMENT_CARDS: Array<{
  value: PaymentType;
  label: string;
  description: string;
  icon: typeof Banknote;
}> = [
    {
      value: 'Fastpris',
      label: 'Fastpris',
      description: 'Én avtalt sum for hele jobben',
      icon: Banknote,
    },
    { value: 'Timepris', label: 'Timepris', description: 'Betal per time som brukes', icon: Clock3 },
    { value: 'Anbud', label: 'Anbud', description: 'La flere gi deg tilbud', icon: Gavel },
  ];
const DURATIONS = [
  { label: 'Minutter', value: 'minutes' },
  { label: 'Timer', value: 'hours' },
  { label: 'Dager', value: 'days' },
];
const EQUIPMENT = [
  { label: 'Utstyrsfri', value: 'utstyrfri' },
  { label: 'Delvis utstyr', value: 'delvis utstyr' },
  { label: 'Trenger utstyr', value: 'trengs utstyr' },
];

type Draft = Omit<CreateJobFormValues, 'coordinates'> & {
  coordinates: [number, number] | null;
  images: CreateJobImage[];
};
type ErrorKey =
  | 'images'
  | 'title'
  | 'description'
  | 'categories'
  | 'address'
  | 'city'
  | 'countyCode'
  | 'municipalityCode'
  | 'coordinates'
  | 'fromDate'
  | 'toDate'
  | 'durationValue'
  | 'price'
  | 'email'
  | 'phone';
type CreateJobErrors = Partial<Record<ErrorKey, string>>;
function emptyValues(): CreateJobFormValues {
  return {
    title: '',
    description: '',
    categories: [],
    tags: [],
    equipment: 'utstyrfri',
    maxApplicants: '0',
    urgent: false,
    address: '',
    city: '',
    countyCode: '',
    municipalityCode: '',
    areaCode: '',
    coordinates: [0, 0],
    fromDate: '',
    toDate: '',
    durationValue: '',
    durationUnit: 'hours',
    paymentType: 'Fastpris',
    price: '',
    hourlyRate: '',
    contactPhone: '',
    contactEmail: '',
    checklist: [],
  };
}
function getError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const data = (error.response as { data?: { error?: string; message?: string } }).data;
    return data?.error ?? data?.message;
  }
  return error instanceof Error ? error.message : undefined;
}
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  helper,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  helper?: string;
  error?: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#63665F]">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9B9E96"
        multiline={multiline}
        keyboardType={keyboardType}
        className={[
          'rounded-xl border bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B]',
          multiline ? 'min-h-[120px]' : '',
          error ? 'border-[#B4453A]' : 'border-[#E6E7E1]',
        ].join(' ')}
      />
      {helper ? <Text className="text-[0.75rem] text-[#63665F]">{helper}</Text> : null}
      {error ? (
        <Text className="flex-row text-[0.75rem] font-medium text-[#B4453A]">
          <AlertCircle size={12} color="#B4453A" /> {error}
        </Text>
      ) : null}
    </View>
  );
}
function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}
function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateLabel(value: string) {
  if (!value) return '';
  return localDate(value).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
function DateField({
  label,
  value,
  error,
  onPress,
}: {
  label: string;
  value: string;
  error?: string;
  onPress: () => void;
}) {
  return (
    <View className="flex-1 gap-2">
      <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#63665F]">
        {label} *
      </Text>
      <Pressable
        onPress={onPress}
        className={[
          'flex-row items-center gap-2 rounded-xl border bg-white px-4 py-3',
          error ? 'border-[#B4453A]' : 'border-[#E6E7E1]',
        ].join(' ')}
      >
        <CalendarDays size={17} color={error ? '#B4453A' : '#63665F'} />
        <Text
          className={value ? 'text-[0.9375rem] text-[#0B0B0B]' : 'text-[0.9375rem] text-[#9B9E96]'}
        >
          {value ? dateLabel(value) : label === 'Fra dato' ? 'Velg fra dato' : 'Velg til dato'}
        </Text>
      </Pressable>
      {error ? (
        <Text className="text-[0.75rem] font-medium text-[#B4453A]">
          <AlertCircle size={12} color="#B4453A" /> {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function CreateJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string | string[] }>();
  const editId = Array.isArray(params.editId) ? params.editId[0] : params.editId;
  const isEditMode = Boolean(editId);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const categoriesQuery = useCategories();
  const locationsQuery = useLocationTree();
  const createMutation = useCreateJobMutation();
  const updateMutation = useUpdateJobMutation();
  const ownerJobsQuery = useMyJobs();
  const smartFillMutation = useSmartFillMutation();
  const analyzeImageMutation = useAnalyzeImageMutation();
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<CreateJobFormValues>(emptyValues);
  const [images, setImages] = useState<CreateJobImage[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);
  const [editUnavailable, setEditUnavailable] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSmartFill, setShowSmartFill] = useState(true);
  const [smartMinimized, setSmartMinimized] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryModal, setCategoryModal] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [newChecklist, setNewChecklist] = useState('');
  const [errors, setErrors] = useState<CreateJobErrors>({});
  const [datePicker, setDatePicker] = useState<'fromDate' | 'toDate' | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    const job = ownerJobsQuery.data?.find((item) => item._id === editId);
    if (!job) return;
    if (job.capabilities?.canEdit === false) {
      setEditUnavailable(true);
      setEditLoaded(true);
      return;
    }
    setValues({
      title: job.title || '', description: job.description || '', categories: job.categories || [], tags: job.tags || [],
      equipment: job.equipment || 'utstyrfri', maxApplicants: String(job.maxApplicants ?? 0), urgent: Boolean(job.urgent),
      address: job.location?.address || '', city: job.location?.city || '', countyCode: job.countyCode || '', municipalityCode: job.municipalityCode || '', areaCode: job.areaCode || '',
      coordinates: job.location?.coordinates?.length === 2 ? [job.location.coordinates[1], job.location.coordinates[0]] : [0, 0],
      fromDate: job.fromDate?.slice(0, 10) || '', toDate: job.toDate?.slice(0, 10) || '', durationValue: String(job.duration?.value ?? ''), durationUnit: job.duration?.unit || 'hours',
      paymentType: (job.paymentType as CreateJobFormValues['paymentType']) || 'Fastpris', price: job.price != null ? String(job.price) : '', hourlyRate: job.hourlyRate != null ? String(job.hourlyRate) : '',
      contactPhone: job.contactPhone || '', contactEmail: job.contactEmail || '', checklist: (job.checklist || []).map((item) => ({ id: item.id, text: item.text })),
    });
    setExistingImages(job.images || []);
    setImagesToDelete([]);
    setEditLoaded(true);
  }, [editId, isEditMode, ownerJobsQuery.data]);

  useEffect(() => {
    if (isEditMode) {
      setDraftLoaded(true);
      return;
    }
    void draftStorage.getItem(DRAFT_KEY).then((raw) => {
      if (raw) {
        try {
          const draft = JSON.parse(raw) as Draft;
          const { images: savedImages, coordinates, ...savedValues } = draft;
          setValues({ ...emptyValues(), ...savedValues, coordinates: coordinates ?? [0, 0] });
          setImages(savedImages ?? []);
        } catch {
          /* malformed draft is ignored */
        }
      }
      setDraftLoaded(true);
    });
  }, [isEditMode]);
  useEffect(() => {
    if (draftLoaded && !isEditMode)
      void draftStorage.setItem(DRAFT_KEY, JSON.stringify({ ...values, images } satisfies Draft));
  }, [draftLoaded, isEditMode, values, images]);

  const update = <K extends keyof CreateJobFormValues>(key: K, value: CreateJobFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key as ErrorKey];
      if (key === 'fromDate' && values.toDate && String(value) <= values.toDate) delete next.toDate;
      return next;
    });
  };
  const invalidateConfirmedLocation = <
    K extends 'address' | 'city' | 'countyCode' | 'municipalityCode' | 'areaCode',
  >(
    key: K,
    value: CreateJobFormValues[K]
  ) => {
    setValues((current) => {
      const next = { ...current, [key]: value, coordinates: [0, 0] as [number, number] };
      if (key === 'countyCode') {
        next.municipalityCode = '';
        next.areaCode = '';
      }
      if (key === 'municipalityCode') {
        next.areaCode = '';
      }
      return next;
    });

    setErrors((current) => {
      const next = { ...current };
      delete next[key as ErrorKey];
      delete next.coordinates;
      return next;
    });
  };
  const locations = locationsQuery.data ?? [];
  const county = locations.find((item) => item.code === values.countyCode);
  const municipalities = county?.children ?? [];
  const municipality = municipalities.find((item) => item.code === values.municipalityCode);
  const areas = municipality?.children ?? [];
  const categories = categoriesQuery.data?.categories ?? [];
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
  );
  const coordinatesConfirmed = values.coordinates[0] !== 0 || values.coordinates[1] !== 0;
  const duration = Number(values.durationValue) || 0;
  const rate = Number(values.hourlyRate) || 0;
  const total =
    values.durationUnit === 'days'
      ? rate * duration * 8
      : values.durationUnit === 'minutes'
        ? (rate * duration) / 60
        : rate * duration;
  const displayedPrice = values.paymentType === 'Timepris' ? total : Number(values.price) || 0;
  const phone = values.contactPhone.replace(/\D/g, '').slice(0, 8);
  const isPaidSubscriber =
    typeof user?.subscription === 'string' && user.subscription !== 'Standard';

  const validate = (target: number) => {
    const next: CreateJobErrors = {};
    if (target === 2) {
      if (!images.length && !existingImages.length) next.images = 'Vennligst last opp minst ett bilde.';
      if (values.title.trim().length < 5) next.title = 'Tittelen må være minst 5 tegn.';
      if (values.title.trim().length > 200)
        next.title = 'Tittelen kan ikke være lengre enn 200 tegn.';
      if (values.description.trim().length < 20)
        next.description = 'Beskrivelsen må være minst 20 tegn.';
      if (values.description.trim().length > 5000)
        next.description = 'Beskrivelsen kan ikke være lengre enn 5000 tegn.';
      if (!values.categories.length) next.categories = 'Vennligst velg en kategori.';
    }
    if (target === 3) {
      if (!values.address.trim()) next.address = 'Vennligst skriv inn en gateadresse.';
      if (!values.city.trim()) next.city = 'Vennligst skriv inn et sted/by.';
      if (!values.countyCode) next.countyCode = 'Vennligst velg fylke.';
      if (!values.municipalityCode) next.municipalityCode = 'Vennligst velg kommune.';
      if (!coordinatesConfirmed) next.coordinates = 'Bekreft lokasjon på kartet.';
      if (!values.fromDate) next.fromDate = 'Vennligst velg startdato.';
      if (!values.toDate) next.toDate = 'Vennligst velg sluttdato.';
      if (values.fromDate && values.toDate && values.toDate < values.fromDate)
        next.toDate = 'Sluttdato kan ikke være før startdato.';
      if (!duration || !Number.isFinite(duration))
        next.durationValue = 'Vennligst oppgi forventet varighet.';
      if (!displayedPrice || !Number.isFinite(displayedPrice))
        next.price =
          values.paymentType === 'Timepris'
            ? 'Oppgi en timepris og varighet som gir en totalpris over 0 kr.'
            : 'Vennligst oppgi et beløp større enn 0 kr.';
    }
    if (target === 5) {
      if (phone && phone.length !== 8) next.phone = 'Et norsk nummer har åtte siffer.';
      if (
        values.contactEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())
      )
        next.email = 'Vennligst skriv inn en gyldig e-post.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const pickImages = async () => {
    const room = 6 - existingImages.length - images.length;
    if (!room) return Alert.alert('Maks 6 bilder', 'Du kan laste opp inntil 6 bilder.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.85,
    });
    if (!result.canceled)
      setImages((current) => [
        ...current,
        ...result.assets
          .slice(0, room)
          .map((asset, index) => ({
            uri: asset.uri,
            name: asset.fileName ?? `jobb-${Date.now()}-${index}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          })),
      ]);
  };
  const confirmAddress = async () => {
    if (isGeocoding) return;
    if (!values.address.trim()) {
      setErrors((current) => ({ ...current, address: 'Vennligst skriv inn en gateadresse.' }));
      return;
    }

    const query = [
      values.address.trim(),
      values.city.trim(),
      municipality?.name,
      county?.name,
      'Norway',
    ]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(', ');

    setValues((current) => ({ ...current, coordinates: [0, 0] }));
    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(query);
      const point = results[0];
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
        setErrors((current) => ({
          ...current,
          coordinates: 'Kunne ikke finne denne adressen. Kontroller adressen og prøv igjen.',
        }));
        return;
      }

      update('coordinates', [point.latitude, point.longitude]);
    } catch {
      setErrors((current) => ({
        ...current,
        coordinates: 'Kunne ikke finne denne adressen. Kontroller adressen og prøv igjen.',
      }));
    } finally {
      setIsGeocoding(false);
    }
  };
  const smartFill = (prompt: string) => {
    if (!prompt.trim()) return;
    smartFillMutation.mutate(
      {
        prompt: prompt.trim(),
        context: {
          title: values.title,
          description: values.description,
          category: values.categories[0],
          paymentType: values.paymentType,
          duration: values.durationValue
            ? { value: values.durationValue, unit: values.durationUnit }
            : undefined,
          city: values.city,
          countyCode: values.countyCode,
          equipment: values.equipment,
          urgent: values.urgent,
        },
      },
      {
        onSuccess: (result) => {
          update('title', result.title || values.title);
          update('description', result.description || values.description);
          if (result.category) update('categories', [result.category]);
          if (result.skills?.length) update('tags', result.skills);
          if (result.duration?.value) {
            update('durationValue', String(result.duration.value));
            update('durationUnit', result.duration.unit);
          }
          if (result.paymentType) update('paymentType', result.paymentType);
          if (result.hourlyRate) update('hourlyRate', String(result.hourlyRate));
          if (result.suggestedPrice || result.estimatedPrice)
            update('price', String(result.suggestedPrice ?? result.estimatedPrice));
          setSmartPrompt('');
          Alert.alert(
            'Smart-utfylling ferdig',
            'Feltene er fylt ut. Sjekk opplysningene før du går videre.'
          );
        },
        onError: (error) => Alert.alert('Smart-utfylling feilet', getError(error) ?? 'Prøv igjen.'),
      }
    );
  };
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !values.tags.includes(tag)) update('tags', [...values.tags, tag]);
    setTagInput('');
  };
  const addChecklist = () => {
    const text = newChecklist.trim();
    if (!text || values.checklist.length >= 10) return;
    update('checklist', [
      ...values.checklist,
      { id: `${Date.now()}-${values.checklist.length}`, text: text.slice(0, 300) },
    ]);
    setNewChecklist('');
  };
  const moveChecklist = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= values.checklist.length) return;
    const next = [...values.checklist];
    [next[index], next[target]] = [next[target], next[index]];
    update('checklist', next);
  };
  const publish = () => {
    if (!validate(2) || !validate(3) || !validate(5)) return;
    if (isEditMode && editId) {
      updateMutation.mutate(
        { serviceId: editId, values: { ...values, contactPhone: phone }, images, imagesToDelete },
        {
          onSuccess: () => Alert.alert('Oppdrag oppdatert', 'Endringene dine er lagret.', [{ text: 'OK', onPress: () => router.back() }]),
          onError: (error) => Alert.alert('Kunne ikke oppdatere', getError(error) ?? 'Prøv igjen. Utkastet er beholdt.'),
        }
      );
      return;
    }
    createMutation.mutate(
      { values: { ...values, contactPhone: phone }, images },
      {
        onSuccess: async () => {
          await draftStorage.removeItem(DRAFT_KEY);
          setValues(emptyValues());
          setImages([]);
          Alert.alert('Oppdrag publisert!', 'Oppdraget er synlig for andre.', [
            { text: 'OK', onPress: () => router.replace('/(app)') },
          ]);
        },
        onError: (error) =>
          Alert.alert(
            'Kunne ikke publisere',
            getError(error) ?? 'Prøv igjen. Utkastet er beholdt.'
          ),
      }
    );
  };
  const discard = () =>
    isEditMode
      ? router.back()
      :
      Alert.alert('Forkast utkast?', 'Utkastet blir slettet.', [
        { text: 'Fortsett å redigere' },
        {
          text: 'Forkast',
          style: 'destructive',
          onPress: () => {
            void draftStorage.removeItem(DRAFT_KEY);
            setValues(emptyValues());
            setImages([]);
            router.replace('/(app)');
          },
        },
      ]);
  const next = () => {
    if (step < 4) {
      if (validate(step + 1)) setStep(step + 1);
    } else publish();
  };
  const handleDateChange = (_event: DateTimePickerChangeEvent, selected?: Date) => {
    if (!selected || !datePicker) return;
    const value = dateValue(selected);
    update(datePicker, value);
    if (datePicker === 'fromDate' && values.toDate && values.toDate < value) update('toDate', '');
    setDatePicker(null);
  };
  const saving = createMutation.isPending || updateMutation.isPending;

  if (isEditMode && ownerJobsQuery.isLoading && !editLoaded) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6641" size="large" /><Text className="mt-3 text-sm text-[#63665F]">Laster oppdrag...</Text></View></SafeAreaView>;
  }
  if (isEditMode && ownerJobsQuery.isError) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Kunne ikke laste oppdraget" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void ownerJobsQuery.refetch()} /></SafeAreaView>;
  }
  if (isEditMode && !editLoaded) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Oppdraget ble ikke funnet" message="Annonsen er ikke tilgjengelig for redigering." actionLabel="Tilbake" onAction={() => router.back()} /></SafeAreaView>;
  }
  if (isEditMode && editUnavailable) {
    return <SafeAreaView className="flex-1 bg-[#EFF0EA]"><ErrorState title="Oppdraget kan ikke redigeres" message={ownerJobsQuery.data?.find((item) => item._id === editId)?.capabilities?.blockedReason ?? 'Serveren tillater ikke redigering av dette oppdraget.'} actionLabel="Tilbake" onAction={() => router.back()} /></SafeAreaView>;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#63665F]">
            {isEditMode ? 'Rediger oppdrag' : 'Nytt oppdrag'}
          </Text>
          <Text className="mt-2 text-[1.9rem] font-bold leading-tight text-[#0B0B0B]">
            {isEditMode ? 'Rediger oppdraget ditt' : 'Legg ut et oppdrag'}
          </Text>
          <Text className="mt-2 text-[0.9375rem] leading-relaxed text-[#63665F]">
            Fire korte steg. Du kan forhåndsvise underveis, og utkastet lagres automatisk.
          </Text>
          <View className="mt-6">
            <View className="mb-3 flex-row items-baseline justify-between">
              <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                {STEPS[step - 1]}
              </Text>
              <Text className="text-[0.8125rem] text-[#63665F]">Steg {step} av 4</Text>
            </View>
            <View className="flex-row gap-1.5">
              {STEPS.map((label, index) => (
                <Pressable
                  key={label}
                  disabled={index + 1 > step}
                  onPress={() => setStep(index + 1)}
                  className="flex-1"
                >
                  <View
                    className={[
                      'h-1 rounded-full',
                      index + 1 <= step ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]',
                    ].join(' ')}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {step === 1 ? (
            <View className="mt-6 gap-5">
              {showSmartFill ? (
                <View className="rounded-3xl bg-white p-5">
                  {smartMinimized ? (
                    <View className="flex-row items-center justify-between">
                      <Pressable
                        onPress={() => setSmartMinimized(false)}
                        className="flex-1 flex-row items-center gap-3"
                      >
                        <Sparkles size={18} color="#2E6641" />
                        <View>
                          <Text className="font-semibold text-[#0B0B0B]">Smart-utfylling</Text>
                          <Text className="text-[0.75rem] text-[#63665F]">Klikk for å utvide</Text>
                        </View>
                      </Pressable>
                      <Pressable onPress={() => setShowSmartFill(false)}>
                        <X size={18} color="#63665F" />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 flex-row items-center gap-3">
                          <Sparkles size={18} color="#2E6641" />
                          <View>
                            <Text className="font-semibold text-[#0B0B0B]">Smart-utfylling</Text>
                            <Text className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                              Beskriv oppdraget, så fyller vi ut resten for deg.
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row gap-3">
                          <Pressable onPress={() => setSmartMinimized(true)}>
                            <ChevronDown size={18} color="#63665F" />
                          </Pressable>
                          <Pressable onPress={() => setShowSmartFill(false)}>
                            <X size={18} color="#63665F" />
                          </Pressable>
                        </View>
                      </View>
                      <TextInput
                        value={smartPrompt}
                        onChangeText={setSmartPrompt}
                        placeholder="F.eks. Male en liten bod på 8 m² utvendig"
                        placeholderTextColor="#9B9E96"
                        multiline
                        className="mt-4 min-h-[80px] rounded-2xl border border-[#E6E7E1] bg-white p-3 text-[0.875rem]"
                      />
                      <View className="mt-3 flex-row gap-2">
                        <Button
                          label={smartFillMutation.isPending ? 'Fyller ut...' : 'Fyll ut nå'}
                          onPress={() => smartFill(smartPrompt)}
                          disabled={smartFillMutation.isPending || !smartPrompt.trim()}
                          small
                          icon={<Sparkles size={15} color="#FFF" />}
                        />
                        <Button
                          label="Avbryt"
                          onPress={() => setSmartPrompt('')}
                          small
                          variant="secondary"
                        />
                      </View>
                    </>
                  )}
                </View>
              ) : null}
              <View className="rounded-3xl bg-white p-5">
                <Text className="font-semibold text-[#0B0B0B]">Bilder · påkrevd</Text>
                <Text className="mt-1 text-[0.8125rem] text-[#63665F]">
                  Vis frem oppdraget med inntil 6 bilder
                </Text>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  {existingImages.map((imageUrl) => (
                    <View key={imageUrl} className="relative h-24 w-[31%] overflow-hidden rounded-xl">
                      <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
                      <Pressable onPress={() => { setExistingImages((current) => current.filter((url) => url !== imageUrl)); setImagesToDelete((current) => [...current, imageUrl]); }} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"><X size={13} color="#FFF" /></Pressable>
                    </View>
                  ))}
                  {images.map((image, index) => (
                    <View
                      key={`${image.uri}-${index}`}
                      className="relative h-24 w-[31%] overflow-hidden rounded-xl"
                    >
                      <Image
                        source={{ uri: image.uri }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                      >
                        <X size={13} color="#FFF" />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => void pickImages()}
                    className="h-24 w-[31%] items-center justify-center rounded-xl border-2 border-dashed border-[#D1D5DC]"
                  >
                    <Camera size={22} color="#2E6641" />
                    <Text className="mt-1 text-[0.6875rem] text-[#63665F]">Last opp</Text>
                  </Pressable>
                </View>
                {/* AI analyze button — shown when at least one image is selected */}
                {(images.length > 0 || existingImages.length > 0) && (
                  <Pressable
                    onPress={() => {
                      const img = images[0] ?? null;
                      if (!img) return;
                      analyzeImageMutation.mutate(
                        { uri: img.uri, name: img.name, type: img.type },
                        {
                          onSuccess: (result) => {
                            if (result.title) update('title', result.title);
                            if (result.description) update('description', result.description);
                            if (result.category) update('categories', [result.category]);
                            if (result.duration?.value) {
                              update('durationValue', String(result.duration.value));
                              update('durationUnit', result.duration.unit);
                            }
                            if (result.suggestedPrice) update('price', String(result.suggestedPrice));
                            if (result.hourlyRate) update('hourlyRate', String(result.hourlyRate));
                            Alert.alert(
                              'AI-analyse ferdig',
                              'Feltene er fylt ut basert på bildet. Sjekk og juster før du går videre.',
                            );
                          },
                          onError: (error) =>
                            Alert.alert('Analyse feilet', getError(error) ?? 'Prøv igjen.'),
                        },
                      );
                    }}
                    disabled={analyzeImageMutation.isPending}
                    className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-[#2E6641] bg-[#EAF1E9] px-4 py-3"
                  >
                    {analyzeImageMutation.isPending ? (
                      <ActivityIndicator size="small" color="#2E6641" />
                    ) : (
                      <Sparkles size={16} color="#2E6641" />
                    )}
                    <Text className="text-[0.875rem] font-semibold text-[#2E6641]">
                      {analyzeImageMutation.isPending ? 'Analyserer bilde...' : 'Analyser bilde med AI'}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View className="gap-4 rounded-3xl bg-white p-5">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-[#0B0B0B]">Grunnleggende informasjon</Text>
                  <Pressable
                    onPress={() => smartFill(values.title)}
                    disabled={!values.title.trim() || smartFillMutation.isPending}
                  >
                    <Text className="text-[0.75rem] font-semibold text-[#2E6641]">
                      Generer med AI
                    </Text>
                  </Pressable>
                </View>
                <Field
                  label="Tittel"
                  value={values.title}
                  onChangeText={(value) => update('title', value.slice(0, 200))}
                  placeholder="Hva trenger du hjelp med?"
                  helper={`${values.title.length}/200`}
                  error={errors.title}
                />
                <View className="gap-2">
                  <Text className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#63665F]">
                    Kategori
                  </Text>
                  <Pressable
                    onPress={() => setCategoryModal(true)}
                    className={[
                      'flex-row items-center justify-between rounded-xl border bg-white px-4 py-3',
                      errors.categories ? 'border-[#B4453A]' : 'border-[#E6E7E1]',
                    ].join(' ')}
                  >
                    <Text className="text-[0.9375rem] text-[#0B0B0B]">
                      {values.categories[0] || 'Velg kategori'}
                    </Text>
                    <ChevronDown size={16} color="#63665F" />
                  </Pressable>
                  {errors.categories ? (
                    <Text className="text-[0.75rem] font-medium text-[#B4453A]">
                      <AlertCircle size={12} color="#B4453A" /> {errors.categories}
                    </Text>
                  ) : null}
                </View>
                <Field
                  label="Beskrivelse"
                  value={values.description}
                  onChangeText={(value) => update('description', value.slice(0, 5000))}
                  placeholder="Beskriv oppdraget i detalj"
                  multiline
                  helper={`${values.description.length}/5000`}
                  error={errors.description}
                />
                <Field
                  label="Tags / ferdigheter"
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Skriv en tagg"
                />
                <Button
                  label="Legg til tagg"
                  onPress={addTag}
                  small
                  variant="secondary"
                  icon={<Plus size={15} color="#0B0B0B" />}
                />
                {values.tags.length ? (
                  <Text className="text-[0.75rem] text-[#63665F]">{values.tags.join(' · ')}</Text>
                ) : null}
                <Select
                  value={values.equipment}
                  options={EQUIPMENT}
                  placeholder="Utstyr"
                  onValueChange={(value) =>
                    update('equipment', value as CreateJobFormValues['equipment'])
                  }
                />
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View className="mt-6 gap-5">
              <View className="gap-4 rounded-3xl bg-white p-5">
                <Text className="font-semibold text-[#0B0B0B]">Tid & sted</Text>
                <Field
                  label="Gateadresse"
                  value={values.address}
                  error={errors.address}
                  onChangeText={(value) => invalidateConfirmedLocation('address', value)}
                  placeholder="F.eks. Storgata 1"
                  helper={
                    coordinatesConfirmed
                      ? 'Lokasjon bekreftet'
                      : 'Søk opp adressen og bekreft lokasjonen'
                  }
                />
                <Button
                  label={
                    isGeocoding
                      ? 'Finner lokasjon...'
                      : coordinatesConfirmed
                        ? 'Lokasjon bekreftet'
                        : 'Bekreft lokasjon'
                  }
                  onPress={() => void confirmAddress()}
                  disabled={isGeocoding}
                  small
                  variant="secondary"
                  icon={<MapPin size={15} color="#2E6641" />}
                />
                {errors.coordinates ? (
                  <Text className="text-[0.75rem] font-medium text-[#B4453A]">
                    <AlertCircle size={12} color="#B4453A" /> {errors.coordinates}
                  </Text>
                ) : null}
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Select
                      value={values.countyCode}
                      options={locations.map((item) => ({ label: item.name, value: item.code }))}
                      placeholder="Fylke"
                      onValueChange={(value) => invalidateConfirmedLocation('countyCode', value)}
                    />
                    {errors.countyCode ? (
                      <Text className="text-[0.75rem] font-medium text-[#B4453A]">Velg fylke.</Text>
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <Select
                      value={values.municipalityCode}
                      options={municipalities.map((item) => ({
                        label: item.name,
                        value: item.code,
                      }))}
                      placeholder="Kommune"
                      onValueChange={(value) => invalidateConfirmedLocation('municipalityCode', value)}
                    />
                    {errors.municipalityCode ? (
                      <Text className="text-[0.75rem] font-medium text-[#B4453A]">
                        Velg kommune.
                      </Text>
                    ) : null}
                  </View>
                </View>
                {areas.length ? (
                  <Select
                    value={values.areaCode}
                    options={areas.map((item) => ({ label: item.name, value: item.code }))}
                    placeholder="Bydel / Område"
                    onValueChange={(value) => invalidateConfirmedLocation('areaCode', value)}
                  />
                ) : null}
                <Field
                  label="By / Sted"
                  value={values.city}
                  onChangeText={(value) => invalidateConfirmedLocation('city', value)}
                  placeholder="By eller sted"
                  error={errors.city}
                />
                <CreateJobLocationMap
                  coordinates={values.coordinates}
                  onCoordinatesChange={(coordinates) => update('coordinates', coordinates)}
                  error={errors.coordinates}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <DateField
                      label="Fra dato"
                      value={values.fromDate}
                      error={errors.fromDate}
                      onPress={() => setDatePicker('fromDate')}
                    />
                  </View>
                  <View className="flex-1">
                    <DateField
                      label="Til dato"
                      value={values.toDate}
                      error={errors.toDate}
                      onPress={() => setDatePicker('toDate')}
                    />
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Field
                      label="Varighet"
                      value={values.durationValue}
                      onChangeText={(value) => update('durationValue', value)}
                      placeholder="0"
                      keyboardType="numeric"
                      error={errors.durationValue}
                    />
                    <Select
                      value={values.durationUnit}
                      options={DURATIONS}
                      placeholder="Enhet"
                      onValueChange={(value) => update('durationUnit', value as DurationUnit)}
                    />
                  </View>
                </View>
              </View>
              <View className="gap-4 rounded-3xl bg-white p-5">
                <Text className="font-semibold text-[#0B0B0B]">Betaling</Text>
                <Text className="text-[0.8125rem] text-[#63665F]">
                  Hvordan vil du avtale prisen?
                </Text>
                <View className="gap-2.5">
                  {PAYMENT_CARDS.map((card) => {
                    const Icon = card.icon;
                    const active = values.paymentType === card.value;
                    return (
                      <Pressable
                        key={card.value}
                        onPress={() => update('paymentType', card.value)}
                        className={[
                          'rounded-2xl border p-4',
                          active ? 'border-[#2E6641] bg-[#EAF1E9]' : 'border-[#E6E7E1] bg-white',
                        ].join(' ')}
                      >
                        <View
                          className={[
                            'mb-2 h-9 w-9 items-center justify-center rounded-xl',
                            active ? 'bg-[#2E6641]' : 'bg-[#F4F6F0]',
                          ].join(' ')}
                        >
                          <Icon size={16} color={active ? '#FFF' : '#63665F'} />
                        </View>
                        <Text
                          className={[
                            'font-semibold',
                            active ? 'text-[#2E6641]' : 'text-[#0B0B0B]',
                          ].join(' ')}
                        >
                          {card.label}
                        </Text>
                        <Text className="mt-0.5 text-[0.75rem] text-[#63665F]">
                          {card.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Field
                  label={`${values.paymentType === 'Timepris' ? 'Timepris' : values.paymentType === 'Anbud' ? 'Antatt budsjett' : 'Fastpris'} · påkrevd`}
                  value={values.paymentType === 'Timepris' ? values.hourlyRate : values.price}
                  onChangeText={(value) =>
                    update(values.paymentType === 'Timepris' ? 'hourlyRate' : 'price', value)
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  error={errors.price}
                />
                {values.paymentType === 'Timepris' ? (
                  <View className="flex-row items-center justify-between rounded-xl bg-[#F4F6F0] px-4 py-3">
                    <Text className="flex-1 text-[0.8125rem] text-[#63665F]">
                      Beregnet totalpris for oppgitt varighet
                    </Text>
                    <Text className="font-bold text-[#0B0B0B]">
                      {total.toLocaleString('nb-NO')} kr
                    </Text>
                  </View>
                ) : null}
                {values.paymentType === 'Timepris' ? (
                  <Text className="text-[0.75rem] text-[#63665F]">kr per time</Text>
                ) : null}
                {values.paymentType === 'Anbud' ? (
                  <Text className="text-[0.8125rem] leading-relaxed text-[#63665F]">
                    Budsjettet vises til de som gir tilbud. Du binder deg ikke til beløpet.
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between rounded-2xl bg-[#F4F6F0] p-3">
                  <View className="flex-1 flex-row items-center gap-3">
                    <Zap size={17} color="#2E6641" />
                    <View>
                      <Text className="font-semibold text-[#0B0B0B]">Haster oppdraget?</Text>
                      <Text className="text-[0.75rem] text-[#63665F]">
                        Merkes med «Haster» og løftes høyere i søket.
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={values.urgent && isPaidSubscriber}
                    disabled={!isPaidSubscriber}
                    onValueChange={(value) => {
                      if (!isPaidSubscriber) {
                        Alert.alert('Haster er kun tilgjengelig for betalte abonnementer');
                        return;
                      }
                      update('urgent', value);
                    }}
                  />
                </View>
                <Field
                  label="Maks antall søkere"
                  value={values.maxApplicants}
                  onChangeText={(value) => update('maxApplicants', value)}
                  placeholder="0 = ubegrenset"
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View className="mt-6 rounded-3xl bg-white p-5">
              <View className="flex-row items-center gap-3">
                <ListChecks size={22} color="#2E6641" />
                <View>
                  <Text className="text-lg font-bold text-[#0B0B0B]">
                    Legg til sjekkliste{' '}
                    <Text className="font-normal text-[#63665F]">(valgfritt)</Text>
                  </Text>
                  <Text className="text-[0.8125rem] text-[#63665F]">
                    Opprett en dynamisk sjekkliste for jobben (1-10 elementer)
                  </Text>
                </View>
              </View>
              <View className="mt-5 flex-row gap-2">
                <TextInput
                  value={newChecklist}
                  onChangeText={setNewChecklist}
                  placeholder="Legg til sjekklisteelement..."
                  placeholderTextColor="#9B9E96"
                  className="flex-1 rounded-xl border border-[#E6E7E1] px-3 py-3"
                />
                <Pressable
                  onPress={addChecklist}
                  disabled={!newChecklist.trim() || values.checklist.length >= 10}
                  className="h-12 w-12 items-center justify-center rounded-xl bg-[#2E6641] disabled:opacity-50"
                >
                  <Plus size={20} color="#FFF" />
                </Pressable>
              </View>
              {values.checklist.map((item, index) => (
                <View
                  key={item.id}
                  className="mt-3 flex-row items-center gap-2 rounded-xl border border-[#E6E7E1] bg-[#F4F6F0] p-3"
                >
                  <View className="gap-1">
                    <Pressable onPress={() => moveChecklist(index, -1)} disabled={index === 0}>
                      <ArrowUp size={16} color={index === 0 ? '#D1D5DC' : '#63665F'} />
                    </Pressable>
                    <Pressable
                      onPress={() => moveChecklist(index, 1)}
                      disabled={index === values.checklist.length - 1}
                    >
                      <ArrowDown
                        size={16}
                        color={index === values.checklist.length - 1 ? '#D1D5DC' : '#63665F'}
                      />
                    </Pressable>
                  </View>
                  <TextInput
                    value={item.text}
                    onChangeText={(text) =>
                      update(
                        'checklist',
                        values.checklist.map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, text: text.slice(0, 300) }
                            : current
                        )
                      )
                    }
                    className="flex-1 rounded-lg border border-[#E6E7E1] bg-white px-3 py-2"
                  />
                  <Pressable
                    onPress={() =>
                      update(
                        'checklist',
                        values.checklist.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                  >
                    <Trash2 size={18} color="#B4453A" />
                  </Pressable>
                </View>
              ))}
              {!values.checklist.length ? (
                <Text className="py-8 text-center text-[0.875rem] text-[#9B9E96]">
                  Ingen sjekklisteelementer lagt til ennå
                </Text>
              ) : null}
            </View>
          ) : null}

          {step === 4 ? (
            <View className="mt-6 gap-5">
              <View className="gap-4 rounded-3xl bg-white p-5">
                <Text className="text-lg font-bold text-[#0B0B0B]">
                  Kontaktinformasjon (Valgfritt)
                </Text>
                <Field
                  label="Telefonnummer"
                  value={phone ? `+47 ${phone}` : ''}
                  onChangeText={(value) =>
                    update('contactPhone', value.replace(/\D/g, '').slice(0, 8))
                  }
                  placeholder="+47 412 34 567"
                  keyboardType="phone-pad"
                  helper="Et norsk nummer har åtte siffer."
                />
                <Field
                  label="E-post"
                  value={values.contactEmail}
                  onChangeText={(value) => update('contactEmail', value)}
                  placeholder="din@epost.no"
                  keyboardType="email-address"
                  error={errors.email}
                />
              </View>
              <View className="gap-4 rounded-3xl bg-white p-5">
                <Text className="text-lg font-bold text-[#0B0B0B]">Oppsummering</Text>
                <Text className="text-[0.75rem] text-[#63665F]">Tittel</Text>
                <Text className="font-semibold text-[#0B0B0B]">{values.title || '—'}</Text>
                <Text className="text-[0.75rem] text-[#63665F]">Kategori</Text>
                <Text className="font-semibold text-[#0B0B0B]">
                  {values.categories.join(', ') || '—'}
                </Text>
                <Text className="text-[0.75rem] text-[#63665F]">Sted</Text>
                <Text className="font-semibold text-[#0B0B0B]">
                  {values.address || '—'}, {values.city || '—'}
                </Text>
                <Text className="text-[0.75rem] text-[#63665F]">Pris</Text>
                <Text className="font-semibold text-[#0B0B0B]">
                  {displayedPrice.toLocaleString('nb-NO')} kr ({values.paymentType})
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-[#E6E7E1] bg-[#EFF0EA] px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={step === 1 ? discard : () => setStep(step - 1)}
              disabled={saving}
              className="h-11 flex-1 flex-row items-center justify-center gap-1"
            >
              <ArrowLeft size={17} color="#63665F" />
              <Text className="text-[0.8125rem] font-medium text-[#63665F]">
                {step === 1 ? 'Avbryt' : 'Tilbake'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowPreview(true)}
              disabled={saving}
              className="h-11 flex-1 flex-row items-center justify-center gap-1 rounded-full border border-[#E6E7E1] bg-white"
            >
              <Eye size={16} color="#0B0B0B" />
              <Text className="text-[0.75rem] font-medium text-[#0B0B0B]">Forhåndsvis</Text>
            </Pressable>
            <Pressable
              onPress={next}
              disabled={saving}
              className="h-11 flex-1 flex-row items-center justify-center gap-1 rounded-full bg-[#2E6641]"
            >
              <Text className="text-[0.75rem] font-semibold text-white">
                {saving
                  ? isEditMode ? 'Lagrer…' : 'Publiserer…'
                  : step === 4
                    ? isEditMode ? 'Lagre endringer' : 'Publiser oppdrag'
                    : 'Neste'}
              </Text>
              {step < 4 ? <ChevronRight size={17} color="#FFF" /> : null}
            </Pressable>
          </View>
        </View>
        {datePicker ? (
          <View className="absolute bottom-20 left-4 right-4 rounded-2xl border border-[#E6E7E1] bg-white p-2">
            <DateTimePicker
              value={localDate(datePicker === 'fromDate' ? values.fromDate : values.toDate)}
              mode="date"
              presentation="dialog"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleDateChange}
              onDismiss={() => setDatePicker(null)}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal
        visible={categoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModal(false)}
      >
        <View className="flex-1 justify-end bg-black/25">
          <View className="max-h-[80%] rounded-t-3xl bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-[#0B0B0B]">Velg kategori</Text>
              <Pressable onPress={() => setCategoryModal(false)}>
                <X size={20} color="#63665F" />
              </Pressable>
            </View>
            <TextInput
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Søk i kategorier..."
              placeholderTextColor="#9B9E96"
              className="mt-4 rounded-xl border border-[#E6E7E1] px-4 py-3"
            />
            <ScrollView className="mt-3">
              {categoriesQuery.isLoading ? (
                <Text className="py-6 text-center text-[#63665F]">Laster kategorier...</Text>
              ) : categoriesQuery.isError ? (
                <Text className="py-6 text-center text-[#B4453A]">Kunne ikke laste kategorier</Text>
              ) : filteredCategories.length ? (
                filteredCategories.map((category) => (
                  <Pressable
                    key={category._id}
                    onPress={() => {
                      update('categories', [category.name]);
                      setCategoryModal(false);
                    }}
                    className="border-b border-[#E6E7E1] px-2 py-4"
                  >
                    <Text className="text-[0.9375rem] text-[#0B0B0B]">{category.name}</Text>
                  </Pressable>
                ))
              ) : (
                <Text className="py-6 text-center text-[#63665F]">Ingen treff</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showPreview}
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaView className="flex-1 bg-[#EFF0EA]">
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-[#0B0B0B]">Forhåndsvisning</Text>
              <Pressable onPress={() => setShowPreview(false)}>
                <X size={20} color="#63665F" />
              </Pressable>
            </View>
            {existingImages[0] || images[0] ? (
              <Image
                source={{ uri: existingImages[0] || images[0].uri }}
                className="h-56 w-full rounded-2xl"
                resizeMode="cover"
              />
            ) : (
              <View className="h-56 items-center justify-center rounded-2xl bg-[#E6E7E1]">
                <Text className="text-[#63665F]">Ingen bilde</Text>
              </View>
            )}
            <View className="mt-4 rounded-2xl bg-white p-5">
              <Text className="text-2xl font-bold text-[#0B0B0B]">
                {values.title || 'Uten tittel'}
              </Text>
              <Text className="mt-2 text-[#63665F]">
                {values.city || 'Ikke angitt'} · {displayedPrice.toLocaleString('nb-NO')} kr
              </Text>
              <Text className="mt-4 leading-relaxed text-[#63665F]">
                {values.description || 'Ingen beskrivelse tilgjengelig'}
              </Text>
              <Text className="mt-4 font-semibold text-[#0B0B0B]">Detaljer</Text>
              <Text className="mt-2 text-[#63665F]">
                {values.categories.join(', ') || 'Generelt'} · {values.durationValue || '—'}{' '}
                {values.durationUnit}
              </Text>
              <Text className="mt-1 text-[#63665F]">
                {values.address || 'Lokasjon ikke angitt'}
              </Text>
              {values.tags.length ? (
                <Text className="mt-3 text-[#63665F]">Tags: {values.tags.join(' � ')}</Text>
              ) : null}
              <Text className="mt-1 text-[#63665F]">
                {values.urgent ? 'Haster' : 'Vanlig prioritet'}
              </Text>
              {values.checklist.length ? (
                <View className="mt-3">
                  <Text className="font-semibold text-[#0B0B0B]">Sjekkliste</Text>
                  {values.checklist.map((item) => (
                    <Text key={item.id} className="mt-1 text-[#63665F]">
                      � {item.text}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
