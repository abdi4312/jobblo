import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@expo/ui/community/datetime-picker';
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Banknote,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Gavel,
  Image as ImageIcon,
  Info,
  ListChecks,
  Lock,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useCategories } from '../../src/hooks/useCategories';
import { useLocationTree } from '../../src/hooks/useLocationTree';
import { useCreateJobMutation, useUpdateJobMutation } from '../../src/hooks/useCreateJob';
import { useMyJobs } from '../../src/hooks/useMyJobs';
import { useSmartFillMutation, useAnalyzeImageMutation } from '../../src/hooks/useSmartFill';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { CreateJobLocationMap } from '../../src/components/create-job/CreateJobLocationMap';
import { AddressSearchField } from '../../src/components/create-job/AddressSearchField';
import { addressAt, type AddressHit } from '../../src/services/geonorge.service';
import { Select } from '../../src/components/ui/Select';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Chip } from '../../src/components/ui/Chip';
import { Field } from '../../src/components/ui/Field';
import { Stepper } from '../../src/components/ui/Stepper';
import { NyAnnonseSheet } from '../../src/components/create-job/NyAnnonseSheet';
import { draftStorage } from '../../src/utils/draftStorage';
import {
  validateCreateJobStep,
  type CreateJobErrorKey,
  type CreateJobErrors,
} from '../../src/utils/createJobValidation';
import { useAuthStore } from '../../src/store/authStore';
import * as Haptics from 'expo-haptics';
import type {
  CreateJobFormValues,
  CreateJobImage,
  DurationUnit,
  PaymentType,
} from '../../src/services/createJob.service';
import { LoadingIndicator } from '../../src/components/ui/LoadingIndicator';
import { TC, tc } from '../../src/theme/colors';

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

