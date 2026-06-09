import { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import { generateFullJobListing } from "../api/aiAPI";
import { useUserStore } from "../stores/userStore";
import { usePaymentCalculation } from "./usePaymentCalculation";
import { useForm } from "./useForm";
import {
  jobValidationSchema,
  type JobFormValues,
} from "../validations/jobValidations";
import { saveFormData, loadFormData, clearFormData } from "../utils/indexedDB";

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
  phone?: string;
  email?: string;
  images?: string[];
}

export const useCreateJobForm = (
  userId: string,
  initialData?: InitialData,
  isEditMode = false,
  onSubmit?: (formData: FormData) => void,
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
      title: initialData?.title || "",
      description: initialData?.description || "",
      categories: initialData?.categories || "",
      address: initialData?.address || "",
      city: initialData?.city || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      price: initialData?.price || "",
      durationValue: initialData?.durationValue || "",
      fromDate: initialData?.fromDate || "",
      toDate: initialData?.toDate || "",
    },
    jobValidationSchema,
  );

  // Individual states that are not part of the primary validation schema or need special handling
  const [equipment, setEquipment] = useState(initialData?.equipment || "");
  const [countyCode, setCountyCode] = useState(initialData?.countyCode || "");
  const [municipalityCode, setMunicipalityCode] = useState(
    initialData?.municipalityCode || "",
  );
  const [areaCode, setAreaCode] = useState(initialData?.areaCode || "");
  const durationValue = values.durationValue;
  const fromDate = values.fromDate;
  const toDate = values.toDate;

  const setDurationValue = useCallback(
    (val: string) => handleFormChange("durationValue", val),
    [handleFormChange],
  );
  const setFromDate = useCallback(
    (val: string) => handleFormChange("fromDate", val),
    [handleFormChange],
  );
  const setToDate = useCallback(
    (val: string) => handleFormChange("toDate", val),
    [handleFormChange],
  );

  const [durationUnit, setDurationUnit] = useState(
    initialData?.durationUnit || "minutes",
  );

  const [maxApplicants, setMaxApplicants] = useState<string | number>(
    initialData?.maxApplicants || 0,
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
  } = usePaymentCalculation(
    (durationValue ?? "").toString(),
    durationUnit,
    initialData,
  );

  // Sync price from usePaymentCalculation to useForm
  useEffect(() => {
    handleFormChange("price", price);
  }, [price, handleFormChange]);

  const [tags, setTags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [currentImages, setCurrentImages] = useState<string[]>(
    initialData?.images || [],
  );
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingFullListing, setIsGeneratingFullListing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smartFillPrompt, setSmartFillPrompt] = useState("");
  const [showSmartFillInput, setShowSmartFillInput] = useState(false);
  const [checklistItems, setChecklistItems] = useState<
    { id: string; text: string }[]
  >([]);

  // Flag to prevent save effect from running before load completes
  const [isLoaded, setIsLoaded] = useState(false);

  const currentUser = useUserStore((state) => state.user);

  // Category-based checklist suggestions
  const getCategorySuggestions = (category: string): string[] => {
    const suggestions: Record<string, string[]> = {
      Rengjøring: ["Støvsuge", "Vaske gulv", "Rengjøre bad", "Tørke støv"],
      Hagearbeid: ["Klippe plen", "Luke ugress", "Rydde løv", "Trimme hekk"],
      Flyttehjelp: [
        "Pakke bokser",
        "Bære møbler",
        "Montere møbler",
        "Rydde gammel bolig",
      ],
      Snømåking: ["Måke innkjørsel", "Strø grus/salt", "Rydde trapper"],
    };
    return suggestions[category] || [];
  };

  // Auto-update checklist when category changes (only if checklist is empty)
  useEffect(() => {
    const category = Array.isArray(values.categories)
      ? values.categories[0]
      : values.categories;
    if (category && checklistItems.length === 0) {
      const suggestions = getCategorySuggestions(category);
      if (suggestions.length > 0) {
        setChecklistItems(
          suggestions.map((text) => ({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text,
          })),
        );
      }
    }
  }, [values.categories]);

  // Wrappers to maintain compatibility with existing components
  const setTitle = useCallback(
    (val: string) => handleFormChange("title", val),
    [handleFormChange],
  );
  const setDescription = useCallback(
    (val: string) => handleFormChange("description", val),
    [handleFormChange],
  );
  const setAddress = useCallback(
    (val: string) => handleFormChange("address", val),
    [handleFormChange],
  );
  const setCity = useCallback(
    (val: string) => handleFormChange("city", val),
    [handleFormChange],
  );
  const setCategories = useCallback(
    (val: string | string[]) => handleFormChange("categories", val),
    [handleFormChange],
  );
  const setPhone = useCallback(
    (val: string) => handleFormChange("phone", val),
    [handleFormChange],
  );
  const setEmail = useCallback(
    (val: string) => handleFormChange("email", val),
    [handleFormChange],
  );

  const handleAiSmartFill = async () => {
    if (!smartFillPrompt || smartFillPrompt.length < 5) {
      toast.error("Vennligst beskriv hva du trenger hjelp med (min. 5 tegn)");
      return;
    }

    setIsGeneratingFullListing(true);
    try {
      const response = await generateFullJobListing(smartFillPrompt);

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
        } = response.data;

        setMultipleValues({
          title: aiTitle,
          description: aiDesc,
          categories: aiCategory ? aiCategory.trim() : values.categories,
          durationValue: aiDuration?.value || values.durationValue,
          price: aiEstimatedPrice || values.price,
        });

        setTags(aiSkills);

        if (aiHourlyRate) {
          setHourlyRate(aiHourlyRate.toString());
        }

        if (priceRange) {
          setPrice(priceRange.min.toString());
        } else if (aiEstimatedPrice) {
          setPrice(aiEstimatedPrice.toString());
        }

        if (aiDuration && aiDuration.value) {
          setDurationValue(aiDuration.value.toString());
          setDurationUnit(aiDuration.unit || "minutes");
        }

        if (locationRelevance === "remote") {
          setCity("Fjernarbeid / Remote");
        }

        setShowSmartFillInput(false);
        setSmartFillPrompt("");
        toast.success("Skjemaet er fylt ut med AI!");
      }
    } catch (err: any) {
      console.error("SMART FILL ERROR:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Kunne ikke generere jobbinformasjon.";
      toast.error(errorMessage);
    } finally {
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
            title: data.title || "",
            description: data.description || "",
            categories: data.categories || "",
            address: data.address || "",
            city: data.city || "",
            phone: data.phone || "",
            email: data.email || "",
            price: data.price || "",
            durationValue: data.durationValue || "",
            fromDate: data.fromDate || "",
            toDate: data.toDate || "",
          });
          setUrgent(data.urgent || false);
          setMaxApplicants(data.maxApplicants || 0);
          setEquipment(data.equipment || "");
          setCountyCode(data.countyCode || "");
          setMunicipalityCode(data.municipalityCode || "");
          setAreaCode(data.areaCode || "");
          setDurationUnit(data.durationUnit || "minutes");
          setHourlyRate(data.hourlyRate || "");
          setPaymentType(data.paymentType || "Fastpris");
          setTags(data.tags || []);
          setCurrentStep(data.currentStep || 1);
          setCurrentImages(data.currentImages || []);
          setImagesToDelete(data.imagesToDelete || []);
          setShowSmartFillInput(data.showSmartFillInput || false);
          setSmartFillPrompt(data.smartFillPrompt || "");
          setChecklistItems(data.checklistItems || []);

          if (images && images.length > 0) {
            setSelectedImages(images);
          }
        }
      } catch (err) {
        console.error("Error loading form data:", err);
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
        console.error("Error saving form data:", err);
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
  ]);

  const validateStep = (step: number) => {
    const currentErrors: Partial<Record<keyof JobFormValues, string>> = {};
    let isValid = true;

    if (step === 1) {
      // Validate Step 1 fields
      const fieldsToValidate: (keyof JobFormValues)[] = [
        "title",
        "description",
        "categories",
      ];
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
        currentErrors["images" as any] = "Vennligst last opp minst ett bilde.";
        isValid = false;
      }
    } else if (step === 2) {
      // Validate Step 2 fields
      const fieldsToValidate: (keyof JobFormValues)[] = [
        "address",
        "city",
        "price",
        "durationValue",
        "fromDate",
        "toDate",
      ];
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
    } else if (step === 4) {
      // Validate Step 4 fields (Contact Information)
      const fieldsToValidate: (keyof JobFormValues)[] = ["email", "phone"];
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
    } else {
      toast.error("Vennligst fyll ut alle påkrevde felt riktig.");
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinalSubmit = async () => {
    if (!validateStep(4)) {
      toast.error("Vennligst fyll ut alle påkrevde felt riktig.");
      return;
    }

    if (!onSubmit) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();

      formData.append("title", values.title);
      formData.append("description", values.description);
      formData.append("price", values.price.toString());
      if (hourlyRate) formData.append("hourlyRate", hourlyRate.toString());
      formData.append("urgent", urgent.toString());
      formData.append("maxApplicants", maxApplicants.toString());
      formData.append("equipment", equipment);
      formData.append("paymentType", paymentType);
      formData.append("phone", values.phone);
      formData.append("email", values.email);

      if (fromDate) formData.append("fromDate", fromDate);
      if (toDate) formData.append("toDate", toDate);

      formData.append("location[address]", values.address);
      formData.append("location[city]", values.city);
      formData.append("location[type]", "Point");
      formData.append("location[coordinates][0]", "10.7461");
      formData.append("location[coordinates][1]", "59.9127");
      if (countyCode) formData.append("countyCode", countyCode);
      if (municipalityCode)
        formData.append("municipalityCode", municipalityCode);
      if (areaCode) formData.append("areaCode", areaCode);

      if (values.categories) {
        const catArray = Array.isArray(values.categories)
          ? values.categories
          : [values.categories];
        catArray.forEach((cat) => formData.append("categories", cat));
      }

      tags.forEach((tag) => formData.append("tags", tag));

      if (durationValue) {
        formData.append("duration[value]", durationValue.toString());
        formData.append("duration[unit]", durationUnit);
      }

      selectedImages.forEach((file) => {
        formData.append("images", file);
      });

      imagesToDelete.forEach((url) => {
        formData.append("imagesToDelete", url);
      });

      if (checklistItems.length > 0) {
        formData.append("checklist", JSON.stringify(checklistItems));
      }

      if (!isEditMode && userId) {
        formData.append("userId", userId);
      }

      await clearFormData();
      await onSubmit(formData);
    } catch (error) {
      console.error("Submission error:", error);
    } finally {
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
        coordinates: [10.7461, 59.9127] as [number, number],
      },
      duration: {
        value: durationValue ? parseInt(durationValue.toString()) : 0,
        unit: durationUnit,
      },
      fromDate,
      toDate,
      createdAt: new Date().toISOString(),
      userId: {
        _id: currentUser?._id || "preview",
        name: currentUser?.name || "Ditt navn",
        avatarUrl:
          currentUser?.avatarUrl ||
          "https://api.dicebear.com/7.x/avataaars/svg?seed=default",
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
    setSelectedImages,
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
    handleAiSmartFill,
    handleNext,
    handleBack,
    handleFinalSubmit,
    handleExistingImageRemove,
    handleCancel,
    previewJobData,
    currentUser,
    errors, // Exporting errors for validation display
    checklistItems,
    setChecklistItems,
  };
};
