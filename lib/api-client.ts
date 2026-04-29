import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import { SecureStorage } from './secure-storage';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8089';

export const apiClient = axios.create({ baseURL, timeout: 15000 });

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStorage.get('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (original.headers) original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStorage.get('refresh_token');
      if (!refreshToken) throw new Error('no refresh token');

      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${baseURL}/auth/refresh`,
        { refreshToken },
      );
      await SecureStorage.set('access_token', data.accessToken);
      await SecureStorage.set('refresh_token', data.refreshToken);
      processQueue(null, data.accessToken);
      if (original.headers) original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      await SecureStorage.clearAuth();
      router.replace('/(auth)/login');
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
