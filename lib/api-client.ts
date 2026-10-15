import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { router } from "expo-router";
import { JetonsSession } from "./jetons-session";
import { useAuthStore } from "../stores/authStore";
import { API_BASE_URL } from "./api-url";
import { estRouteAuth } from "./api-error";
import { queryClient } from "./query-client";
import { MESSAGE_ABONNEMENT_EXPIRE } from "../features/abonnement/regles";

const baseURL = API_BASE_URL;

/** M1 : code du 403 renvoyé tant que le mot de passe est provisoire. */
export const CODE_MOT_DE_PASSE_PROVISOIRE = "MOT_DE_PASSE_PROVISOIRE";

export const apiClient = axios.create({ baseURL, timeout: 15000 });

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await JetonsSession.get("access_token");
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
    // Abonnement expiré constaté lors d'une écriture : on relit l'abonnement
    // (clé ['abonnement'], cf. features/abonnement/hooks) pour que le bandeau
    // de l'Accueil s'affiche tout de suite, comme sur le web.
    if (
      error.response?.status === 403 &&
      (error.response.data as { message?: unknown } | undefined)?.message === MESSAGE_ABONNEMENT_EXPIRE
    ) {
      void queryClient.invalidateQueries({ queryKey: ["abonnement"] });
    }
    // M1 : le back refuse les routes métier tant que le mot de passe est
    // provisoire (403, code MOT_DE_PASSE_PROVISOIRE). La session est marquée :
    // la redirection racine ouvre « Choisis ton nouveau mot de passe ».
    if (
      error.response?.status === 403 &&
      (error.response.data as { code?: unknown } | undefined)?.code === CODE_MOT_DE_PASSE_PROVISOIRE
    ) {
      const etat = useAuthStore.getState();
      if (etat.user && !etat.user.motDePasseProvisoire) {
        void etat.majUtilisateur?.({ ...etat.user, motDePasseProvisoire: true });
      }
    }
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;
    // Routes d'authentification (connexion, inscription, rafraîchissement) :
    // un 401 y est une réponse métier (mot de passe refusé…), pas un jeton
    // expiré — on rend l'erreur d'origine à l'écran, sans rafraîchissement.
    if (error.response?.status !== 401 || !original || original._retry || estRouteAuth(original.url)) {
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
      const refreshToken = await JetonsSession.get("refresh_token");
      if (!refreshToken) throw new Error("no refresh token");

      // Le back renvoie { token, refreshToken } sur /auth/refresh — pas
      // { accessToken, refreshToken } comme on supposait avant.
      const { data } = await axios.post<{
        token: string;
        refreshToken: string;
      }>(`${baseURL}/auth/refresh`, { refreshToken });
      await JetonsSession.set("access_token", data.token);
      await JetonsSession.set("refresh_token", data.refreshToken);
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
