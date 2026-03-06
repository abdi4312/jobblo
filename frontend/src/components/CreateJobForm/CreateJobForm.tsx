import React, { useState } from "react";
import { ImageUpload } from "./ImageUpload";
import { Image } from "lucide-react";
import { BasicInformation } from "./BasicInformation";
import { TimeAndPlace } from "./TimeAndPlace";
import { PaymentInformation } from "./PaymentInformation";
import { FormActions } from "./FormActions";

export default function CreateJobForm({ onSubmit, userId, initialData, isEditMode = false }: any) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [categories, setCategories] = useState(initialData?.categories || "");
  const [urgent, setUrgent] = useState(initialData?.urgent || false);
  const [equipment, setEquipment] = useState(initialData?.equipment || "");
  const [fromDate, setFromDate] = useState(initialData?.fromDate || "");
  const [toDate, setToDate] = useState(initialData?.toDate || "");
  const [durationValue, setDurationValue] = useState(initialData?.durationValue || "");
  const [durationUnit, setDurationUnit] = useState(initialData?.durationUnit || "hours");
  const [paymentType, setPaymentType] = useState(initialData?.paymentType || "Fastpris");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const handleFinalSubmit = () => {
    // Form validation ya extra logic yahan aa sakta hai
    const jobData: any = {
      title,
      description,
      price: Number(price),
      urgent,
      equipment,
      location: {
        type: 'Point',
        address,
        city,
        coordinates: [10.7461, 59.9127]
      },
      categories: [categories].filter(Boolean),
      fromDate,
      toDate,
      duration: durationValue ? { value: Number(durationValue), unit: durationUnit } : null,
      images: selectedImages,
      paymentType
    };

    if (!isEditMode && userId) jobData.userId = userId;

    onSubmit(jobData);
  };
  const handleCancel = () => {
    // Form reset logic ya redirect logic yahan aa sakta hai
    setTitle("");
    setDescription("");
    setPrice("");
    setAddress("");
    setCity("");
    setCategories("");
    setUrgent(false);
    setEquipment("");
    setFromDate("");
    setToDate("");
    setDurationValue("");
    setDurationUnit("hours");
    setPaymentType("Fastpris");
    setSelectedImages([]);
  }
  return (
    // yahan e.preventDefault FormActions handle kar lega
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-6">
        {/* 1. Image Upload Section */}
        <div className="bg-[#FFFFFF1A] rounded-xl shadow-md p-6">
          <div className="bg-[#FFFFFFB2] p-6 rounded-xl border border-[#0A0A0A1A]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#2F7E47]"><Image size={20} /></span>
              <h2 className="font-bold text-[20px] text-[#0A0A0A]">Bilder</h2>
              <p className="text-[#6A7282] font-normal text-[14px]">(Valgfritt, maks 6)</p>
            </div>
            <ImageUpload onImagesChange={(files) => setSelectedImages(files)} />
          </div>

          <BasicInformation
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            categories={categories}
            setCategories={setCategories}
          />
        </div>

        {/* 2. Time and Place Section */}
        <div className="bg-[#FFFFFF1A] rounded-xl shadow-md p-6">
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
        </div>

        {/* 3. Payment Section */}
        <div className="bg-[#FFFFFF1A] rounded-xl shadow-md p-6">
          <PaymentInformation
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            price={price}
            setPrice={setPrice}
            urgent={urgent}
            setUrgent={setUrgent}
          />
        </div>

        {/* 4. Action Buttons (Responsive & Fixed) */}
        <FormActions
          onCancel={handleCancel}
          onPreview={() => console.log("Previewing:")}
          onSubmit={handleFinalSubmit}
        />
      </div>
    </form>
  );
}