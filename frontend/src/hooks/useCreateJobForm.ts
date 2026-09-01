import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { generateFullJobListing } from '../api/aiAPI';
import { useTranslate } from '../i18n/useTranslate';
import { useUserStore } from '../stores/userStore';
import { usePaymentCalculation } from './usePaymentCalculation';
import { useForm } from './useForm';
import { jobValidationSchema, type JobFormValues } from '../validations/jobValidations';
import { saveFormData, loadFormData, clearFormData } from '../utils/indexedDB';
import { getErrorMessage } from '../utils/getErrorMessage';
import { summariseAiFill, clampMessage } from '../utils/aiFillSummary';
import { scrollToFirstError } from '../utils/scrollToError';

/**
 * The four keys `validateStep` writes that are not fields of `JobFormValues` — they are held
 * in their own state (images, the map pin, fylke, kommune) but reported through the same
 * error channel so the UI has one thing to read and `scrollToFirstError` one thing to find.
 */
export type JobFormErrors = Partial<
  Record<keyof JobFormValues | 'images' | 'coordinates' | 'countyCode' | 'municipalityCode', string>
>;

interface InitialData {
  title?: string;
  description?: string;
  price?: string | number;
  address?: string;
  city?: string;
  countyCode?: string;
  municipalityCode?: string;
  areaCode?: string;
  categories?: string | string[];
  urgent?: boolean;
  equipment?: string;
  fromDate?: string;
  toDate?: string;
  durationValue?: string | number;
  durationUnit?: string;
  paymentType?: string;
  hourlyRate?: string | number;
  maxApplicants?: string | number;
  phone?: string;
  email?: string;
  images?: string[];
  latitude?: number;
  longitude?: number;
}