type Draft = Omit<CreateJobFormValues, 'coordinates'> & {
  coordinates: [number, number] | null;
  images: CreateJobImage[];
};
type ErrorKey = CreateJobErrorKey;
function emptyValues(): CreateJobFormValues {
  return {
    title: '',
    description: '',
    categories: [],
    tags: [],
    equipment: 'utstyrfri',
    customerType: '',
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
function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateLabel(value: string) {
  if (!value) return '';
  return localDate(value).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Date input styled like <Field>: label, 8px-radius box with a calendar icon, error. */
function DateField({
  label,
  value,
  placeholder,
  error,
  onPress,
  optional = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  onPress: () => void;
  optional?: boolean;
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-[0.8125rem] font-semibold text-ink">
        {label}
        {optional ? null : <Text className="text-danger"> *</Text>}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={`h-11 flex-row items-center gap-2 rounded-lg border bg-surface px-3 ${error ? 'border-danger' : 'border-line'}`}
      >
        <CalendarDays size={16} color={error ? TC.danger : tc('#63665F', 'muted')} />
        <Text numberOfLines={1} className={value ? 'text-[0.9375rem] text-ink' : 'text-[0.9375rem] text-subtle'}>
          {value ? dateLabel(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text className="text-[0.8125rem] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}

/** A form section: 12px-radius card with an icon, title and optional subtitle. */
function Section({
  icon: Icon,
  title,
  subtitle,
  right,
  onLayout,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onLayout?: ViewProps['onLayout'];
  children: React.ReactNode;
}) {
  return (
    // No card: sections sit on the page, divided by a hairline and white space.
    <View className="border-t border-line pb-2 pt-5" onLayout={onLayout}>
      <View className="mb-4 flex-row items-start gap-3">
        <Icon size={20} color={TC.brandText} style={{ marginTop: 2 }} />
        <View className="min-w-0 flex-1">
          <Text className="text-[1.0625rem] font-semibold text-ink">{title}</Text>
          {subtitle ? <Text className="mt-0.5 text-[0.875rem] leading-5 text-muted">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View className="gap-4">{children}</View>
    </View>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
      <Info size={14} color={tc('#63665F', 'muted')} style={{ marginTop: 2 }} />
      <Text className="flex-1 text-[0.8125rem] leading-5 text-muted">{children}</Text>
    </View>
  );
}

function ErrorText({ children }: { children?: string }) {
  return children ? <Text className="text-[0.8125rem] font-medium text-danger">{children}</Text> : null;
}

export default function CreateJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string | string[] }>();
  const editId = Array.isArray(params.editId) ? params.editId[0] : params.editId;
  const isEditMode = Boolean(editId);
  const user = useAuthStore((state) => state.user);
  const categoriesQuery = useCategories();
  const locationsQuery = useLocationTree();
  const createMutation = useCreateJobMutation();
  const updateMutation = useUpdateJobMutation();
  const ownerJobsQuery = useMyJobs();
  const smartFillMutation = useSmartFillMutation();
  const analyzeImageMutation = useAnalyzeImageMutation();
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  // This tab stays mounted in the background; a Modal would still show there.
  const isFocused = useIsFocused();
  /** Set after a successful publish: the success screen shows instead of the form. */
  const [publishedId, setPublishedId] = useState<string | null>(null);
  // This tab stays mounted: leaving it must not keep the success screen for the next visit.
  useFocusEffect(useCallback(() => () => setPublishedId(null), []));
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
  const [tagInput, setTagInput] = useState('');
  const [newChecklist, setNewChecklist] = useState('');
  const [errors, setErrors] = useState<CreateJobErrors>({});
  const [datePicker, setDatePicker] = useState<'fromDate' | 'toDate' | null>(null);
  const [lookingUpAddress, setLookingUpAddress] = useState(false);

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
      equipment: job.equipment || 'utstyrfri', customerType: job.customerType || 'private', maxApplicants: String(job.maxApplicants ?? 0), urgent: Boolean(job.urgent),
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
          // Coordinates without an address are not a confirmed location (and may be a stale point).
          setValues({ ...emptyValues(), ...savedValues, coordinates: savedValues.address?.trim() && coordinates ? coordinates : [0, 0] });
          setImages(savedImages ?? []);
        } catch {
          /* malformed draft is ignored */
        }
      }
      setDraftLoaded(true);
    });
  }, [isEditMode]);
  useEffect(() => {
    if (!draftLoaded || isEditMode) return;
    // An untouched form is not a draft: writing it back after a publish/discard made the
    // next visit restore an empty "draft".
    if (JSON.stringify(values) === JSON.stringify(emptyValues()) && !images.length) void draftStorage.removeItem(DRAFT_KEY);
    else void draftStorage.setItem(DRAFT_KEY, JSON.stringify({ ...values, images } satisfies Draft));
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
  const locations = locationsQuery.data ?? [];
  const county = locations.find((item) => item.code === values.countyCode);
  const municipalities = county?.children ?? [];
  const municipality = municipalities.find((item) => item.code === values.municipalityCode);
  const areas = municipality?.children ?? [];
  /** Fills address, sted and fylke/kommune codes from a Kartverket hit. */
  const applyAddressHit = (hit: AddressHit, point?: [number, number]) => {
    const sameName = (name: string) => name.toLowerCase() === hit.municipalityName.toLowerCase();
    const hitCounty =
      locations.find((item) => item.children?.some((child) => child.code === hit.municipalityCode)) ??
      locations.find((item) => item.children?.some((child) => sameName(child.name)));
    const hitMunicipality = hitCounty?.children?.find((child) => child.code === hit.municipalityCode || sameName(child.name));
    setValues((current) => ({
      ...current,
      address: hit.address,
      city: hit.city || hit.municipalityName,
      countyCode: hitCounty?.code ?? '',
      municipalityCode: hitMunicipality?.code ?? '',
      areaCode: '',
      coordinates: point ?? [hit.lat, hit.lng],
    }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of ['address', 'city', 'countyCode', 'municipalityCode', 'coordinates'] as const) delete next[key];
      return next;
    });
  };
  const clearLocation = () =>
    setValues((current) => ({ ...current, address: '', city: '', countyCode: '', municipalityCode: '', areaCode: '', coordinates: [0, 0] }));
  /** Map tap, marker drag or GPS: keep the exact point and look up the address there. */
  const setLocationPoint = async (point: [number, number]) => {
    update('coordinates', point);
    setLookingUpAddress(true);
    try {
      const hit = await addressAt(point[0], point[1]);
      if (hit) applyAddressHit(hit, point);
      else {
        setValues((current) => ({ ...current, address: '', city: '', countyCode: '', municipalityCode: '', areaCode: '' }));
        setErrors((current) => ({ ...current, address: 'Fant ingen adresse akkurat her. Søk etter adressen i feltet over.' }));
      }
    } catch {
      // Offline or Kartverket down: drop the old address so it is never confirmed together
      // with a point it does not belong to.
      setValues((current) => ({ ...current, address: '', city: '', countyCode: '', municipalityCode: '', areaCode: '' }));
      setErrors((current) => ({ ...current, address: 'Kunne ikke hente adressen nå. Sjekk nettet og prøv igjen.' }));
    } finally {
      setLookingUpAddress(false);
    }
  };
  const categories = categoriesQuery.data?.categories ?? [];
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
  );
  // A point alone is not enough: it must have an address (from the search or the lookup at that point).
  const coordinatesConfirmed = (values.coordinates[0] !== 0 || values.coordinates[1] !== 0) && Boolean(values.address.trim());
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

  /**
   * Checks one step and shows its errors (same rules and wording as the web form).
   * `target` is the step being moved TO: 2 checks step 1, 3 checks step 2, 5 checks step 4.
   * Returns the errors found, so callers can summarise them and scroll to the first.
   */
  const validate = (target: number): CreateJobErrors => {
    const next = validateCreateJobStep(target, {
      values,
      imageCount: images.length + existingImages.length,
      phone,
      displayedPrice,
    });
    setErrors(next);
    return next;
  };

  // Where each field sits, so a failed "Neste" can scroll to the first error.
  const scrollRef = useRef<ScrollView | null>(null);
  const stepTopY = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  const scrollY = useRef(0);
  // When the keyboard opens, scroll the focused field up so neither the keyboard nor the
  // "Neste" bar above it covers it.
  useEffect(() => {
    const ACTION_BAR = 72;
    const sub = Keyboard.addListener('keyboardDidShow', (event) => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input) return;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h - (event.endCoordinates.screenY - ACTION_BAR - 12);
        if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
      });
    });
    return () => sub.remove();
  }, []);
  const ERROR_SECTION: Record<ErrorKey, string> = {
    images: 'images', title: 'about', categories: 'about', description: 'about',
    address: 'where', countyCode: 'where', municipalityCode: 'where', city: 'where', coordinates: 'where',
    fromDate: 'when', toDate: 'when', durationValue: 'duration', price: 'payment', phone: 'contact', email: 'contact',
  };
  const ERROR_LABEL: Record<ErrorKey, string> = {
    images: 'Bilder', title: 'Tittel', categories: 'Kategori', description: 'Beskrivelse',
    address: 'Gateadresse', countyCode: 'Fylke', municipalityCode: 'Kommune', city: 'By / Sted',
    coordinates: 'Lokasjon på kartet', fromDate: 'Fra dato', toDate: 'Til dato', durationValue: 'Varighet',
    price: 'Pris', phone: 'Telefonnummer', email: 'E-post',
  };
  const showErrors = (found: CreateJobErrors) => {
    // Inline errors + scroll to the first one; no extra popup on top of them.
    const keys = (Object.keys(ERROR_LABEL) as ErrorKey[]).filter((key) => found[key]);
    if (!keys.length) return;
    // Wait a frame so the step that was just switched to has laid out its sections.
    setTimeout(() => {
      const y = sectionY.current[ERROR_SECTION[keys[0]]];
      scrollRef.current?.scrollTo({ y: y === undefined ? 0 : Math.max(0, stepTopY.current + y - 12), animated: true });
    }, 120);
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
  const takePhoto = async () => {
    if (6 - existingImages.length - images.length <= 0)
      return Alert.alert('Maks 6 bilder', 'Du kan laste opp inntil 6 bilder.');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      return Alert.alert('Kamera er ikke tillatt', 'Gi Jobblo tilgang til kameraet i innstillingene, eller last opp et bilde.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImages((current) => [
        ...current,
        { uri: asset.uri, name: asset.fileName ?? `jobb-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' },
      ]);
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
          // Same rule as the web: fill only what the user has not written yet.
          if (result.title && values.title.trim().length < 5) update('title', result.title.slice(0, 70));
          if (result.description && values.description.trim().length < 20)
            update('description', result.description.slice(0, 2000));
          if (result.category && !values.categories.length) update('categories', [result.category]);
          if (result.skills?.length && !values.tags.length) update('tags', result.skills);
          if (result.duration?.value && !values.durationValue) {
            update('durationValue', String(result.duration.value));
            update('durationUnit', result.duration.unit);
          }
          if (result.paymentType && values.paymentType === 'Fastpris') update('paymentType', result.paymentType);
          if (result.hourlyRate) update('hourlyRate', String(result.hourlyRate));
          if ((result.suggestedPrice || result.estimatedPrice) && !values.price)
            update('price', String(result.suggestedPrice ?? result.estimatedPrice));
          setSmartPrompt('');
          setSmartMinimized(true);
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
  const goToStep = (target: number) => {
    setStep(target);
    setMaxStep((current) => Math.max(current, target));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  /** Back to an empty step 1, after publishing and after discarding. */
  const resetForm = () => {
    void draftStorage.removeItem(DRAFT_KEY);
    setValues(emptyValues());
    setImages([]);
    setErrors({});
    setStep(1);
    setMaxStep(1);
    setShowSmartFill(true);
    setSmartMinimized(false);
    setSmartPrompt('');
    setCategorySearch('');
    setTagInput('');
    setNewChecklist('');
  };
  const publish = () => {
    // Like the web: stop at the first step with errors and take the user there, so an error
    // on step 1 is not silently blocking the "Publiser" button on step 4.
    for (const [target, stepNumber] of [[2, 1], [3, 2], [5, 4]] as const) {
      const found = validate(target);
      if (Object.keys(found).length) {
        goToStep(stepNumber);
        showErrors(found);
        return;
      }
    }
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
        onSuccess: (created) => {
          resetForm();
          setPublishedId(created._id);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
            resetForm();
            router.replace('/(app)');
          },
        },
      ]);
  const next = () => {
    if (step < 4) {
      // Step 3 (checklist) is optional; validate(4) finds nothing.
      const found = validate(step + 1);
      if (Object.keys(found).length) return showErrors(found);
      goToStep(step + 1);
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
    return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><LoadingIndicator variant="form" message="Laster oppdrag..." /></SafeAreaView>;
  }
  if (isEditMode && ownerJobsQuery.isError) {
    return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ErrorState title="Kunne ikke laste oppdraget" message="Sjekk internettforbindelsen din og prøv igjen." actionLabel="Prøv igjen" onAction={() => void ownerJobsQuery.refetch()} /></SafeAreaView>;
  }
  if (isEditMode && !editLoaded) {
    return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ErrorState title="Oppdraget ble ikke funnet" message="Annonsen er ikke tilgjengelig for redigering." actionLabel="Tilbake" onAction={() => router.back()} /></SafeAreaView>;
  }
  if (isEditMode && editUnavailable) {
    return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page"><ErrorState title="Oppdraget kan ikke redigeres" message={ownerJobsQuery.data?.find((item) => item._id === editId)?.capabilities?.blockedReason ?? 'Serveren tillater ikke redigering av dette oppdraget.'} actionLabel="Tilbake" onAction={() => router.back()} /></SafeAreaView>;
  }

  if (publishedId) {
    const done = (go: () => void) => {
      setPublishedId(null);
      go();
    };
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <View className="flex-1 justify-center px-5">
          <View className="items-center rounded-2xl border border-line bg-surface px-6 py-10">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-tint">
              <CheckCircle2 size={34} color={TC.brandText} />
            </View>
            <Text className="mt-5 text-center text-[1.5rem] font-bold text-ink">Oppdraget er publisert</Text>
            <Text className="mt-2 text-center text-[1rem] leading-6 text-ink-2">
              Oppdraget er nå synlig for andre. Du får varsel når noen søker.
            </Text>
            <View className="mt-7 w-full gap-3">
              <Button
                label="Se oppdraget"
                fullWidth
                onPress={() => done(() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: publishedId } }))}
              />
              <Button label="Til forsiden" variant="secondary" fullWidth onPress={() => done(() => router.replace('/(app)'))} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const imageCount = existingImages.length + images.length;
  // iOS-style swipe from the left edge = previous step (a tab screen has no native back swipe).
  const swipeBack = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(20)
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      if (event.translationX > 60 && step > 1) goToStep(step - 1);
    });
  const amountLabel = values.paymentType === 'Timepris' ? 'Timepris' : values.paymentType === 'Anbud' ? 'Antatt budsjett' : 'Fastpris';
  const durationUnitLabel = DURATIONS.find((item) => item.value === values.durationUnit)?.label.toLowerCase() ?? '';
  const analyzeImage = () => {
    const img = images[0];
    if (!img) return;
    analyzeImageMutation.mutate(
      { uri: img.uri, name: img.name, type: img.type },
      {
        onSuccess: (result) => {
          if (result.title && values.title.trim().length < 5) update('title', result.title.slice(0, 70));
          if (result.description && values.description.trim().length < 20) update('description', result.description.slice(0, 2000));
          if (result.category && !values.categories.length) update('categories', [result.category]);
          if (result.duration?.value && !values.durationValue) {
            update('durationValue', String(result.duration.value));
            update('durationUnit', result.duration.unit);
          }
          if (result.suggestedPrice && !values.price) update('price', String(result.suggestedPrice));
          if (result.hourlyRate) update('hourlyRate', String(result.hourlyRate));
          Alert.alert('AI-analyse ferdig', 'Feltene er fylt ut basert på bildet. Pris og tid er estimater – sjekk og juster.');
        },
        onError: (error) => Alert.alert('Analyse feilet', getError(error) ?? 'Prøv igjen.'),
      }
    );
  };

  return (
    // No bottom edge: this screen sits above the tab bar, which already reserves the
    // home-indicator / navigation-bar inset.
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Sticky: stays at the top while the step scrolls. */}
        <View className="border-b border-line bg-page px-4 pb-3 pt-2">
          <Stepper steps={STEPS} current={step} maxReached={maxStep} onStepPress={goToStep} />
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled" onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}>
          <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-muted">
            {isEditMode ? 'Rediger oppdrag' : 'Nytt oppdrag'}
          </Text>
          <Text className="mt-1 text-[1.625rem] font-bold leading-tight tracking-[-0.02em] text-ink">
            {isEditMode ? 'Rediger oppdraget ditt' : 'Legg ut et oppdrag'}
          </Text>
          <Text className="mt-1 text-[0.875rem] leading-5 text-muted">
            Fire korte steg. {isEditMode ? 'Endringene lagres når du trykker «Lagre endringer».' : 'Utkastet lagres automatisk.'}
          </Text>

          <View className="mb-5" />

          {/* ── Steg 1 · Grunnleggende ── */}
          {step === 1 ? (
            <View className="gap-4" onLayout={(e) => { stepTopY.current = e.nativeEvent.layout.y; }}>
              {showSmartFill ? (
                <Card className="rounded-xl border-brand-text/25 bg-[#F7FAF6] p-4">
                  <View className="flex-row items-start gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-lg bg-brand">
                      <Sparkles size={17} color="#FFFFFF" />
                    </View>
                    <Pressable onPress={() => setSmartMinimized((v) => !v)} className="min-w-0 flex-1">
                      <Text className="text-[0.9375rem] font-semibold text-ink">Smart-utfylling</Text>
                      <Text className="mt-0.5 text-[0.8125rem] leading-5 text-muted">
                        {smartMinimized
                          ? 'Trykk for å utvide'
                          : 'Fortell kort hva som skal gjøres — ta gjerne med størrelse, tilstand og tidspunkt, så fyller vi ut resten av skjemaet for deg.'}
                      </Text>
                    </Pressable>
                    <View className="flex-row gap-1">
                      <Pressable onPress={() => setSmartMinimized((v) => !v)} hitSlop={8} accessibilityLabel={smartMinimized ? 'Utvid' : 'Minimer'} className="p-1">
                        {smartMinimized ? <ChevronDown size={18} color={tc('#63665F', 'muted')} /> : <ChevronUp size={18} color={tc('#63665F', 'muted')} />}
                      </Pressable>
                      <Pressable onPress={() => setShowSmartFill(false)} hitSlop={8} accessibilityLabel="Skjul smart-utfylling" className="p-1">
                        <X size={18} color={tc('#63665F', 'muted')} />
                      </Pressable>
                    </View>
                  </View>
                  {!smartMinimized ? (
                    <View className="mt-3 gap-3">
                      <Field
                        label="Hva skal gjøres?"
                        value={smartPrompt}
                        onChangeText={setSmartPrompt}
                        placeholder="F.eks. Male en liten bod på 8 m² utvendig, bør være ferdig i mai."
                        multiline
                      />
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <Button
                            label={smartFillMutation.isPending ? 'Fyller ut…' : 'Fyll ut nå'}
                            onPress={() => {
                              if (smartPrompt.trim().length < 5)
                                return Alert.alert('Beskriv oppdraget', 'Vennligst beskriv hva du trenger hjelp med (min. 5 tegn).');
                              smartFill(smartPrompt);
                            }}
                            disabled={smartFillMutation.isPending}
                            fullWidth
                            icon={<Sparkles size={15} color="#FFF" style={{ marginRight: 6 }} />}
                          />
                        </View>
                        <Button label="Avbryt" variant="secondary" onPress={() => { setSmartPrompt(''); setSmartMinimized(true); }} />
                      </View>
                    </View>
                  ) : null}
                </Card>
              ) : (
                <Pressable onPress={() => { setShowSmartFill(true); setSmartMinimized(false); }} className="flex-row items-center gap-1.5 self-start" hitSlop={6}>
                  <Sparkles size={15} color={TC.brandText} />
                  <Text className="text-[0.8125rem] font-semibold text-brand-text">Vis smart-utfylling</Text>
                </Pressable>
              )}

              <Section onLayout={(e) => { sectionY.current.images = e.nativeEvent.layout.y; }} icon={ImageIcon} title="Bilder" subtitle="Valgfritt — uten bilde viser vi et bilde for kategorien" right={<Text className="text-[0.8125rem] font-medium text-muted">Valgfritt</Text>}>
                <View className="flex-row flex-wrap gap-2">
                  {existingImages.map((imageUrl) => (
                    <View key={imageUrl} className="h-24 w-[31.5%] overflow-hidden rounded-lg bg-surface-2">
                      <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <Pressable
                        onPress={() => {
                          setExistingImages((current) => current.filter((url) => url !== imageUrl));
                          setImagesToDelete((current) => [...current, imageUrl]);
                        }}
                        accessibilityLabel="Fjern bilde"
                        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                      >
                        <X size={13} color="#FFF" />
                      </Pressable>
                    </View>
                  ))}
                  {images.map((image, index) => (
                    <View key={`${image.uri}-${index}`} className="h-24 w-[31.5%] overflow-hidden rounded-lg bg-surface-2">
                      <Image source={{ uri: image.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <Pressable
                        onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                        accessibilityLabel="Fjern bilde"
                        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                      >
                        <X size={13} color="#FFF" />
                      </Pressable>
                    </View>
                  ))}
                  {imageCount < 6 ? (
                    <>
                      <Pressable onPress={() => void pickImages()} className="h-24 w-[31.5%] items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-surface-2">
                        <Upload size={20} color={TC.brandText} />
                        <Text className="text-[0.8125rem] font-medium text-ink-2">Last opp</Text>
                      </Pressable>
                      <Pressable onPress={() => void takePhoto()} className="h-24 w-[31.5%] items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-surface-2">
                        <Camera size={20} color={TC.brandText} />
                        <Text className="text-[0.8125rem] font-medium text-ink-2">Ta bilde</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
                <Text className="-mt-2 text-[0.8125rem] text-subtle">Inntil 6 bilder · {imageCount}/6 valgt</Text>
                <ErrorText>{errors.images}</ErrorText>
                {images.length > 0 ? (
                  <Pressable
                    onPress={analyzeImage}
                    disabled={analyzeImageMutation.isPending}
                    className="h-11 flex-row items-center justify-center gap-2 rounded-lg border border-brand-text/40 bg-tint"
                  >
                    {analyzeImageMutation.isPending ? <ActivityIndicator size="small" color={TC.brandText} /> : <Sparkles size={16} color={TC.brandText} />}
                    <Text className="text-[0.875rem] font-semibold text-brand-text">
                      {analyzeImageMutation.isPending ? 'Analyserer bildet…' : 'Analyser bilde med AI'}
                    </Text>
                  </Pressable>
                ) : null}
              </Section>

              <Section onLayout={(e) => { sectionY.current.about = e.nativeEvent.layout.y; }} icon={FileText} title="Om oppdraget" subtitle="Tittel, kategori og beskrivelse">
                <Field
                  label="Tittel"
                  required
                  value={values.title}
                  onChangeText={(value) => update('title', value.slice(0, 70))}
                  maxLength={70}
                  showCount
                  placeholder="F.eks. Malearbeid i stue"
                  error={errors.title}
                />

                <View className="gap-1.5">
                  <Text className="text-[0.8125rem] font-semibold text-ink">
                    Velg kategori<Text className="text-danger"> *</Text>
                  </Text>
                  <View className={`h-11 flex-row items-center gap-2 rounded-lg border bg-surface px-3 ${errors.categories ? 'border-danger' : 'border-line'}`}>
                    <Search size={16} color={tc('#9B9E96', 'subtle')} />
                    <TextInput
                      value={categorySearch}
                      onChangeText={setCategorySearch}
                      placeholder="Søk i kategorier..."
                      placeholderTextColor={TC.placeholder}
                      accessibilityLabel="Søk i kategorier"
                      style={{ paddingVertical: 0 }}
                      className="flex-1 text-[0.9375rem] text-ink"
                    />
                  </View>
                  {categoriesQuery.isLoading ? (
                    <Text className="text-[0.8125rem] text-muted">Laster...</Text>
                  ) : categoriesQuery.isError ? (
                    <Text className="text-[0.8125rem] text-danger">Kunne ikke laste kategorier</Text>
                  ) : filteredCategories.length ? (
                    <View className="mt-1 flex-row flex-wrap gap-2">
                      {filteredCategories.map((category) => (
                        <Chip
                          key={category._id}
                          label={category.name}
                          selected={values.categories[0] === category.name}
                          onPress={() => update('categories', [category.name])}
                          className="rounded-lg"
                        />
                      ))}
                    </View>
                  ) : (
                    <Text className="text-[0.8125rem] text-muted">Ingen treff</Text>
                  )}
                  <ErrorText>{errors.categories}</ErrorText>
                </View>

                <Field
                  label="Beskrivelse"
                  required
                  badge="Min. 20 tegn"
                  value={values.description}
                  onChangeText={(value) => update('description', value.slice(0, 2000))}
                  maxLength={2000}
                  showCount
                  multiline
                  placeholder="Gi en detaljert beskrivelse..."
                  error={errors.description}
                />

                <View className="gap-1.5">
                  <Text className="text-[0.8125rem] font-semibold text-ink">Ferdigheter / Tags</Text>
                  {values.tags.length ? (
                    <View className="flex-row flex-wrap gap-2">
                      {values.tags.map((tag) => (
                        <View key={tag} className="flex-row items-center rounded-lg bg-tint py-1 pl-2.5 pr-1">
                          <Text className="text-[0.8125rem] font-medium text-brand-text">{tag}</Text>
                          <Pressable
                            onPress={() => update('tags', values.tags.filter((item) => item !== tag))}
                            accessibilityLabel={`Fjern ${tag}`}
                            hitSlop={6}
                            className="ml-1 p-1"
                          >
                            <X size={12} color={TC.brandText} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-[0.8125rem] text-subtle">Ingen ferdigheter lagt til ennå. Bruk AI eller legg til manuelt.</Text>
                  )}
                  <View className="flex-row gap-2">
                    <View className="h-11 flex-1 flex-row items-center rounded-lg border border-line bg-surface px-3">
                      <TextInput
                        value={tagInput}
                        onChangeText={setTagInput}
                        onSubmitEditing={addTag}
                        placeholder="Legg til en ferdighet (f.eks. Maling)"
                        placeholderTextColor={TC.placeholder}
                        returnKeyType="done"
                        accessibilityLabel="Ny ferdighet"
                        style={{ paddingVertical: 0 }}
                        className="flex-1 text-[0.9375rem] text-ink"
                      />
                    </View>
                    <Pressable
                      onPress={addTag}
                      disabled={!tagInput.trim()}
                      accessibilityLabel="Legg til ferdighet"
                      className={`h-11 w-11 items-center justify-center rounded-lg ${tagInput.trim() ? 'bg-brand' : 'bg-line'}`}
                    >
                      <Plus size={18} color="#FFF" />
                    </Pressable>
                  </View>
                </View>
              </Section>
            </View>
          ) : null}

          {/* ── Steg 2 · Tid & sted ── */}
          {step === 2 ? (
            <View className="gap-4" onLayout={(e) => { stepTopY.current = e.nativeEvent.layout.y; }}>
              <Section onLayout={(e) => { sectionY.current.where = e.nativeEvent.layout.y; }} icon={MapPin} title="Hvor skal det gjøres?" subtitle="Søk etter adressen — kartet viser hvor det er">
                <AddressSearchField
                  value={values.address}
                  confirmed={coordinatesConfirmed}
                  detail={[values.city, municipality && municipality.name !== values.city ? `${municipality.name} kommune` : ''].filter(Boolean).join(' · ')}
                  error={errors.address ?? errors.coordinates}
                  onSelect={(hit) => applyAddressHit(hit)}
                  onClear={clearLocation}
                />
                {areas.length ? (
                  <View className="gap-1.5">
                    <Text className="text-[0.8125rem] font-semibold text-ink">Bydel / Område</Text>
                    <Select
                      variant="field"
                      value={values.areaCode}
                      options={areas.map((item) => ({ label: item.name, value: item.code }))}
                      placeholder="Velg bydel (valgfritt)"
                      onValueChange={(value) => update('areaCode', value)}
                    />
                  </View>
                ) : null}
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[0.8125rem] font-semibold text-ink">Juster markøren ved behov</Text>
                    {lookingUpAddress ? <ActivityIndicator size="small" color={TC.brandText} /> : null}
                  </View>
                  <CreateJobLocationMap
                    coordinates={values.coordinates}
                    onCoordinatesChange={(coordinates) => void setLocationPoint(coordinates)}
                  />
                </View>
              </Section>

              <Section onLayout={(e) => { sectionY.current.when = e.nativeEvent.layout.y; }} icon={CalendarDays} title="Når skal det gjøres?" subtitle="Velg datoer som passer for deg">
                <View className="flex-row gap-2">
                  <DateField label="Fra dato" placeholder="Velg dato" value={values.fromDate} error={errors.fromDate} onPress={() => setDatePicker('fromDate')} />
                  <DateField optional label="Til dato (valgfritt)" placeholder="Fleksibel" value={values.toDate} error={errors.toDate} onPress={() => setDatePicker('toDate')} />
                </View>
              </Section>

              <Section onLayout={(e) => { sectionY.current.duration = e.nativeEvent.layout.y; }} icon={Clock3} title="Forventet varighet" subtitle="Hvor lang tid antar du at oppdraget tar?">
                <View className="flex-row items-start gap-2">
                  <Field
                    className="flex-1"
                    label="Varighet"
                    required
                    value={values.durationValue}
                    onChangeText={(value) => update('durationValue', value.replace(',', '.').replace(/[^\d.]/g, ''))}
                    placeholder="F.eks. 2"
                    keyboardType="decimal-pad"
                    error={errors.durationValue}
                  />
                  <View className="w-[42%] gap-1.5">
                    <Text className="text-[0.8125rem] font-semibold text-ink">Enhet</Text>
                    <Select variant="field" value={values.durationUnit} options={DURATIONS} placeholder="Velg enhet" onValueChange={(value) => update('durationUnit', value as DurationUnit)} />
                  </View>
                </View>
                <InfoNote>Et grovt anslag er nok — du kan alltid justere dette senere i samtalen med søkere.</InfoNote>
              </Section>

              <Section onLayout={(e) => { sectionY.current.payment = e.nativeEvent.layout.y; }} icon={Banknote} title="Betaling" subtitle="Hvordan vil du avtale prisen?">
                <View className="gap-2">
                  {PAYMENT_CARDS.map((card) => {
                    const Icon = card.icon;
                    const active = values.paymentType === card.value;
                    return (
                      <Pressable
                        key={card.value}
                        onPress={() => update('paymentType', card.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        className={`flex-row items-center gap-3 rounded-lg border p-3 ${active ? 'border-brand-text bg-[#F2F7F1]' : 'border-line bg-surface'}`}
                      >
                        <View className={`h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-brand' : 'bg-surface-2'}`}>
                          <Icon size={16} color={active ? '#FFF' : tc('#63665F', 'muted')} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className={`text-[0.9375rem] font-semibold ${active ? 'text-brand-text' : 'text-ink'}`}>{card.label}</Text>
                          <Text className="text-[0.8125rem] text-muted">{card.description}</Text>
                        </View>
                        <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${active ? 'border-brand-text' : 'border-line-strong'}`}>
                          {active ? <View className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Field
                  label={amountLabel}
                  required
                  prefix="kr"
                  suffix={values.paymentType === 'Timepris' ? 'per time' : undefined}
                  value={values.paymentType === 'Timepris' ? values.hourlyRate : values.price}
                  onChangeText={(value) => update(values.paymentType === 'Timepris' ? 'hourlyRate' : 'price', value.replace(/[^\d]/g, ''))}
                  placeholder={values.paymentType === 'Anbud' ? '5000' : '0'}
                  keyboardType="number-pad"
                  error={values.paymentType === 'Timepris' ? undefined : errors.price}
                />
                {values.paymentType === 'Timepris' ? (
                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
                      <Text className="flex-1 text-[0.8125rem] text-muted">
                        Beregnet totalpris{values.durationValue ? ` for ${values.durationValue} ${durationUnitLabel}` : ''}
                      </Text>
                      <Text className="text-[0.9375rem] font-bold tabular-nums text-ink">{Math.round(total).toLocaleString('nb-NO')} kr</Text>
                    </View>
                    <ErrorText>{errors.price ? `${errors.price} Sjekk timepris og varighet.` : undefined}</ErrorText>
                  </View>
                ) : null}
                {values.paymentType === 'Anbud' ? (
                  <InfoNote>Budsjettet vises til de som gir tilbud, så de har en økonomisk ramme å forholde seg til. Du binder deg ikke til beløpet.</InfoNote>
                ) : null}
                <Pressable
                  onPress={() => {
                    if (!isPaidSubscriber) return Alert.alert('Haster', 'Haster er kun tilgjengelig for betalte abonnementer.');
                    update('urgent', !values.urgent);
                  }}
                  className="flex-row items-center gap-3 rounded-lg border border-line p-3"
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg bg-warn-tint">
                    <Zap size={16} color="#B7791F" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-[0.9375rem] font-semibold text-ink">Haster oppdraget?</Text>
                      {!isPaidSubscriber ? (
                        <View className="flex-row items-center gap-0.5 rounded bg-surface-2 px-1.5 py-0.5">
                          <Lock size={10} color={tc('#63665F', 'muted')} />
                          <Text className="text-[0.6875rem] font-semibold text-muted">Betalt</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-[0.8125rem] text-muted">Merkes med «Haster» og løftes høyere i søket.</Text>
                  </View>
                  <Switch
                    value={values.urgent && isPaidSubscriber}
                    onValueChange={(value) => {
                      if (!isPaidSubscriber) return Alert.alert('Haster', 'Haster er kun tilgjengelig for betalte abonnementer.');
                      update('urgent', value);
                    }}
                    trackColor={{ true: TC.brandText, false: '#D9DBD3' }}
                  />
                </Pressable>
              </Section>
            </View>
          ) : null}

          {/* ── Steg 3 · Sjekkliste ── */}
          {step === 3 ? (
            <Section
              icon={ListChecks}
              title="Sjekkliste (valgfritt)"
              subtitle="Det som skal gjøres, punkt for punkt (1–10 elementer)"
              right={<Text className="text-[0.8125rem] tabular-nums text-subtle">{values.checklist.length}/10</Text>}
            >
              <View className="flex-row gap-2">
                <View className="h-11 flex-1 flex-row items-center rounded-lg border border-line bg-surface px-3">
                  <TextInput
                    value={newChecklist}
                    onChangeText={setNewChecklist}
                    onSubmitEditing={addChecklist}
                    placeholder="Legg til sjekklisteelement..."
                    placeholderTextColor={TC.placeholder}
                    returnKeyType="done"
                    accessibilityLabel="Nytt sjekklisteelement"
                    style={{ paddingVertical: 0 }}
                    className="flex-1 text-[0.9375rem] text-ink"
                  />
                </View>
                <Pressable
                  onPress={addChecklist}
                  disabled={!newChecklist.trim() || values.checklist.length >= 10}
                  accessibilityLabel="Legg til i sjekklisten"
                  className={`h-11 w-11 items-center justify-center rounded-lg ${newChecklist.trim() && values.checklist.length < 10 ? 'bg-brand' : 'bg-line'}`}
                >
                  <Plus size={18} color="#FFF" />
                </Pressable>
              </View>
              {values.checklist.length ? (
                <View className="overflow-hidden rounded-lg border border-line">
                  {values.checklist.map((item, index) => (
                    <View key={item.id} className={`flex-row items-center gap-2 bg-surface px-2 py-2 ${index > 0 ? 'border-t border-line-soft' : ''}`}>
                      <Text className="w-5 text-center text-[0.8125rem] font-semibold tabular-nums text-subtle">{index + 1}</Text>
                      <TextInput
                        value={item.text}
                        onChangeText={(text) =>
                          update('checklist', values.checklist.map((current, i) => (i === index ? { ...current, text: text.slice(0, 300) } : current)))
                        }
                        accessibilityLabel={`Sjekklisteelement ${index + 1}`}
                        style={{ paddingVertical: 4 }}
                        className="flex-1 text-[0.9375rem] text-ink"
                      />
                      <Pressable onPress={() => moveChecklist(index, -1)} disabled={index === 0} hitSlop={4} accessibilityLabel="Flytt opp" className="p-1">
                        <ArrowUp size={15} color={index === 0 ? '#D1D5DC' : tc('#63665F', 'muted')} />
                      </Pressable>
                      <Pressable onPress={() => moveChecklist(index, 1)} disabled={index === values.checklist.length - 1} hitSlop={4} accessibilityLabel="Flytt ned" className="p-1">
                        <ArrowDown size={15} color={index === values.checklist.length - 1 ? '#D1D5DC' : tc('#63665F', 'muted')} />
                      </Pressable>
                      <Pressable
                        onPress={() => update('checklist', values.checklist.filter((_, i) => i !== index))}
                        hitSlop={4}
                        accessibilityLabel="Slett"
                        className="p-1"
                      >
                        <Trash2 size={15} color={TC.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="py-4 text-center text-[0.8125rem] text-subtle">Ingen sjekklisteelementer lagt til ennå</Text>
              )}
            </Section>
          ) : null}

          {/* ── Steg 4 · Kontakt ── */}
          {step === 4 ? (
            <View className="gap-4" onLayout={(e) => { stepTopY.current = e.nativeEvent.layout.y; }}>
              <Section onLayout={(e) => { sectionY.current.contact = e.nativeEvent.layout.y; }} icon={Phone} title="Kontaktinformasjon (valgfritt)" subtitle="Vises for den du velger til oppdraget">
                <Field
                  label="Telefonnummer"
                  prefix="+47"
                  value={phone.replace(/^(\d{3})(\d{2})(\d{0,3})$/, (_m, a, b, c) => [a, b, c].filter(Boolean).join(' '))}
                  onChangeText={(value) => update('contactPhone', value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="412 34 567"
                  keyboardType="phone-pad"
                  error={errors.phone}
                />
                <Field
                  label="E-post"
                  value={values.contactEmail}
                  onChangeText={(value) => update('contactEmail', value)}
                  placeholder="din@epost.no"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.email}
                />
              </Section>
              <Section icon={ClipboardList} title="Oppsummering" subtitle="Sjekk at alt stemmer før du publiserer">
                <View className="overflow-hidden rounded-lg border border-line">
                  {([
                    ['Type', values.customerType === 'business' ? 'Bedriftsoppdrag' : 'Privat oppdrag', 0],
                    ['Tittel', values.title || '—', 1],
                    ['Kategori', values.categories.join(', ') || '—', 1],
                    ['Bilder', `${imageCount}`, 1],
                    ['Sted', [values.address, values.city].filter(Boolean).join(', ') || '—', 2],
                    ['Når', values.fromDate ? `${dateLabel(values.fromDate)}${values.toDate ? ` – ${dateLabel(values.toDate)}` : ''}` : '—', 2],
                    ['Pris', `${Math.round(displayedPrice).toLocaleString('nb-NO')} kr (${values.paymentType})`, 2],
                  ] as const).map(([label, value, target], index) => (
                    <View key={label} className={`flex-row items-center gap-3 bg-surface px-3 py-3 ${index > 0 ? 'border-t border-line-soft' : ''}`}>
                      <Text className="w-20 text-[0.875rem] text-muted">{label}</Text>
                      <Text className="flex-1 text-[0.875rem] font-semibold text-ink" numberOfLines={2}>{value}</Text>
                      <Pressable onPress={() => (target === 0 ? update('customerType', '') : goToStep(target))} hitSlop={8} accessibilityLabel={`Endre ${label.toLowerCase()}`}>
                        <Text className="text-[0.875rem] font-semibold text-brand-text">Endre</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </Section>
            </View>
          ) : null}
        </ScrollView>

        <NyAnnonseSheet
          visible={isFocused && !isEditMode && draftLoaded && !values.customerType}
          suggested={user?.role === 'company' ? 'business' : 'private'}
          onSelect={(type) => update('customerType', type)}
          onClose={() => {
            // Closing without a choice keeps the usual default rather than trapping the user.
            update('customerType', user?.role === 'company' ? 'business' : 'private');
          }}
        />

        {step > 1 ? (
          <GestureDetector gesture={swipeBack}>
            <View className="absolute bottom-20 left-0 top-0 w-5" />
          </GestureDetector>
        ) : null}

        {/* Action bar, directly above the tab bar */}
        <View className="absolute bottom-0 left-0 right-0 flex-row items-center gap-2 border-t border-line bg-page px-4 py-3">
          <Pressable
            onPress={step === 1 ? discard : () => goToStep(step - 1)}
            disabled={saving}
            className="h-11 flex-row items-center justify-center gap-1 px-2"
          >
            <ArrowLeft size={16} color={tc('#63665F', 'muted')} />
            <Text className="text-[0.875rem] font-medium text-muted">{step === 1 ? 'Avbryt' : 'Tilbake'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowPreview(true)}
            disabled={saving}
            accessibilityLabel="Forhåndsvis"
            className="h-11 flex-row items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3"
          >
            <Eye size={16} color={TC.ink} />
            <Text className="text-[0.8125rem] font-medium text-ink">Forhåndsvis</Text>
          </Pressable>
          <Pressable
            onPress={next}
            disabled={saving}
            className={`h-11 flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-brand ${saving ? 'opacity-70' : ''}`}
          >
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : null}
            <Text className="text-[0.875rem] font-semibold text-white">
              {saving
                ? isEditMode ? 'Lagrer…' : 'Publiserer…'
                : step === 4
                  ? isEditMode ? 'Lagre endringer' : 'Publiser oppdrag'
                  : 'Neste'}
            </Text>
            {step < 4 && !saving ? <ChevronRight size={16} color="#FFF" /> : null}
          </Pressable>
        </View>

        {datePicker ? (
          <View className="absolute bottom-20 left-4 right-4 rounded-xl border border-line bg-surface p-2">
            <DateTimePicker
              value={localDate(datePicker === 'fromDate' ? values.fromDate : values.toDate)}
              mode="date"
              minimumDate={datePicker === 'toDate' && values.fromDate ? localDate(values.fromDate) : startOfToday()}
              presentation="dialog"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleDateChange}
              onDismiss={() => setDatePicker(null)}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* ── Forhåndsvisning ── */}
      <Modal visible={showPreview} animationType="slide" onRequestClose={() => setShowPreview(false)}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-page">
          <View className="h-14 flex-row items-center justify-between border-b border-line px-4">
            <Text className="text-[1.0625rem] font-semibold text-ink">Forhåndsvisning</Text>
            <Pressable onPress={() => setShowPreview(false)} hitSlop={8} accessibilityLabel="Lukk forhåndsvisning" className="p-1">
              <X size={20} color={tc('#63665F', 'muted')} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
            {imageCount ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[...existingImages, ...images.map((image) => image.uri)].map((uri) => (
                  <Image key={uri} source={{ uri }} style={{ width: 260, height: 190, borderRadius: 12 }} resizeMode="cover" />
                ))}
              </ScrollView>
            ) : (
              <View className="h-48 items-center justify-center rounded-xl bg-line">
                <ImageIcon size={26} color={tc('#9B9E96', 'subtle')} />
                <Text className="mt-1 text-[0.8125rem] text-muted">Ingen bilde</Text>
              </View>
            )}
            <Card className="rounded-xl p-4">
              <View className="flex-row flex-wrap items-center gap-2">
                {values.categories[0] ? (
                  <View className="rounded bg-tint px-2 py-0.5">
                    <Text className="text-[0.8125rem] font-semibold text-brand-text">{values.categories[0]}</Text>
                  </View>
                ) : null}
                {values.urgent ? (
                  <View className="flex-row items-center gap-0.5 rounded bg-warn-tint px-2 py-0.5">
                    <Zap size={10} color="#B7791F" />
                    <Text className="text-[0.8125rem] font-semibold text-[#B7791F]">Haster</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-2 text-[1.375rem] font-bold leading-tight text-ink">{values.title || 'Uten tittel'}</Text>
              <Text className="mt-1 text-[1.125rem] font-bold text-brand-text">
                {Math.round(displayedPrice).toLocaleString('nb-NO')} kr
                <Text className="text-[0.8125rem] font-normal text-muted"> · {values.paymentType}</Text>
              </Text>
              <Text className="mt-4 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-subtle">Beskrivelse</Text>
              <Text className="mt-1 text-[0.875rem] leading-6 text-ink-2">{values.description || 'Ingen beskrivelse tilgjengelig'}</Text>
            </Card>
            <Card className="rounded-xl p-4">
              <Text className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-subtle">Detaljer</Text>
              {[
                ['Sted', [values.address, values.city].filter(Boolean).join(', ') || 'Ikke angitt'],
                ['Når', values.fromDate ? `${dateLabel(values.fromDate)}${values.toDate ? ` – ${dateLabel(values.toDate)}` : ''}` : 'Ikke angitt'],
                ['Varighet', values.durationValue ? `${values.durationValue} ${durationUnitLabel}` : 'Ikke angitt'],
              ].map(([label, value]) => (
                <View key={label} className="flex-row justify-between gap-3 py-1">
                  <Text className="text-[0.8125rem] text-muted">{label}</Text>
                  <Text className="shrink text-right text-[0.8125rem] font-medium text-ink">{value}</Text>
                </View>
              ))}
              {values.tags.length ? (
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {values.tags.map((tag) => (
                    <View key={tag} className="rounded bg-surface-2 px-2 py-0.5">
                      <Text className="text-[0.8125rem] text-ink-2">{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
            {values.checklist.length ? (
              <Card className="rounded-xl p-4">
                <Text className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-subtle">Sjekkliste</Text>
                {values.checklist.map((item) => (
                  <View key={item.id} className="flex-row items-start gap-2 py-1">
                    <CheckCircle2 size={14} color={TC.brandText} style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-[0.875rem] text-ink-2">{item.text}</Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
