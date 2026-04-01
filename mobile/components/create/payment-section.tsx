import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface PaymentSectionProps {
  paymentType: 'Fixed Price' | 'Hourly';
  setPaymentType: (type: 'Fixed Price' | 'Hourly') => void;
  price: string;
  setPrice: (text: string) => void;
  urgent: boolean;
  setUrgent: (value: boolean) => void;
  onPublish: () => void;
  isPending: boolean;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentType,
  setPaymentType,
  price,
  setPrice,
  urgent,
  setUrgent,
  onPublish,
  isPending,
}) => {
  const router = useRouter();

  return (
    <View className="mb-12">
      <Text className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">
        Payment
      </Text>

      <Text className="text-sm font-bold mb-2">Payment Type</Text>
      <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-6">
        <TouchableOpacity
          onPress={() => setPaymentType('Fixed Price')}
          className={`flex-1 py-3 rounded-xl items-center ${
            paymentType === 'Fixed Price' ? 'bg-[#2D7A4D]' : ''
          }`}
        >
          <Text
            className={`font-bold ${
              paymentType === 'Fixed Price' ? 'text-white' : 'text-gray-500'
            }`}
          >
            Fixed Price
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPaymentType('Hourly')}
          className={`flex-1 py-3 rounded-xl items-center ${
            paymentType === 'Hourly' ? 'bg-[#2D7A4D]' : ''
          }`}
        >
          <Text
            className={`font-bold ${
              paymentType === 'Hourly' ? 'text-white' : 'text-gray-500'
            }`}
          >
            Hourly
          </Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm font-bold mb-2">Amount (NOK)</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        placeholder="1000"
        className="bg-gray-50 rounded-2xl px-4 py-4 text-base mb-6 border border-gray-100"
      />

      <View className="flex-row items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-10">
        <View className="flex-row items-center">
          <Ionicons name="flash" size={20} color="#E68A2E" />
          <Text className="ml-2 text-base font-medium">Is it urgent?</Text>
        </View>
        <Switch
          value={urgent}
          onValueChange={setUrgent}
          trackColor={{ false: '#767577', true: '#2D7A4D' }}
          thumbColor={urgent ? '#fff' : '#f4f3f4'}
        />
      </View>

      <TouchableOpacity
        onPress={onPublish}
        disabled={isPending}
        className="bg-[#E68A2E] py-5 rounded-2xl items-center mb-4"
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white text-lg font-bold">Publish Job</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-between mb-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-1 py-4 rounded-2xl border border-red-500 items-center mr-2"
        >
          <Text className="text-red-500 font-bold">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 py-4 rounded-2xl border border-gray-300 items-center ml-2 flex-row justify-center">
          <Ionicons name="eye-outline" size={20} color="#333" className="mr-2" />
          <Text className="text-gray-900 font-bold ml-2">Preview</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
