import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { generateFullJobListing } from "../api/aiAPI";
import { useUserStore } from "../stores/userStore";
import { usePaymentCalculation } from "./usePaymentCalculation";

interface InitialData {
  title?: string;
  description?: string;
  price?: string | number;
  address?: string;
  city?: string;
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
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [address, setAddress] = useState(initialData?.address || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [categories, setCategories] = useState(initialData?.categories || "");
  const [equipment, setEquipment] = useState(initialData?.equipment || "");
  const [fromDate, setFromDate] = useState(initialData?.fromDate || "");
  const [toDate, setToDate] = useState(initialData?.toDate || "");
  const [durationValue, setDurationValue] = useState(
    initialData?.durationValue || "",
  );
  const [durationUnit, setDurationUnit] = useState(
    initialData?.durationUnit || "hours",
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

  const [phone, setPhone] = useState(initialData?.phone || "");
  const [email, setEmail] = useState(initialData?.email || "");
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

  const currentUser = useUserStore((state) => state.user);

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

        setTitle(aiTitle);
        setDescription(aiDesc);

        if (aiCategory) {
          setCategories(aiCategory.trim());
        }

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
          setDurationUnit(aiDuration.unit || "hours");
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

  // Persistence
  useEffect(() => {
    const savedData = localStorage.getItem("jobFormData");
    if (savedData && !initialData) {
      const data = JSON.parse(savedData);
      setTitle(data.title || "");
      setDescription(data.description || "");
      setPrice(data.price || "");
      setAddress(data.address || "");
      setCity(data.city || "");
      setCategories(data.categories || "");
      setUrgent(data.urgent || false);
      setEquipment(data.equipment || "");
      setFromDate(data.fromDate || "");
      setToDate(data.toDate || "");
      setDurationValue(data.durationValue || "");
      setDurationUnit(data.durationUnit || "hours");
      setHourlyRate(data.hourlyRate || "");
      setPaymentType(data.paymentType || "Fastpris");
      setPhone(data.phone || "");
      setEmail(data.email || "");
      setTags(data.tags || []);
      setCurrentStep(data.currentStep || 1);
    }
  }, [initialData, setPrice, setUrgent, setHourlyRate, setPaymentType]);

  useEffect(() => {
    const dataToSave = {
      title,
      description,
      price,
      address,
      city,
      categories,
      urgent,
      equipment,
      fromDate,
      toDate,
      durationValue,
      durationUnit,
      hourlyRate,
      paymentType,
      phone,
      email,
      tags,
      currentStep,
    };
    localStorage.setItem("jobFormData", JSON.stringify(dataToSave));
  }, [
    title,
    description,
    price,
    address,
    city,
    categories,
    urgent,
    equipment,
    fromDate,
    toDate,
    durationValue,
    durationUnit,
    hourlyRate,
    paymentType,
    phone,
    email,
    tags,
    currentStep,
  ]);

  const validateStep = (step: number) => {
    if (step === 1) {
      return (
        title.trim() !== "" &&
        description.trim().length >= 20 &&
        categories !== "" &&
        (selectedImages.length > 0 || currentImages.length > 0)
      );
    }
    if (step === 2) {
      return address.trim() !== "" && city.trim() !== "";
    }
    if (step === 3) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email)) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    } else {
      let msg = "Vennligst fyll ut alle påkrevde felt riktig.";
      if (currentStep === 1) {
        if (description.length < 20) {
          msg = "Beskrivelsen må være minst 20 tegn.";
        } else if (selectedImages.length === 0 && currentImages.length === 0) {
          msg = "Vennligst last opp minst ett bilde.";
        }
      }
      toast.error(msg);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinalSubmit = async () => {
    if (!onSubmit) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();

      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price.toString());
      if (hourlyRate) formData.append("hourlyRate", hourlyRate.toString());
      formData.append("urgent", urgent.toString());
      formData.append("equipment", equipment);
      formData.append("paymentType", paymentType);
      formData.append("phone", phone);
      formData.append("email", email);

      if (fromDate) formData.append("fromDate", fromDate);
      if (toDate) formData.append("toDate", toDate);

      formData.append("location[address]", address);
      formData.append("location[city]", city);
      formData.append("location[type]", "Point");
      formData.append("location[coordinates][0]", "10.7461");
      formData.append("location[coordinates][1]", "59.9127");

      if (categories) {
        const catArray = Array.isArray(categories) ? categories : [categories];
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

      if (!isEditMode && userId) {
        formData.append("userId", userId);
      }

      localStorage.removeItem("jobFormData");
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

  const handleCancel = () => {
    localStorage.removeItem("jobFormData");
    window.location.reload();
  };

  const previewJobData = useMemo(() => {
    const previewImages = [
      ...currentImages,
      ...selectedImages.map((file) => URL.createObjectURL(file)),
    ];

    return {
      title,
      description,
      price: price ? parseInt(price.toString()) : 0,
      hourlyRate: hourlyRate ? parseInt(hourlyRate.toString()) : 0,
      images: previewImages,
      tags:
        tags.length > 0
          ? tags
          : categories
            ? Array.isArray(categories)
              ? categories
              : [categories]
            : [],
      location: {
        address,
        city,
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
    title,
    description,
    price,
    currentImages,
    selectedImages,
    categories,
    address,
    city,
    durationValue,
    durationUnit,
    fromDate,
    toDate,
    currentUser,
    tags,
    hourlyRate,
  ]);

  return {
    currentStep,
    setCurrentStep,
    title,
    setTitle,
    description,
    setDescription,
    address,
    setAddress,
    city,
    setCity,
    categories,
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
    price,
    setPrice,
    hourlyRate,
    setHourlyRate,
    paymentType,
    setPaymentType,
    urgent,
    setUrgent,
    phone,
    setPhone,
    email,
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
  };
};
