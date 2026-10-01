import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { router } from "expo-router";
import { SecureStorage } from "./secure-storage";
import { useAuthStore } from "../stores/authStore";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.112.1.143:8089";

export const apiClient = axios.create({ baseURL, timeout: 15000 });

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStorage.get("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
);

let isRefreshing = false;
type QueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (original.headers)
          original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStorage.get("refresh_token");
      if (!refreshToken) throw new Error("no refresh token");

      // Le back renvoie { token, refreshToken } sur /auth/refresh — pas
      // { accessToken, refreshToken } comme on supposait avant.
      const { data } = await axios.post<{
        token: string;
        refreshToken: string;
      }>(`${baseURL}/auth/refresh`, { refreshToken });
      await SecureStorage.set("access_token", data.token);
      await SecureStorage.set("refresh_token", data.refreshToken);
      processQueue(null, data.token);
      if (original.headers)
        original.headers.Authorization = `Bearer ${data.token}`;
      return apiClient(original);
    } catch (refreshErr) {
      // Échec du refresh : on reset complètement la session.
      // 1. Reject toutes les requêtes en attente pour qu'elles s'arrêtent
      //    (les loaders de TanStack Query passent en `error` au lieu de
      //    rester en `loading` indéfiniment).
      processQueue(refreshErr, null);
      // 2. `logout()` du authStore vide SecureStorage + AsyncStorage ET
      //    reset le state Zustand `user → null`. Sans ce reset, l'AuthGate
      //    voyait `user` toujours truthy et bouclait : redirect /login →
      //    AuthGate voit user → redirect /(livreur) → queries refire → 401.
      await useAuthStore.getState().logout();
      router.replace("/(auth)/login");
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
