import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface JobInfoFormProps {
  title: string;
  setTitle: (text: string) => void;
  description: string;
  setDescription: (text: string) => void;
  location: { address: string; city: string };
  setLocation: (loc: { address: string; city: string }) => void;
  duration: string;
  setDuration: (text: string) => void;
  fromDate: Date;
  setFromDate: (date: Date) => void;
  toDate: Date;
  setToDate: (date: Date) => void;
}

export const JobInfoForm: React.FC<JobInfoFormProps> = ({
  title,
  setTitle,
  description,
  setDescription,
  location,
  setLocation,
  duration,
  setDuration,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}) => {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  return (
    <View>
      <View className="mb-8">
        <Text className="text-sm font-bold mb-2">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Type title of job"
          className="bg-gray-50 rounded-2xl px-4 py-4 text-base mb-6 border border-gray-100"
        />

        <Text className="text-sm font-bold mb-2">Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Type details of job"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="bg-gray-50 rounded-2xl px-4 py-4 text-base h-32 border border-gray-100"
        />
      </View>

      <View className="mb-8">
        <Text className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">
          Time and Location
        </Text>

        <Text className="text-sm font-bold mb-2">Address</Text>
        <TextInput
          value={location.address}
          onChangeText={(text) => setLocation({ ...location, address: text })}
          placeholder="e.g. '123 Main St' or 'Oslo City Center'"
          className="bg-gray-50 rounded-2xl px-4 py-4 text-base mb-6 border border-gray-100"
        />

        <Text className="text-sm font-bold mb-2">City</Text>
        <TextInput
          value={location.city}
          onChangeText={(text) => setLocation({ ...location, city: text })}
          placeholder="Oslo"
          className="bg-gray-50 rounded-2xl px-4 py-4 text-base mb-6 border border-gray-100"
        />

        <Text className="text-sm font-bold mb-2">Estimated duration (hours)</Text>
        <TextInput
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
          placeholder="2"
          className="bg-gray-50 rounded-2xl px-4 py-4 text-base mb-6 border border-gray-100"
        />

        <View className="flex-row justify-between mb-6">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-bold mb-2">From date</Text>
            <TouchableOpacity
              onPress={() => setShowFromPicker(true)}
              className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100"
            >
              <Text className="text-base text-gray-500">
                {fromDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showFromPicker && (
              <DateTimePicker
                value={fromDate}
                mode="date"
                onChange={(e, date) => {
                  setShowFromPicker(false);
                  if (date) setFromDate(date);
                }}
              />
            )}
          </View>
          <View className="flex-1 ml-2">
            <Text className="text-sm font-bold mb-2">To date</Text>
            <TouchableOpacity
              onPress={() => setShowToPicker(true)}
              className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100"
            >
              <Text className="text-base text-gray-500">
                {toDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showToPicker && (
              <DateTimePicker
                value={toDate}
                mode="date"
                onChange={(e, date) => {
                  setShowToPicker(false);
                  if (date) setToDate(date);
                }}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
};
