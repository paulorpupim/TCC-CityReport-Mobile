import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const urlBase = process.env.EXPO_PUBLIC_API_URL;

if (!urlBase) {
  throw new Error(
    'Configure EXPO_PUBLIC_API_URL no arquivo .env da raiz do aplicativo.'
  );
}

export const api = axios.create({
  baseURL: urlBase,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use(async (config) => {

  if (config.url?.startsWith('/api/auth/')) {
    return config;
  }

  const token = await SecureStore.getItemAsync('cityreport_token');

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});