export const useCreateJobForm = (
  userId: string,
  initialData?: InitialData,
  isEditMode = false,
  onSubmit?: (formData: FormData) => void | Promise<unknown>
) => {
  const [currentStep, setCurrentStep] = useState(1);

  // Using the shared useForm hook for validation flow
  const {
    values,
    errors,
    handleChange: handleFormChange,
    validate,
    setValues,
    setErrors,
    setMultipleValues,
  } = useForm<JobFormValues>(
    {
      title: initialData?.title || '',
      description: initialData?.description || '',
      categories: initialData?.categories || '',
      address: initialData?.address || '',
      city: initialData?.city || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      price: initialData?.price || '',
      durationValue: initialData?.durationValue || '',
      fromDate: initialData?.fromDate || '',
      toDate: initialData?.toDate || '',
    },
    jobValidationSchema
  );

  // Individual states that are not part of the primary validation schema or need special handling
  const [equipment, setEquipment] = useState(initialData?.equipment || '');
  const [countyCode, setCountyCodeState] = useState(initialData?.countyCode || '');
  const [municipalityCode, setMunicipalityCodeState] = useState(
    initialData?.municipalityCode || ''
  );
  const [areaCode, setAreaCode] = useState(initialData?.areaCode || '');
  const [coordinates, setCoordinatesState] = useState<[number, number] | null>(() =>
    initialData?.latitude != null && initialData?.longitude != null
      ? [initialData.latitude, initialData.longitude]
      : null
  );

  /**
   * Fylke, kommune and the map pin live outside the validation schema, so `useForm` — which
   * clears a field's error as soon as it changes — never sees them fixed. Without this their
   * errors would stay red after the person had already put them right, and the scroll would
   * keep sending them back to a field with nothing wrong with it.
   */
  const clearFieldError = useCallback(
    (field: string) => {
      setErrors((prev) => {
        if (!prev[field as keyof JobFormValues]) return prev;
        const next = { ...prev };
        delete next[field as keyof JobFormValues];
        return next;
      });
    },
    [setErrors]
  );

  const setCountyCode = useCallback(
    (value: string) => {
      setCountyCodeState(value);
      if (value) clearFieldError('countyCode');
    },
    [clearFieldError]
  );

  const setMunicipalityCode = useCallback(
    (value: string) => {
      setMunicipalityCodeState(value);
      if (value) clearFieldError('municipalityCode');
    },
    [clearFieldError]
  );

  const setCoordinates = useCallback(
    (value: [number, number] | null) => {
      setCoordinatesState(value);
      if (value) clearFieldError('coordinates');
    },
    [clearFieldError]
  );
  const durationValue = values.durationValue;
  const fromDate = values.fromDate;
  const toDate = values.toDate;

  const setDurationValue = useCallback(
    (val: string) => handleFormChange('durationValue', val),
    [handleFormChange]
  );
  const setFromDate = useCallback(
    (val: string) => handleFormChange('fromDate', val),
    [handleFormChange]
  );
  const setToDate = useCallback(
    (val: string) => handleFormChange('toDate', val),
    [handleFormChange]
  );

  const [durationUnit, setDurationUnit] = useState(initialData?.durationUnit || 'minutes');

  const [maxApplicants, setMaxApplicants] = useState<string | number>(
    initialData?.maxApplicants || 0
  );

  const {
    price,
    setPrice,
    hourlyRate,
    setHourlyRate,
    paymentType,
    setPaymentType,
    urgent,
    setUrgent,
  } = usePaymentCalculation((durationValue ?? '').toString(), durationUnit, initialData);

  // Sync price from usePaymentCalculation to useForm
  useEffect(() => {
    handleFormChange('price', price);
  }, [price, handleFormChange]);

  const [tags, setTags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [currentImages, setCurrentImages] = useState<string[]>(initialData?.images || []);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingFullListing, setIsGeneratingFullListing] = useState(false);
  const [smartFillSuggestionFlags, setSmartFillSuggestionFlags] = useState<{
    title?: boolean;
    description?: boolean;
    price?: boolean;
    duration?: boolean;
    hourlyRate?: boolean;
    categories?: boolean;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smartFillPrompt, setSmartFillPrompt] = useState('');
  const [showSmartFillInput, setShowSmartFillInput] = useState(false);
  /** Smart-fill's pricing rationale, rendered under the price field rather than in a toast. */
  const [smartFillPricingNote, setSmartFillPricingNote] = useState('');
  const [checklistItems, setChecklistItems] = useState<{ id: string; text: string }[]>([]);

  // Flag to prevent save effect from running before load completes
  const [isLoaded, setIsLoaded] = useState(false);

  const currentUser = useUserStore((state) => state.user);
  const { locale } = useTranslate();

  // Category-based checklist suggestions
  const getCategorySuggestions = (category: string): string[] => {
    const suggestions: Record<string, string[]> = {
      Rengjøring: ['Støvsuge', 'Vaske gulv', 'Rengjøre bad', 'Tørke støv'],
      Hagearbeid: ['Klippe plen', 'Luke ugress', 'Rydde løv', 'Trimme hekk'],
      Flyttehjelp: ['Pakke bokser', 'Bære møbler', 'Montere møbler', 'Rydde gammel bolig'],
      Snømåking: ['Måke innkjørsel', 'Strø grus/salt', 'Rydde trapper'],
    };
    return suggestions[category] || [];
  };

  // Auto-update checklist when category changes (only if checklist is empty)
  useEffect(() => {
    const category = Array.isArray(values.categories) ? values.categories[0] : values.categories;
    if (category && checklistItems.length === 0) {
      const suggestions = getCategorySuggestions(category);
      if (suggestions.length > 0) {
        setChecklistItems(
          suggestions.map((text) => ({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text,
          }))
        );
      }
    }
  }, [values.categories]);

  // Wrappers to maintain compatibility with existing components
  const setTitle = useCallback((val: string) => handleFormChange('title', val), [handleFormChange]);
  const setDescription = useCallback(
    (val: string) => handleFormChange('description', val),
    [handleFormChange]
  );
  const setAddress = useCallback(
    (val: string) => handleFormChange('address', val),
    [handleFormChange]
  );
  const setCity = useCallback((val: string) => handleFormChange('city', val), [handleFormChange]);
  const setCategories = useCallback(
    (val: string | string[]) => handleFormChange('categories', val),
    [handleFormChange]
  );
  const setPhone = useCallback((val: string) => handleFormChange('phone', val), [handleFormChange]);
  const setEmail = useCallback((val: string) => handleFormChange('email', val), [handleFormChange]);

  /**
   * Images sit outside the validation schema, so `useForm` never cleared their error the way
   * it does for a text field the moment you type in it. `validateStep` only ever merges into
   * `errors`, so once "Vennligst last opp minst ett bilde" was set it stayed set — the card
   * kept its red border after the photo was added, and the scroll kept sending the person
   * back to a field with nothing wrong with it.
   */
  const handleImagesChange = useCallback(
    (files: File[]) => {
      setSelectedImages(files);
      if (files.length > 0) clearFieldError('images');
    },
    [clearFieldError]
  );

  const handleAiSmartFill = async () => {
    if (!smartFillPrompt || smartFillPrompt.length < 5) {
      toast.error('Vennligst beskriv hva du trenger hjelp med (min. 5 tegn)');
      return;
    }

    // Sniff which fields the user has already edited with non-trivial values
    // BEFORE running AI. We refuse to overwrite fields that are already
    // meaningfully populated, unless the AI suggestion is clearly "better".
    const userAlreadyHas = {
      title: values.title.trim().length >= 5,
      description: values.description.trim().length >= 20,
      categories:
        (Array.isArray(values.categories) && values.categories.length > 0) ||
        (typeof values.categories === 'string' && values.categories.trim().length > 0),
      price: !!values.price && String(values.price).length > 0 && Number(values.price) > 0,
      hourlyRate: !!hourlyRate && String(hourlyRate).length > 0 && Number(hourlyRate) > 0,
      duration: !!durationValue && String(durationValue).length > 0 && Number(durationValue) > 0,
    };

    setIsGeneratingFullListing(true);
    const newFlags: typeof smartFillSuggestionFlags = { ...smartFillSuggestionFlags };
    try {
      const response = await generateFullJobListing(smartFillPrompt, {
        lang: locale,
        existingTitle: values.title || undefined,
        existingDescription: values.description || undefined,
        existingCategory:
          (typeof values.categories === 'string'
            ? values.categories
            : Array.isArray(values.categories)
              ? values.categories[0]
              : undefined) || undefined,
        existingPaymentType: paymentType as 'Timepris' | 'Fastpris' | 'Anbud',
        existingDuration: durationValue
          ? { value: durationValue, unit: (durationUnit as any) || 'minutes' }
          : undefined,
        existingCity: values.city || undefined,
        existingCounty: countyCode || undefined,
        existingEquipment: equipment || undefined,
        existingUrgent: urgent,
      });

      if (response.success) {
        const {
          title: aiTitle,
          description: aiDesc,
          category: aiCategory,
          duration: aiDuration,
          priceRange,
          locationRelevance,
          skills: aiSkills,
          hourlyRate: aiHourlyRate,
          estimatedPrice: aiEstimatedPrice,
          suggestedPrice: aiSuggestedPrice,
          pricingReasoning,
          paymentType: aiPaymentType,
        } = response.data;

        // Title — only overwrite if user didn't write a meaningful one already.
        if (!userAlreadyHas.title && aiTitle) {
          setTitle(aiTitle);
          newFlags.title = true;
        } else if (aiTitle && aiTitle !== values.title) {
          // User already had a title — mention it in toast, don't clobber.
        }

        if (!userAlreadyHas.description && aiDesc) {
          setDescription(aiDesc);
          newFlags.description = true;
        }

        if (!userAlreadyHas.categories && aiCategory) {
          setCategories(aiCategory.trim());
          newFlags.categories = true;
        } else {
          setMultipleValues({
            categories: values.categories,
          });
        }

        if (!userAlreadyHas.duration && aiDuration && aiDuration.value) {
          setDurationValue(aiDuration.value.toString());
          setDurationUnit(aiDuration.unit || 'minutes');
          newFlags.duration = true;
        }

        if (aiHourlyRate) {
          setHourlyRate(aiHourlyRate.toString());
          newFlags.hourlyRate = true;
        }

        // Price: prefer priceRange.min for Anbud (budget floor), prefer
        // suggestedPrice for Fastpris. For Timepris the computed auto-price
        // comes from usePaymentCalculation anyway, so still write the est.
        const finalPrice = priceRange ? priceRange.min : (aiSuggestedPrice ?? aiEstimatedPrice);
        if (!userAlreadyHas.price && typeof finalPrice === 'number' && finalPrice > 0) {
          setPrice(finalPrice.toString());
          newFlags.price = true;
        }

        if (aiSkills && Array.isArray(aiSkills)) {
          setTags(aiSkills);
        }

        // If AI returned a payment type and user hasn't consciously chosen
        // one yet (still 'Fastpris' default), switch to AI's suggestion if
        // it differs AND AI picked Timepris/Anbud which fit category better.
        if (
          aiPaymentType &&
          paymentType === 'Fastpris' &&
          initialData?.paymentType == null &&
          aiPaymentType !== 'Fastpris'
        ) {
          setPaymentType(aiPaymentType);
        }

        if (locationRelevance === 'remote') {
          setCity((prev) => prev || 'Fjernarbeid / Remote');
        }

        setShowSmartFillInput(false);
        setSmartFillPrompt('');

        // This toast used to name every field, add "Priser er estimater — rediger fritt."
        // and then append the model's whole pricing sentence in parentheses — five lines of
        // rounded slab, for six seconds, over the form the person is trying to read. The
        // rationale now renders under the price field in `BasicInformation`, where it sits
        // next to the number it explains and stays until dismissed. The toast is left with
        // the one thing it is good for: confirming that something happened.
        setSmartFillPricingNote(pricingReasoning || '');
        toast.success(summariseAiFill(newFlags), { duration: 3000 });
      }
    } catch (err: any) {
      console.error('SMART FILL ERROR:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Kunne ikke generere jobbinformasjon.';
      const details = err.response?.data?.validationErrors?.length
        ? ` (${err.response.data.validationErrors.slice(0, 2).join(', ')})`
        : '';
      toast.error(clampMessage(errorMessage + details));
    } finally {
      setSmartFillSuggestionFlags(newFlags);
      setIsGeneratingFullListing(false);
    }
  };

  // Persistence - Load data on mount (run only once)
  useEffect(() => {
    const loadData = async () => {
      // In edit mode or when initialData is provided, skip loading draft
      if (initialData) {
        setIsLoaded(true);
        return;
      }

      try {
        const { data, images } = await loadFormData();
        if (data) {
          setValues({
            title: data.title || '',
            description: data.description || '',
            categories: data.categories || '',
            address: data.address || '',
            city: data.city || '',
            phone: data.phone || '',
            email: data.email || '',
            price: data.price || '',
            durationValue: data.durationValue || '',
            fromDate: data.fromDate || '',
            toDate: data.toDate || '',
          });
          setUrgent(data.urgent || false);
          setMaxApplicants(data.maxApplicants || 0);
          setEquipment(data.equipment || '');
          setCountyCode(data.countyCode || '');
          setMunicipalityCode(data.municipalityCode || '');
          setAreaCode(data.areaCode || '');
          if (data.latitude != null && data.longitude != null) {
            setCoordinates([data.latitude, data.longitude]);
          }
          setDurationUnit(data.durationUnit || 'minutes');
          setHourlyRate(data.hourlyRate || '');
          setPaymentType(data.paymentType || 'Fastpris');
          setTags(data.tags || []);
          setCurrentStep(data.currentStep || 1);
          setCurrentImages(data.currentImages || []);
          setImagesToDelete(data.imagesToDelete || []);
          setShowSmartFillInput(data.showSmartFillInput || false);
          setSmartFillPrompt(data.smartFillPrompt || '');
          setChecklistItems(data.checklistItems || []);

          if (images && images.length > 0) {
            setSelectedImages(images);
          }
        }
      } catch (err) {
        console.error('Error loading form data:', err);
      } finally {
        // Always mark as loaded so save effect can start
        setIsLoaded(true);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Persistence - Save data whenever it changes (only after initial load)
  useEffect(() => {
    if (!isLoaded) return; // Don't save until draft has been loaded
    if (isEditMode) return; // Edit mode never uses the draft — don't overwrite it

    const saveData = async () => {
      try {
        const dataToSave = {
          ...values,
          urgent,
          maxApplicants,
          equipment,
          countyCode,
          municipalityCode,
          areaCode,
          latitude: coordinates?.[0] ?? null,
          longitude: coordinates?.[1] ?? null,
          fromDate,
          toDate,
          durationValue,
          durationUnit,
          hourlyRate,
          paymentType,
          tags,
          currentStep,
          currentImages,
          imagesToDelete,
          showSmartFillInput,
          smartFillPrompt,
          checklistItems,
        };
        await saveFormData(dataToSave, selectedImages);
      } catch (err) {
        console.error('Error saving form data:', err);
      }
    };
    saveData();
  }, [
    isLoaded,
    values,
    urgent,
    equipment,
    countyCode,
    municipalityCode,
    areaCode,
    fromDate,
    toDate,
    durationValue,
    durationUnit,
    hourlyRate,
    paymentType,
    tags,
    currentStep,
    selectedImages,
    currentImages,
    imagesToDelete,
    showSmartFillInput,
    smartFillPrompt,
    maxApplicants,
    checklistItems,
    coordinates,
  ]);
  const validateStep = (step: number) => {
    const currentErrors: Partial<Record<keyof JobFormValues, string>> = {};
    // `images`, `coordinates`, `countyCode` and `municipalityCode` are validated here but
    // are not fields of JobFormValues — they live in their own state. Same object, wider
    // key type, so they can be reported through the one error channel the UI reads.
    const extraErrors = currentErrors as Record<string, string>;
    let isValid = true;

    if (step === 1) {
      // Validate Step 1 fields
      const fieldsToValidate: (keyof JobFormValues)[] = ['title', 'description', 'categories'];
      fieldsToValidate.forEach((field) => {
        const rules = jobValidationSchema[field];
        if (rules) {
          for (const rule of rules) {
            if (!rule.test(values)) {
              currentErrors[field] = rule.message;
              isValid = false;
              break;
            }
          }
        }
      });

      // Special check for images
      if (selectedImages.length === 0 && currentImages.length === 0) {
        extraErrors.images = 'Vennligst last opp minst ett bilde.';
        isValid = false;
      }
    } else if (step === 2) {
      // Validate Step 2 fields
      const fieldsToValidate: (keyof JobFormValues)[] = [
        'address',
        'city',
        'price',
        'durationValue',
        'fromDate',
        'toDate',
      ];
      fieldsToValidate.forEach((field) => {
        const rules = jobValidationSchema[field];
        if (rules) {
          for (const rule of rules) {
            if (!rule.test(values)) {
              if (field === 'price') {
                if (paymentType === 'Anbud') {
                  currentErrors[field] =
                    'Vennligst oppgi et antatt budsjett større enn 0 kr for anbudet';
                } else if (paymentType === 'Timepris') {
                  currentErrors[field] = 'Vennligst oppgi en timepris større enn 0 kr';
                } else {
                  currentErrors[field] = 'Vennligst oppgi en fastpris større enn 0 kr';
                }
              } else {
                currentErrors[field] = rule.message;
              }
              isValid = false;
              break;
            }
          }
        }
      });

      // A typed address alone is not enough — the location must be confirmed
      // on the map (click pin / drag marker / geolocation), otherwise the job
      // silently posts with default coordinates. Coordinates live outside the
      // validation schema, so enforce the requirement here.
      //
      // These three used to fail silently: `isValid` went false and the toast named the
      // field, but nothing on the page turned red, so there was no target to scroll to and
      // nothing to look at once you got there. They write a message now like any other field.
      if (!coordinates) {
        extraErrors.coordinates =
          'Bekreft hvor oppdraget er — velg en adresse fra forslagene eller klikk i kartet.';
        isValid = false;
      }

      // Fylke and Kommune are marked required in the UI but sit outside the
      // schema too. Without them the job never matches the location filter
      // (serviceController.getAllServices), so it is invisible to the people
      // searching in that area.
      if (!countyCode) {
        extraErrors.countyCode = 'Velg fylke.';
        isValid = false;
      }
      if (!municipalityCode) {
        extraErrors.municipalityCode = 'Velg kommune.';
        isValid = false;
      }
    } else if (step === 4) {
      // Validate Step 4 fields (Contact Information)
      const fieldsToValidate: (keyof JobFormValues)[] = ['email', 'phone'];
      fieldsToValidate.forEach((field) => {
        const rules = jobValidationSchema[field];
        if (rules) {
          for (const rule of rules) {
            if (!rule.test(values)) {
              currentErrors[field] = rule.message;
              isValid = false;
              break;
            }
          }
        }
      });
    }

    setErrors((prev) => ({ ...prev, ...currentErrors }));
    return isValid;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      return;
    }

    // The toast names what is missing; this takes them to it. Without it the page sits
    // still, and on a step several screens tall the empty field is usually off screen.
    scrollToFirstError();

    // Build a friendlier error message that names the missing/invalid fields
    // so the user knows what to fix instead of just "please fill in everything".
    // We re-run a quick check directly against the current state because
    // `setErrors` inside validateStep is async and the closure here still
    // holds the previous error snapshot.
    const labels: Record<string, string> = {
      title: 'tittel',
      description: 'beskrivelse',
      categories: 'kategori',
      address: 'adresse',
      city: 'by/sted',
      price: 'budsjett',
      durationValue: 'forventet varighet',
      fromDate: 'startdato',
      toDate: 'sluttdato',
      email: 'e-post',
      phone: 'telefon',
      images: 'bilde',
      countyCode: 'fylke',
      municipalityCode: 'kommune',
    };

    const missing: string[] = [];

    // Re-check fields with their validation rules to know exactly which ones failed.
    if (currentStep === 1) {
      if (!values.title || values.title.length < 5) missing.push(labels.title);
      if (!values.description || values.description.length < 20) missing.push(labels.description);
      const catOk = Array.isArray(values.categories)
        ? values.categories.length > 0
        : !!values.categories && String(values.categories).trim() !== '';
      if (!catOk) missing.push(labels.categories);
      if (selectedImages.length === 0 && currentImages.length === 0) missing.push(labels.images);
    } else if (currentStep === 2) {
      if (!values.address) missing.push(labels.address);
      if (!values.city) missing.push(labels.city);
      const priceVal = values.price;
      if (!priceVal || priceVal === '0' || Number(priceVal) <= 0 || isNaN(Number(priceVal))) {
        if (paymentType === 'Anbud') {
          missing.push('antatt budsjett for anbud');
        } else if (paymentType === 'Timepris') {
          missing.push('timepris');
        } else {
          missing.push('fastpris');
        }
      }
      const durVal = values.durationValue;
      if (!durVal || durVal === '0' || Number(durVal) <= 0) missing.push(labels.durationValue);
      if (!values.fromDate) missing.push(labels.fromDate);
      if (!values.toDate) {
        missing.push(labels.toDate);
      } else if (values.fromDate && new Date(values.toDate) < new Date(values.fromDate)) {
        missing.push('gyldig sluttdato (kan ikke være før startdato)');
      }
      if (!countyCode) missing.push(labels.countyCode);
      if (!municipalityCode) missing.push(labels.municipalityCode);
      if (!coordinates) missing.push('lokasjon på kartet');
    } else if (currentStep === 4) {
      // Phone and e-mail are optional here (the step is labelled "Valgfritt" and
      // neither has a required-rule), so only a malformed e-mail can block.
      if (values.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(values.email).trim())) missing.push(labels.email);
      }
    }

    if (missing.length > 0) {
      const list =
        missing.length === 1
          ? missing[0]
          : missing.length === 2
            ? `${missing[0]} og ${missing[1]}`
            : `${missing.slice(0, -1).join(', ')} og ${missing[missing.length - 1]}`;
      toast.error(`Vennligst fyll ut: ${list}.`);
    } else {
      toast.error('Vennligst fyll ut alle påkrevde felt riktig.');
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinalSubmit = async () => {
    // Defensive guard: if we're somehow already submitting, ignore the click
    // (prevents double-submission and any "stuck loading" state from a previous
    // failed run that didn't reach `finally`).
    if (isSubmitting) return;

    // Publish validates the whole form, not just the step in front of you.
    //
    // It used to check step 4 alone, plus a special case for the missing map pin. But
    // `loadFormData` restores `currentStep`, so a draft saved on step 4 reopens there — and
    // an empty title from step 1 then sailed past this guard and failed server-side, with
    // nothing marked anywhere on the page for the person to be sent to. `find` stops at the
    // first failing step, which is the one worth taking them to. Step 3 is the checklist and
    // has no required fields.
    const firstInvalidStep = [1, 2, 4].find((step) => !validateStep(step));

    if (firstInvalidStep) {
      if (currentStep !== firstInvalidStep) setCurrentStep(firstInvalidStep);
      toast.error(
        firstInvalidStep === 2 && !coordinates
          ? 'Bekreft hvor oppdraget skal utføres på kartet før du publiserer.'
          : 'Vennligst fyll ut alle påkrevde felt riktig.'
      );
      // Sending them back a step is not enough on its own — the step opens at the top and the
      // field is usually below the fold, and on the frame this runs the new step has not
      // rendered yet. `scrollToFirstError` keeps looking across a few frames for exactly this.
      scrollToFirstError();
      return;
    }

    // Narrowing for TypeScript — step 2 above already refuses to pass without a pin, and
    // publishing without one used to fall back to Oslo city centre, putting the job in the
    // wrong place with no warning at all.
    if (!coordinates) return;

    if (!onSubmit) {
      toast.error('Kunne ikke sende skjemaet. Prøv igjen.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();

      formData.append('title', values.title);
      formData.append('description', values.description);
      formData.append('price', values.price.toString());
      if (hourlyRate) formData.append('hourlyRate', hourlyRate.toString());
      formData.append('urgent', urgent.toString());
      formData.append('maxApplicants', maxApplicants.toString());
      formData.append('equipment', equipment);
      formData.append('paymentType', paymentType);
      // Stored as contactPhone/contactEmail — the Service schema has no `phone`
      // or `email` path, so the old names were dropped by Mongoose strict mode
      // and everything typed in the contact step was thrown away.
      formData.append('contactPhone', values.phone ?? '');
      formData.append('contactEmail', values.email ?? '');

      if (fromDate) formData.append('fromDate', fromDate);
      if (toDate) formData.append('toDate', toDate);

      formData.append('location[address]', values.address);
      formData.append('location[city]', values.city);
      formData.append('location[type]', 'Point');
      formData.append('location[coordinates][0]', coordinates[1].toString()); // lng
      formData.append('location[coordinates][1]', coordinates[0].toString()); // lat
      if (countyCode) formData.append('countyCode', countyCode);
      if (municipalityCode) formData.append('municipalityCode', municipalityCode);
      if (areaCode) formData.append('areaCode', areaCode);

      if (values.categories) {
        const catArray = Array.isArray(values.categories) ? values.categories : [values.categories];
        catArray.forEach((cat) => formData.append('categories', cat));
      }

      tags.forEach((tag) => formData.append('tags', tag));

      if (durationValue) {
        formData.append('duration[value]', durationValue.toString());
        formData.append('duration[unit]', durationUnit);
      }

      selectedImages.forEach((file) => {
        formData.append('images', file);
      });

      imagesToDelete.forEach((url) => {
        formData.append('imagesToDelete', url);
      });

      if (checklistItems.length > 0) {
        formData.append('checklist', JSON.stringify(checklistItems));
      }

      if (!isEditMode && userId) {
        formData.append('userId', userId);
      }

      await onSubmit(formData);
      // Clear the draft only after a successful POST, best-effort. Awaiting it
      // first would let an IndexedDB hang/failure block the request and leave
      // the Publish button stuck in a loading state forever.
      // Edit mode never loads the draft, so clearing it here would throw away an
      // unrelated half-written job the user has in progress.
      if (!isEditMode) clearFormData().catch(() => { });
    } catch (error) {
      // The draft is deliberately left intact here — this catch is the failed
      // publish path, and it is the only copy of what the user typed.
      console.error('Submission error:', error);
      toast.error(
        getErrorMessage(error, 'Det oppstod en feil ved sending av oppdraget. Prøv igjen.')
      );
    } finally {
      // Always reset — even if the onSubmit promise never resolves or a
      // previous run crashed before reaching its own finally.
      setIsSubmitting(false);
    }
  };

  const handleExistingImageRemove = (url: string) => {
    setCurrentImages((prev) => prev.filter((img) => img !== url));
    setImagesToDelete((prev) => [...prev, url]);
  };

  const handleCancel = async () => {
    await clearFormData();
    window.location.reload();
  };

  const previewJobData = useMemo(() => {
    const previewImages = [
      ...currentImages,
      ...selectedImages.map((file) => URL.createObjectURL(file)),
    ];

    return {
      title: values.title,
      description: values.description,
      price: values.price ? parseInt(values.price.toString()) : 0,
      hourlyRate: hourlyRate ? parseInt(hourlyRate.toString()) : 0,
      images: previewImages,
      tags:
        tags.length > 0
          ? tags
          : values.categories
            ? Array.isArray(values.categories)
              ? values.categories
              : [values.categories]
            : [],
      location: {
        address: values.address,
        city: values.city,
        coordinates: (coordinates ? [coordinates[1], coordinates[0]] : [10.7461, 59.9127]) as [
          number,
          number,
        ],
      },
      duration: {
        value: durationValue ? parseInt(durationValue.toString()) : 0,
        unit: durationUnit,
      },
      fromDate,
      toDate,
      createdAt: new Date().toISOString(),
      userId: {
        _id: currentUser?._id || 'preview',
        name: currentUser?.name || 'Ditt navn',
        avatarUrl:
          currentUser?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
        verified: currentUser?.verified || false,
        averageRating: currentUser?.averageRating || 5.0,
      },
    };
  }, [
    values,
    hourlyRate,
    currentImages,
    selectedImages,
    tags,
    durationValue,
    durationUnit,
    fromDate,
    toDate,
    currentUser,
    coordinates,
  ]);

  return {
    currentStep,
    setCurrentStep,
    title: values.title,
    setTitle,
    description: values.description,
    setDescription,
    address: values.address,
    setAddress,
    city: values.city,
    setCity,
    countyCode,
    setCountyCode,
    municipalityCode,
    setMunicipalityCode,
    areaCode,
    setAreaCode,
    coordinates,
    setCoordinates,
    categories: values.categories,
    setCategories,
    equipment,
    setEquipment,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    durationValue,
    setDurationValue,
    durationUnit,
    setDurationUnit,
    price: values.price,
    setPrice,
    hourlyRate,
    setHourlyRate,
    paymentType,
    setPaymentType,
    urgent,
    setUrgent,
    maxApplicants,
    setMaxApplicants,
    phone: values.phone,
    setPhone,
    email: values.email,
    setEmail,
    tags,
    setTags,
    selectedImages,
    // The wrapper, not the raw setter — it also clears the "last opp minst ett bilde" error.
    setSelectedImages: handleImagesChange,
    currentImages,
    setCurrentImages,
    imagesToDelete,
    setImagesToDelete,
    showPreview,
    setShowPreview,
    isGeneratingFullListing,
    isSubmitting,
    smartFillPrompt,
    setSmartFillPrompt,
    showSmartFillInput,
    setShowSmartFillInput,
    smartFillPricingNote,
    setSmartFillPricingNote,
    handleAiSmartFill,
    handleNext,
    handleBack,
    handleFinalSubmit,
    handleExistingImageRemove,
    handleCancel,
    previewJobData,
    currentUser,
    /**
     * `useForm` types its errors as `{ [K in keyof JobFormValues]?: string }`, but
     * `validateStep` also reports on `images`, `coordinates`, `countyCode` and
     * `municipalityCode` — four things validated here that live in their own state rather
     * than in the schema. Consumers read those keys and TypeScript rejected every one of
     * them; the return type says what the object actually contains.
     */
    errors: errors as JobFormErrors,
    checklistItems,
    setChecklistItems,
  };
};
