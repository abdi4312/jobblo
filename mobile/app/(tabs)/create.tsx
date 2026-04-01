import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

import { jobApi } from "../../features/job/api/create";
import { ImagePickerSection } from "../../components/create/image-picker-section";
import { CategoryPickerSection } from "../../components/create/category-picker-section";
import { JobInfoForm } from "../../components/create/job-info-form";
import { PaymentSection } from "../../components/create/payment-section";

export default function CreateJobScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form State
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [location, setLocation] = useState({ address: "", city: "" });
  const [price, setPrice] = useState("");
  const [paymentType, setPaymentType] = useState<"Fixed Price" | "Hourly">(
    "Fixed Price",
  );
  const [urgent, setUrgent] = useState(false);
  const [duration, setDuration] = useState("");
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const mutation = useMutation({
    mutationFn: (newJob: any) => jobApi.create(newJob),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      router.back();
    },
  });

  const handlePublish = () => {
    const jobData = {
      title,
      description,
      price: parseFloat(price),
      location,
      categories: selectedCategory ? [selectedCategory] : [],
      images,
      urgent,
      paymentType,
      duration: { value: parseInt(duration), unit: "hours" },
      fromDate,
      toDate,
      status: "open",
    };
    mutation.mutate(jobData);
  };

  return (
    <RNSafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right"]}
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-red-500 text-base font-medium">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold">Post a Job</Text>
        <TouchableOpacity>
          <Text className="text-gray-900 text-base font-medium">Preview</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 py-6"
        showsVerticalScrollIndicator={false}
      >
        <ImagePickerSection images={images} setImages={setImages} />

        <CategoryPickerSection
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />

        <JobInfoForm
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          location={location}
          setLocation={setLocation}
          duration={duration}
          setDuration={setDuration}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
        />

        <PaymentSection
          paymentType={paymentType}
          setPaymentType={setPaymentType}
          price={price}
          setPrice={setPrice}
          urgent={urgent}
          setUrgent={setUrgent}
          onPublish={handlePublish}
          isPending={mutation.isPending}
        />
      </ScrollView>
    </RNSafeAreaView>
  );
}
