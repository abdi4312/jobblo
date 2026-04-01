import axios from 'axios';
import { Platform } from 'react-native';

// Android Emulator: 10.0.2.2
// Real Device: Your Computer's Local IP (e.g., 192.168.1.5)
const DEV_IP = '192.168.79.26';

const BASE_URL = Platform.OS === 'android' 
    ? `http://${DEV_IP}:5001/api` 
    : 'http://localhost:5001/api';

console.log('API Base URL:', BASE_URL);

export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Interceptor for debugging
api.interceptors.request.use(request => {
    console.log('--- Request ---');
    console.log('Method:', request.method?.toUpperCase());
    console.log('URL:', request.baseURL + (request.url || ''));
    console.log('Data:', JSON.stringify(request.data));
    return request;
});

api.interceptors.response.use(
    response => {
        console.log('--- Response Success ---');
        console.log('Status:', response.status);
        return response;
    },
    error => {
        console.log('--- Response Error ---');
        console.log('Message:', error.message);
        console.log('Code:', error.code);
        if (error.response) {
            console.log('Data:', JSON.stringify(error.response.data));
            console.log('Status:', error.response.status);
        }
        return Promise.reject(error);
    }
);
