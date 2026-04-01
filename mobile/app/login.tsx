import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, useField } from "@tanstack/react-form";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useLogin } from "../features/auth/hooks/useAuth";
import { ActivityIndicator } from "react-native";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      console.log("Submitting login with:", value);
      loginMutation.mutate(value);
    },
  });

  const Field = form.Field;

  return (
    <ImageBackground
      source={{
        uri: "https://images.unsplash.com/photo-1581244276891-8309cfbb304c?q=80&w=2070&auto=format&fit=crop",
      }} // Placeholder workshop image
      className="flex-1"
    >
      <View className="flex-1 bg-black/60 px-6">
        <StatusBar style="light" />
        <SafeAreaView className="flex-1">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Navigation */}
            <View className="flex-row justify-end pt-4">
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/job-search")}
              >
                <Text className="text-white text-sm underline font-medium">
                  Browse Jobblo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Logo */}
            <View className="items-center mt-12 mb-10">
              <View className="relative">
                <View className="absolute -top-6 right-6">
                  <Ionicons name="leaf" size={24} color="white" />
                </View>
                <View className="flex-row items-center">
                  <Text className="text-white text-5xl font-bold">Jobblo</Text>
                  <View className="w-2 h-2 bg-white rounded-full ml-2 mt-2" />
                </View>
              </View>
            </View>

            {/* Form */}
            <View className="space-y-4">
              {/* Email Input */}
              <View>
                <Text className="text-white mb-2 text-base">E-post</Text>
                <Field
                  name="email"
                  validators={{
                    onChange: ({ value }) =>
                      !value ? "Email is required" : undefined,
                  }}
                >
                  {(field) => (
                    <View>
                      <View className="flex-row items-center bg-white rounded-xl px-4 py-3">
                        <Ionicons name="mail-outline" size={20} color="#666" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="user1@jobblo.com"
                          placeholderTextColor="#999"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChangeText={(value) => field.handleChange(value)}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0 && (
                          <Text className="text-red-400 text-xs mt-1 ml-1">
                            {field.state.meta.errors.join(", ")}
                          </Text>
                        )}
                    </View>
                  )}
                </Field>
              </View>

              {/* Password Input */}
              <View className="mt-4">
                <Text className="text-white mb-2 text-base">Password</Text>
                <Field
                  name="password"
                  validators={{
                    onChange: ({ value }) =>
                      !value ? "Password is required" : undefined,
                  }}
                >
                  {(field) => (
                    <View>
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
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0 && (
                          <Text className="text-red-400 text-xs mt-1 ml-1">
                            {field.state.meta.errors.join(", ")}
                          </Text>
                        )}
                      <TouchableOpacity className="mt-2 items-end">
                        <Text className="text-white text-xs font-medium">
                          Glemt passord? Klikk her
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Field>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={() => {
                  console.log("Login button pressed");
                  form.handleSubmit();
                }}
                disabled={loginMutation.isPending}
                className={`rounded-xl py-4 mt-6 items-center ${loginMutation.isPending ? "bg-[#E68A2E]/70" : "bg-[#E68A2E]"}`}
              >
                {loginMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-lg font-bold">Logg inn</Text>
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

            {/* Bottom Register Link */}
            <View className="flex-row justify-center mt-10 mb-6">
              <Text className="text-white text-sm">Har du ikke konto? </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text className="text-[#E68A2E] text-sm font-bold">
                  Registrer deg
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
