import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "@tanstack/react-form";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRegister } from "../features/auth/hooks/useAuth";
import { ActivityIndicator, Alert } from "react-native";

interface RegisterForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterForm>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }

      const [name, ...lastNameArr] = value.fullName.split(" ");
      const lastName = lastNameArr.join(" ");

      registerMutation.mutate({
        name,
        lastName,
        email: value.email,
        password: value.password,
      });
    },
  });

  const Field = form.Field;

  return (
    <ImageBackground
      source={{
        uri: "https://images.unsplash.com/photo-1581244276891-8309cfbb304c?q=80&w=2070&auto=format&fit=crop",
      }}
      className="flex-1"
    >
      <View className="flex-1 bg-black/60 px-6">
        <StatusBar style="light" />
        <SafeAreaView className="flex-1">
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Back Button */}
            <View className="flex-row items-center pt-4">
              <TouchableOpacity
                onPress={() => router.back()}
                className="flex-row items-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
                <Text className="text-white ml-2 text-base font-medium">
                  Tilbake
                </Text>
              </TouchableOpacity>
            </View>

            {/* Logo */}
            <View className="items-center mt-8 mb-8">
              <View className="relative">
                <View className="absolute -top-6 right-6">
                  <Ionicons name="leaf" size={24} color="white" />
                </View>
                <View className="flex-row items-center">
                  <Text className="text-white text-4xl font-bold">Jobblo</Text>
                  <View className="w-2 h-2 bg-white rounded-full ml-2 mt-2" />
                </View>
              </View>
              <Text className="text-white/80 mt-2 text-lg">
                Opprett ny konto
              </Text>
            </View>

            {/* Form */}
            <View className="space-y-4">
              {/* Full Name Input */}
              <View>
                <Text className="text-white mb-2 text-base">Fullt navn</Text>
                <Field name="fullName">
                  {(field) => (
                    <View className="flex-row items-center bg-white rounded-xl px-4 py-3">
                      <Ionicons name="person-outline" size={20} color="#666" />
                      <TextInput
                        className="flex-1 ml-3 text-base text-gray-800"
                        placeholder="Ola Nordmann"
                        placeholderTextColor="#999"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChangeText={(value) => field.handleChange(value)}
                      />
                    </View>
                  )}
                </Field>
              </View>

              {/* Email Input */}
              <View className="mt-4">
                <Text className="text-white mb-2 text-base">E-post</Text>
                <Field name="email">
                  {(field) => (
                    <View className="flex-row items-center bg-white rounded-xl px-4 py-3">
                      <Ionicons name="mail-outline" size={20} color="#666" />
                      <TextInput
                        className="flex-1 ml-3 text-base text-gray-800"
                        placeholder="ola@jobblo.com"
                        placeholderTextColor="#999"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChangeText={(value) => field.handleChange(value)}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>
                  )}
                </Field>
              </View>

              {/* Password Input */}
              <View className="mt-4">
                <Text className="text-white mb-2 text-base">Passord</Text>
                <Field name="password">
                  {(field) => (
                    <View className="flex-row items-center bg-white rounded-xl px-4 py-3">
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#666"
                      />
                      <TextInput
                        className="flex-1 ml-3 text-base text-gray-800"
                        placeholder="........."
                        placeholderTextColor="#999"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChangeText={(value) => field.handleChange(value)}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Ionicons
                          name={
                            showPassword ? "eye-off-outline" : "eye-outline"
                          }
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </Field>
              </View>

              {/* Confirm Password Input */}
              <View className="mt-4">
                <Text className="text-white mb-2 text-base">
                  Bekreft passord
                </Text>
                <Field name="confirmPassword">
                  {(field) => (
                    <View className="flex-row items-center bg-white rounded-xl px-4 py-3">
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#666"
                      />
                      <TextInput
                        className="flex-1 ml-3 text-base text-gray-800"
                        placeholder="........."
                        placeholderTextColor="#999"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChangeText={(value) => field.handleChange(value)}
                        secureTextEntry={!showConfirmPassword}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        <Ionicons
                          name={
                            showConfirmPassword
                              ? "eye-off-outline"
                              : "eye-outline"
                          }
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </Field>
              </View>

              {/* Register Button */}
              <TouchableOpacity
                onPress={() => {
                  console.log("Register button pressed");
                  form.handleSubmit();
                }}
                disabled={registerMutation.isPending}
                className={`rounded-xl py-4 mt-6 items-center ${registerMutation.isPending ? "bg-[#E68A2E]/70" : "bg-[#E68A2E]"}`}
              >
                {registerMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-lg font-bold">
                    Registrer deg
                  </Text>
                )}
              </TouchableOpacity>

              {/* Or Separator */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-[1px] bg-gray-500" />
                <Text className="text-white px-3 text-xs">eller</Text>
                <View className="flex-1 h-[1px] bg-gray-500" />
              </View>

              {/* Social Logins */}
              <View className="space-y-3">
                <TouchableOpacity className="flex-row items-center bg-black rounded-xl py-4 px-4 border border-gray-700 justify-center">
                  <View className="mr-3 bg-white rounded-full p-1">
                    <Ionicons name="logo-google" size={16} color="black" />
                  </View>
                  <Text className="text-white font-semibold">
                    Continue with Google
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity className="flex-row items-center bg-black rounded-xl py-4 px-4 border border-gray-700 justify-center mt-3">
                  <Ionicons name="logo-apple" size={20} color="white" />
                  <Text className="text-white ml-3 font-semibold">
                    Continue with Apple
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Login Link */}
            <View className="flex-row justify-center mt-10 mb-6">
              <Text className="text-white text-sm">
                Har du allerede en konto?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text className="text-[#E68A2E] text-sm font-bold">
                  Logg inn
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});
