import React, { useState } from "react";
import { ImageUpload } from "./ImageUpload"; // Path sahi check kar lein
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
  const [paymentType, setPaymentType] = useState("Fastpris");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const jobData = {
      title,
      description,
      price: Number(price),
      urgent,
      equipment,
      location: {
        type: 'Point',
        address,
        city,
        coordinates: [10.7461, 59.9127] // Default for Oslo, aap isse dynamic bana sakte hain
      },
      categories: [categories].filter(Boolean), // Single selection ko array mein convert kar raha hai
      fromDate,
      toDate,
      duration: durationValue ? { value: Number(durationValue), unit: durationUnit } : null,
      images: selectedImages
    };

    if (!isEditMode && userId) jobData.userId = userId;
    onSubmit(jobData);
  };


  return (

    <form onSubmit={handleSubmit}>
      <div className="bg-[#FFFFFF1A] rounded-xl shadow-md p-6">
        {/* 1. Image Upload Section */}
        <div className="bg-[#FFFFFFB2] p-6 rounded-xl">
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

      <div className="bg-[#FFFFFF1A] rounded-xl shadow-md p-6 mt-6">
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

      <div className="bg-[#FFFFFF1A] rounded-xl shadow-md p-6 mt-6">
        <PaymentInformation
          paymentType={paymentType}
          setPaymentType={setPaymentType}
          price={price}
          setPrice={setPrice}
          urgent={urgent}
          setUrgent={setUrgent}
        />
      </div>
      {/* 10. Submit Button */}
      <FormActions
        onCancel={() => console.log("Cancelled")}
        onPreview={() => console.log("Preview Mode")}
        onSubmit={() => console.log("Form Submitted")}
      />
      {/* <button
        type="submit"
        className="w-full p-[18px] bg-[#4CAF50] text-white rounded-[12px] border-none font-bold text-[18px] cursor-pointer shadow-[0_4px_12px_rgba(76,175,80,0.3)] transition-transform duration-200 hover:bg-[#45a049] active:scale-95"
      >
        {isEditMode || initialData ? "✅ Oppdater oppdrag" : "🚀 Publiser oppdrag"}
      </button> */}
    </form>
  );
}