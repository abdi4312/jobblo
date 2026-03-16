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
  const [currentImages, setCurrentImages] = useState<string[]>(initialData?.images || []);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const handleFinalSubmit = () => {
    const formData = new FormData();

    formData.append("title", title);
    formData.append("description", description);
    formData.append("price", price.toString());
    formData.append("urgent", urgent.toString());
    formData.append("equipment", equipment);
    formData.append("paymentType", paymentType);

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
      // Assuming categories is a string based on state, but backend expects array
      const catArray = [categories].filter(Boolean);
      catArray.forEach(cat => formData.append("categories", cat));
    }

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

    onSubmit(formData);
  };

  const handleExistingImageRemove = (url: string) => {
    setCurrentImages((prev) => prev.filter((img) => img !== url));
    setImagesToDelete((prev) => [...prev, url]);
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