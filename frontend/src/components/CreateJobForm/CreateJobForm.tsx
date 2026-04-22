import React, { useState, useEffect, useMemo } from "react";
import { ImageUpload } from "./ImageUpload";
import {
  Image,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Eye,
  X,
  Check,
} from "lucide-react";
import { BasicInformation } from "./BasicInformation";
import { TimeAndPlace } from "./TimeAndPlace";
import { PaymentInformation } from "./PaymentInformation";
import { useUserStore } from "../../stores/userStore";
import toast from "react-hot-toast";
import { generateFullJobListing } from "../../api/aiAPI";
import { Sparkles, Loader2 } from "lucide-react";
import { usePaymentCalculation } from "../../hooks/usePaymentCalculation";

// Job Detail Components for Preview
import JobImageCarousel from "../job/JobImageCarousel";
import JobDetails from "../job/JobDetails";
import JobDescription from "../job/JobDescription";
import JobProvider from "../job/JobProvider";
import JobLocation from "../job/JobLocation";
import JobContainer from "../job/JobContainer";

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = ["Grunnleggende", "Tid & Sted", "Kontakt"];
  return (
    <div className="flex items-start justify-between mb-12 px-4 md:px-5 max-w-lg mx-auto relative">
      {/* Progress Line Container */}
      <div className="absolute top-4 md:top-5 left-8 md:left-10 right-8 md:right-10 h-[2px] bg-white z-0">
        {/* Active Line Overlay */}
        <div
          className="h-full bg-[#2D7A4D] transition-all duration-500 ease-out"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />
      </div>

      {steps.map((step, index) => (
        <div
          key={index}
          className="flex flex-col items-center relative z-10 shrink-0"
        >
          <div
            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              currentStep > index + 1
                ? "bg-[#2D7A4D] border-[#2D7A4D] text-white"
                : currentStep === index + 1
                  ? "bg-white border-[#2D7A4D] text-[#2D7A4D] shadow-lg scale-110"
                  : "bg-white border-gray-200 text-gray-400"
            }`}
          >
            {currentStep > index + 1 ? (
              <Check size={18} strokeWidth={3} className="md:w-5 md:h-5" />
            ) : (
              <span className="text-sm md:text-base font-bold">
                {index + 1}
              </span>
            )}
          </div>
          <span
            className={`absolute top-10 md:top-12 text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors duration-300 ${
              currentStep === index + 1 ? "text-[#2D7A4D]" : "text-gray-400"
            } hidden xs:block`}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
};

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

interface CreateJobFormProps {
  onSubmit: (formData: FormData) => void;
  userId: string;
  initialData?: InitialData;
  isEditMode?: boolean;
}

export default function CreateJobForm({
  onSubmit,
  userId,
  initialData,
  isEditMode = false,
}: CreateJobFormProps) {
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

        // Robust category matching
        if (aiCategory) {
          setCategories(aiCategory.trim());
        }

        setTags(aiSkills);

        if (aiHourlyRate) {
          setHourlyRate(aiHourlyRate.toString());
        }

        // Price - take mid point or min
        if (priceRange) {
          setPrice(priceRange.min.toString());
        } else if (aiEstimatedPrice) {
          setPrice(aiEstimatedPrice.toString());
        }

        // Duration
        if (aiDuration && aiDuration.value) {
          setDurationValue(aiDuration.value.toString());
          setDurationUnit(aiDuration.unit || "hours");
        }

        // Location
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
  }, [initialData]);

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
    paymentType,
    phone,
    email,
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

  const handleFinalSubmit = () => {
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

    // Location
    formData.append("location[address]", address);
    formData.append("location[city]", city);
    formData.append("location[type]", "Point");
    formData.append("location[coordinates][0]", "10.7461");
    formData.append("location[coordinates][1]", "59.9127");

    // Categories
    if (categories) {
      const catArray = Array.isArray(categories) ? categories : [categories];
      catArray.forEach((cat) => formData.append("categories", cat));
    }

    // Tags
    tags.forEach((tag) => formData.append("tags", tag));

    // Duration
    if (durationValue) {
      formData.append("duration[value]", durationValue.toString());
      formData.append("duration[unit]", durationUnit);
    }

    // Images
    selectedImages.forEach((file) => {
      formData.append("images", file);
    });

    // Images to delete
    imagesToDelete.forEach((url) => {
      formData.append("imagesToDelete", url);
    });

    if (!isEditMode && userId) {
      formData.append("userId", userId);
    }

    localStorage.removeItem("jobFormData");
    onSubmit(formData);
  };

  const handleExistingImageRemove = (url: string) => {
    setCurrentImages((prev) => prev.filter((img) => img !== url));
    setImagesToDelete((prev) => [...prev, url]);
  };

  const handleCancel = () => {
    localStorage.removeItem("jobFormData");
    window.location.reload();
  };

  // Preview Data Object
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
  ]);

  return (
    <div className="max-w-300 mx-auto py-8">
      <StepIndicator currentStep={currentStep} />

      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-[#FFFFFF1A] backdrop-blur-md rounded-2xl md:rounded-3xl shadow-sm overflow-hidden border border-white/20"
      >
        <div className="p-1 md:p-4">
          {currentStep === 1 && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* AI Assistant Integrated Section */}
              <div className="px-4 pt-4">
                <div
                  className={`relative overflow-hidden transition-all duration-500 rounded-3xl shadow-lg ${
                    showSmartFillInput
                      ? "bg-gradient-to-br from-[#1b4b2f] to-[#143924]"
                      : "bg-[#1b4b2f]"
                  }`}
                >
                  <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 space-y-4 text-center md:text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                        <Sparkles className="text-yellow-400 w-3 h-3" />
                        <span className="text-white text-[9px] font-bold uppercase tracking-wider opacity-90">
                          Jobblo AI Assistant
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                          {showSmartFillInput
                            ? "Beskriv oppdraget"
                            : "Fyll ut automatisk med AI"}
                        </h2>
                        <p className="text-white/60 text-xs md:text-sm font-medium max-w-md">
                          Spar tid! Fortell oss hva du trenger hjelp med, så
                          ordner vi resten.
                        </p>
                      </div>
                    </div>

                    <div className="w-full md:w-auto">
                      {!showSmartFillInput ? (
                        <button
                          type="button"
                          onClick={() => setShowSmartFillInput(true)}
                          className="group w-full md:w-[280px] py-4 px-6 bg-white text-[#4F46E5] rounded-2xl font-black text-base 
                          shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-5 h-5 text-[#4F46E5]" />
                          PRØV SMART-UTFYLLING
                        </button>
                      ) : (
                        <div className="w-full md:w-[400px] space-y-3 animate-in slide-in-from-right-4 duration-500">
                          <textarea
                            value={smartFillPrompt}
                            onChange={(e) => setSmartFillPrompt(e.target.value)}
                            placeholder="Beskriv jobben her..."
                            className="w-full min-h-[120px] px-5 py-4 bg-white/5 backdrop-blur-xl border border-white/10 
                            rounded-2xl text-white placeholder-white/20 outline-none focus:border-white/30 
                            transition-all text-sm font-medium resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowSmartFillInput(false)}
                              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold 
                              transition-all border border-white/10"
                            >
                              Avbryt
                            </button>
                            <button
                              type="button"
                              onClick={handleAiSmartFill}
                              disabled={isGeneratingFullListing}
                              className="flex-[2] py-3 bg-white text-[#4F46E5] rounded-xl font-black text-xs
                              hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                            >
                              {isGeneratingFullListing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "FYLL UT NÅ"
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D]">
                    <Image size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg md:text-xl text-[#0A0A0A]">
                      Last opp bilder
                    </h2>
                    <p className="text-gray-500 text-xs md:text-sm">
                      Vis frem oppdraget med inntil 6 bilder
                    </p>
                  </div>
                </div>
                <ImageUpload
                  onImagesChange={(files) => setSelectedImages(files)}
                  existingImages={currentImages}
                  onExistingImageRemove={handleExistingImageRemove}
                />
              </div>

              <BasicInformation
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                categories={categories as any}
                setCategories={setCategories}
                price={price}
                setPrice={setPrice}
                tags={tags}
                setTags={setTags}
                setDurationValue={setDurationValue}
                setDurationUnit={setDurationUnit}
                setHourlyRate={setHourlyRate}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <TimeAndPlace
                address={address}
                setAddress={setAddress}
                city={city}
                setCity={setCity}
                durationValue={durationValue}
                setDurationValue={setDurationValue}
                durationUnit={durationUnit}
                setDurationUnit={setDurationUnit}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
              />
              <PaymentInformation
                paymentType={paymentType}
                setPaymentType={setPaymentType}
                price={price}
                setPrice={setPrice}
                hourlyRate={hourlyRate}
                setHourlyRate={setHourlyRate}
                urgent={urgent}
                setUrgent={setUrgent}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
                <h2 className="font-bold text-lg md:text-xl mb-6">
                  Kontaktinformasjon (Valgfritt)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">
                      Telefonnummer
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ditt nummer"
                      className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white outline-none focus:border-[#2D7A4D] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">
                      E-post
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="din@epost.no"
                      className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white outline-none focus:border-[#2D7A4D] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Oppsummering</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-sm">
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Tittel:</span>
                    <div className="font-semibold truncate sm:mt-1">
                      {title}
                    </div>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Kategori:</span>
                    <div className="font-semibold sm:mt-1">{categories}</div>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Sted:</span>
                    <div className="font-semibold sm:mt-1">
                      {address}, {city}
                    </div>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Pris:</span>
                    <div className="font-semibold sm:mt-1">
                      {price} NOK ({paymentType})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50/80 p-4 md:p-6 flex flex-col md:flex-row rounded-xl items-center justify-between border-t border-gray-100 gap-4">
          <button
            type="button"
            onClick={currentStep === 1 ? handleCancel : handleBack}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-all order-2 md:order-1"
          >
            <ChevronLeft size={20} />
            {currentStep === 1 ? "Avbryt" : "Tilbake"}
          </button>

          <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 md:gap-4 order-1 md:order-2">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-[#2D7A4D] border-2 border-[#2D7A4D] hover:bg-[#2D7A4D]/5 transition-all"
            >
              <Eye size={20} />
              Forhåndsvis
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#2D7A4D] text-white font-bold shadow-lg hover:bg-[#25633e] transition-all"
              >
                Neste
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                type="submit"
                onClick={handleFinalSubmit}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#2D7A4D] text-white font-bold shadow-lg hover:bg-[#25633e] transition-all"
              >
                Publiser
                <CheckCircle2 size={20} />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Full Page Job Detail Preview */}
      {showPreview && (
        <div className="fixed inset-0 z-[10000] bg-[#F5F6F8] overflow-y-auto animate-in fade-in duration-300">
          {/* Header Actions */}
          <div className="sticky top-0 z-[10001] bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 text-gray-600 font-bold hover:bg-gray-100 px-4 py-2 rounded-xl transition-all"
            >
              <ChevronLeft size={20} />
              Lukk forhåndsvisning
            </button>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-xs font-bold text-gray-400 uppercase tracking-widest">
                Forhåndsvisning
              </span>
              <button
                onClick={() => setShowPreview(false)}
                className="bg-[#2D7A4D] text-white p-2 rounded-full hover:bg-[#25633e] transition-all shadow-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="max-w-[1200px] mx-auto px-4 lg:px-0 pt-8 pb-20">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Left Column */}
              <div className="flex-1 w-full min-w-0 space-y-5">
                <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <JobImageCarousel images={previewJobData.images} />
                  <div className="px-6 pt-6 pb-8 sm:px-8 space-y-6">
                    <JobDetails
                      job={{
                        title: previewJobData.title,
                        tags: previewJobData.tags,
                      }}
                    />
                    <div className="border-t border-[#F0F0F0]" />
                    <JobDescription description={previewJobData.description} />
                  </div>
                </div>

                <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <JobProvider job={previewJobData} />
                </div>

                <div className="bg-white rounded-[20px] p-3 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <JobLocation location={previewJobData.location} />
                </div>
              </div>

              {/* Right Column Sidebar */}
              <aside className="lg:w-[360px] w-full lg:sticky lg:top-20 space-y-4 shrink-0">
                <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <div className="h-1.5 bg-[#2F7E47]" />
                  <div className="p-6 space-y-5">
                    <div>
                      <p className="text-[11px] font-semibold text-[#2F7E47] uppercase tracking-widest mb-1">
                        Totalpris
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[42px] font-black text-[#0A0A0A] leading-none tabular-nums">
                          {previewJobData.price.toLocaleString("nb-NO")}
                        </span>
                        <span className="text-[20px] font-semibold text-[#9CA3AF]">
                          kr
                        </span>
                      </div>
                    </div>

                    <button className="w-full py-4 bg-[#2D7A4D] text-white rounded-2xl font-bold shadow-lg opacity-50 cursor-not-allowed">
                      Send melding (Preview)
                    </button>

                    <p className="text-[11px] text-center text-[#9CA3AF] leading-relaxed">
                      Trygt og sikkert oppgjør gjennom Jobblo.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-[20px] p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
                  <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">
                    Oppdragsinfo
                  </p>
                  <JobContainer job={previewJobData} />
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
