import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export const useLogin = () => {
    const router = useRouter();

    return useMutation({
        mutationFn: (data: any) => {
            console.log('API Login call started with:', data.email);
            return authApi.login(data);
        },
        onSuccess: (data) => {
            console.log('Login Success:', data.user.email);
            router.replace('/(tabs)');
        },
        onError: (error: any) => {
            console.error('Login Mutation Detailed Error:', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                status: error.response?.status
            });
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
            Alert.alert('Login Failed', errorMessage);
        },
    });
};

export const useRegister = () => {
    const router = useRouter();

    return useMutation({
        mutationFn: (data: any) => authApi.register(data),
        onSuccess: (data) => {
            console.log('Register Success:', data.user.email);
            router.replace('/(tabs)');
        },
        onError: (error: any) => {
            console.error('Register Error:', error.response?.data?.error || error.message);
            Alert.alert('Registration Failed', error.response?.data?.error || 'Something went wrong');
        },
    });
};
