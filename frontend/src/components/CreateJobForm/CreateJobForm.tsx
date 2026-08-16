import React, { useState, useEffect } from 'react';
import { Image, Sparkles, Loader2, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { BasicInformation } from './BasicInformation';
import { TimeAndPlace } from './TimeAndPlace';
import { PaymentInformation } from './PaymentInformation';
import { StepIndicator } from './StepIndicator';
import { ContactInformation } from './ContactInformation';
import { FormActions } from './FormActions';
import { JobPreviewModal } from './JobPreviewModal';
import { ChecklistStep } from './ChecklistStep';
import { useCreateJobForm } from '../../hooks/useCreateJobForm';
import { CARD } from '../../theme/brand';

/** The two small controls in the smart-fill card's corner. */
const AI_ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-full text-[#9B9E96] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25';

interface InitialData {
  title?: string;
  description?: string;
  price?: string | number;
  address?: string;
  city?: string;
  countyCode?: string;
  municipalityCode?: string;
  areaCode?: string;
  latitude?: number;
  longitude?: number;
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
}

interface CreateJobFormProps {
  onSubmit: (formData: FormData) => void | Promise<unknown>;
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
    setCurrentStep,
    title,
    setTitle,
    description,
    setDescription,
    address,
    setAddress,
    city,
    setCity,
    countyCode,
    setCountyCode,
    municipalityCode,
    setMunicipalityCode,
    areaCode,
    setAreaCode,
    coordinates,
    setCoordinates,
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
    maxApplicants,
    setMaxApplicants,
    equipment,
    setEquipment,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    phone,
    setPhone,
    email,
    setEmail,
    selectedImages,
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
    smartFillPricingNote,
    setSmartFillPricingNote,
    isGeneratingFullListing,
    isSubmitting,
    handleNext,
    handleBack,
    handleFinalSubmit,
    handleCancel,
    previewJobData,
    currentUser,
    errors,
    checklistItems,
    setChecklistItems,
  } = useCreateJobForm(userId, initialData, isEditMode, onSubmit);

  // AI panel state with localStorage
  const [isAiPanelHidden, setIsAiPanelHidden] = useState(() => {
    const saved = localStorage.getItem('jobblo-ai-panel-hidden');
    return saved === 'true';
  });
  const [isAiPanelMinimized, setIsAiPanelMinimized] = useState(() => {
    const saved = localStorage.getItem('jobblo-ai-panel-minimized');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('jobblo-ai-panel-hidden', isAiPanelHidden.toString());
  }, [isAiPanelHidden]);

  useEffect(() => {
    localStorage.setItem('jobblo-ai-panel-minimized', isAiPanelMinimized.toString());
  }, [isAiPanelMinimized]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      <StepIndicator currentStep={currentStep} setCurrentStep={setCurrentStep} />

      <form onSubmit={(e) => e.preventDefault()}>
        <div>
          {currentStep === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-300">
              {/* AI Assistant Integrated Section */}
              {/* Smart-fill. It was a dark green slab with an indigo (#4F46E5) button and
                  a yellow sparkle — three colours from outside the palette, on the loudest
                  element of the page, above the form it is only an optional shortcut to.
                  It is a quiet card now, and the button that starts it is outlined rather
                  than filled, so the eye still lands on the form first. */}
              {!isAiPanelHidden && (
                <div className={`${CARD} overflow-hidden`}>
                  {isAiPanelMinimized ? (
                    <div className="flex items-center justify-between gap-3 p-4">
                      <button
                        type="button"
                        onClick={() => setIsAiPanelMinimized(false)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]">
                          <Sparkles size={16} strokeWidth={2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem] font-semibold text-[#0B0B0B]">
                            Smart-utfylling
                          </span>
                          <span className="block truncate text-[0.8125rem] text-[#63665F]">
                            Klikk for å utvide
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setIsAiPanelMinimized(false)}
                          aria-label="Utvid smart-utfylling"
                          className={AI_ICON_BUTTON}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAiPanelHidden(true)}
                          aria-label="Skjul smart-utfylling"
                          className={AI_ICON_BUTTON}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 md:p-6">
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]">
                          <Sparkles size={16} strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                            {showSmartFillInput ? 'Beskriv oppdraget' : 'Smart-utfylling'}
                          </h2>
                          <p className="mt-1 max-w-md text-[0.8125rem] leading-relaxed text-[#63665F]">
                            Fortell kort hva som skal gjøres — ta gjerne med størrelse,
                            tilstand og tidspunkt, så fyller vi ut resten av skjemaet for deg.
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setIsAiPanelMinimized(true)}
                            aria-label="Minimer smart-utfylling"
                            className={AI_ICON_BUTTON}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAiPanelHidden(true)}
                            aria-label="Skjul smart-utfylling"
                            className={AI_ICON_BUTTON}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        {!showSmartFillInput ? (
                          <button
                            type="button"
                            onClick={() => setShowSmartFillInput(true)}
                            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-5 text-[0.9375rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                          >
                            <Sparkles size={16} strokeWidth={2} className="text-[#2E6641]" />
                            Prøv smart-utfylling
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              value={smartFillPrompt}
                              onChange={(e) => setSmartFillPrompt(e.target.value)}
                              placeholder="F.eks. Male en liten bod på 8 m² utvendig, bør være ferdig i mai."
                              className="min-h-25 w-full resize-none rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] leading-relaxed text-[#0B0B0B] outline-none transition-colors placeholder:text-[#9B9E96] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleAiSmartFill}
                                disabled={isGeneratingFullListing || !smartFillPrompt.trim()}
                                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isGeneratingFullListing && (
                                  <Loader2 size={15} className="animate-spin" />
                                )}
                                {isGeneratingFullListing ? 'Fyller ut…' : 'Fyll ut nå'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowSmartFillInput(false)}
                                disabled={isGeneratingFullListing}
                                className="inline-flex h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B] disabled:opacity-50"
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show button when AI panel is hidden */}
              {isAiPanelHidden && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAiPanelHidden(false);
                    setIsAiPanelMinimized(false);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-medium text-[#63665F] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641]"
                >
                  <Sparkles size={15} strokeWidth={2} className="text-[#2E6641]" />
                  Vis smart-utfylling
                </button>
              )}

              <div
                className={`box-card-custom p-5 md:p-6 transition-colors ${
                  errors?.images ? 'border-[#B4453A]' : ''
                }`}
              >
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]">
                    <Image size={16} strokeWidth={2} />
                  </span>
                  <div>
                    <h2 className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                      Bilder <span className="font-normal text-[#9B9E96]">· påkrevd</span>
                    </h2>
                    <p className="mt-0.5 text-[0.8125rem] text-[#63665F]">
                      Vis frem oppdraget med inntil 6 bilder
                    </p>
                  </div>
                </div>
                <ImageUpload
                  onImagesChange={(files) => setSelectedImages(files)}
                  existingImages={currentImages}
                  onExistingImageRemove={handleExistingImageRemove}
                  initialFiles={selectedImages}
                />
                {errors?.images && (
                  <p className="mt-4 flex items-center gap-1.5 text-[0.8125rem] font-medium text-[#B4453A]">
                    <AlertCircle size={14} /> {errors.images}
                  </p>
                )}
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
                maxApplicants={maxApplicants}
                setMaxApplicants={setMaxApplicants}
                errors={errors}
                durationValue={durationValue}
                durationUnit={durationUnit}
                city={city}
                countyCode={countyCode}
                paymentType={paymentType}
                equipment={equipment}
                urgent={urgent}
                aiPricingNote={smartFillPricingNote}
                onDismissAiPricingNote={() => setSmartFillPricingNote('')}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="animate-in fade-in slide-in-from-right-2 space-y-5 duration-300">
              <TimeAndPlace
                address={address}
                setAddress={setAddress}
                city={city}
                setCity={setCity}
                countyCode={countyCode}
                setCountyCode={setCountyCode}
                municipalityCode={municipalityCode}
                setMunicipalityCode={setMunicipalityCode}
                areaCode={areaCode}
                setAreaCode={setAreaCode}
                coordinates={coordinates}
                setCoordinates={setCoordinates}
                durationValue={durationValue as any}
                setDurationValue={setDurationValue}
                durationUnit={durationUnit}
                setDurationUnit={setDurationUnit}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
                errors={errors}
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
                subscription={currentUser?.subscription || 'Standard'}
                errors={errors}
              />
            </div>
          )}

          {currentStep === 3 && (
            <ChecklistStep
              checklistItems={checklistItems}
              setChecklistItems={setChecklistItems}
              currentCategory={Array.isArray(categories) ? categories[0] : categories}
            />
          )}

          {currentStep === 4 && (
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
              errors={errors}
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
