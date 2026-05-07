import React from "react";
import { Image, Sparkles, Loader2 } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { BasicInformation } from "./BasicInformation";
import { TimeAndPlace } from "./TimeAndPlace";
import { PaymentInformation } from "./PaymentInformation";
import { StepIndicator } from "./StepIndicator";
import { ContactInformation } from "./ContactInformation";
import { FormActions } from "./FormActions";
import { JobPreviewModal } from "./JobPreviewModal";
import { useCreateJobForm } from "../../hooks/useCreateJobForm";

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
  const {
    currentStep,
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
    price,
    setPrice,
    tags,
    setTags,
    setDurationValue,
    setDurationUnit,
    setHourlyRate,
    durationValue,
    durationUnit,
    hourlyRate,
    paymentType,
    setPaymentType,
    urgent,
    setUrgent,
    phone,
    setPhone,
    email,
    setEmail,
    setSelectedImages,
    currentImages,
    handleExistingImageRemove,
    showPreview,
    setShowPreview,
    showSmartFillInput,
    setShowSmartFillInput,
    smartFillPrompt,
    setSmartFillPrompt,
    handleAiSmartFill,
    isGeneratingFullListing,
    isSubmitting,
    handleNext,
    handleBack,
    handleFinalSubmit,
    handleCancel,
    previewJobData,
    currentUser,
  } = useCreateJobForm(userId, initialData, isEditMode, onSubmit);

  return (
    <div className="max-w-300 mx-auto py-8">
      <StepIndicator currentStep={currentStep} />

      <form
        onSubmit={(e) => e.preventDefault()}
        className="overflow-hidden"
      >
        <div className="p-1">
          {currentStep === 1 && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* AI Assistant Integrated Section */}
              <div className="px-4 pt-4">
                <div
                  className={`relative overflow-hidden transition-all duration-500 rounded-3xl shadow-lg ${
                    showSmartFillInput
                      ? "bg-linear-to-br from-[#1b4b2f] to-[#143924]"
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

              <div className="box-card-custom rounded-[14px] p-4 md:p-6 ">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D]">
                    <Image size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg md:text-xl text-custom-black">
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
                durationValue={durationValue as any}
                setDurationValue={setDurationValue}
                durationUnit={durationUnit}
                setDurationUnit={setDurationUnit}
                fromDate={""} // These were not used in the original component's Step 2 props but were in state
                setFromDate={() => {}}
                toDate={""}
                setToDate={() => {}}
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
                subscription={currentUser?.subscription || "Standard"}
              />
            </div>
          )}

          {currentStep === 3 && (
            <ContactInformation
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              summary={{
                title,
                categories,
                address,
                city,
                price,
                paymentType,
              }}
            />
          )}
        </div>

        <FormActions
          currentStep={currentStep}
          handleBack={handleBack}
          handleCancel={handleCancel}
          handleNext={handleNext}
          handleFinalSubmit={handleFinalSubmit}
          setShowPreview={setShowPreview}
          isSubmitting={isSubmitting}
        />
      </form>

      <JobPreviewModal
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        previewJobData={previewJobData}
      />
    </div>
  );
}
