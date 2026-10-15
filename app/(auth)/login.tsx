import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { FormScreen } from '../../components/shared/FormScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { accueilDuProfil } from '../../lib/navigation';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Fingerprint, Truck } from 'lucide-react-native';
import { authApi } from '../../features/auth/api';
import { loginSchema } from '../../features/auth/schemas';
import { useAuthStore } from '../../stores/authStore';
import { Biometric } from '../../lib/biometric';
import {
  enregistrerChoixBiometrie,
  lireChoixBiometrie,
  oublierAncienChoixBiometrie,
} from '../../lib/biometrie-choix';
import { dialog } from '../../lib/dialog';
import * as Network from 'expo-network';
import { messageErreurConnexion } from '../../features/auth/erreurConnexion';

/**
 * Téléphone sans aucune connexion ? Seul `isConnected === false` compte : l'API
 * peut être sur un intranet sans accès internet, donc `isInternetReachable`
 * (et `networkStore`, qui s'en sert) n'est pas utilisé ici.
 */
async function estHorsLigne(): Promise<boolean> {
  try {
    const etat = await Network.getNetworkStateAsync();
    return etat.isConnected === false;
  } catch {
    return false;
  }
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const deverrouillageBiometriquePossible = useAuthStore((s) => s.deverrouillageBiometriquePossible);
  const deverrouillerParBiometrie = useAuthStore((s) => s.deverrouillerParBiometrie);
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version;
  // Bouton biométrique seulement s'il peut marcher : session gardée, choix
  // « active » pour ce compte et appareil compatible (comme au démarrage).
  const [biometriePossible, setBiometriePossible] = useState(false);
  const [deverrouillage, setDeverrouillage] = useState(false);

  useEffect(() => {
    let actif = true;
    deverrouillageBiometriquePossible()
      .then((ok) => {
        if (actif) setBiometriePossible(ok);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [deverrouillageBiometriquePossible]);

  const onBiometrie = async () => {
    if (deverrouillage) return;
    setDeverrouillage(true);
    try {
      const user = await deverrouillerParBiometrie();
      if (user) router.replace(accueilDuProfil(user.profile) as never);
    } finally {
      setDeverrouillage(false);
    }
  };

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data, input) => {
      const { token, refreshToken, ...user } = data;
      await setSession(token, refreshToken, user);

      // S4 : la question n'est posée qu'une fois par compte et par téléphone,
      // si l'appareil est compatible. Le choix (« active » / « refusee ») est
      // gardé par identifiant, même après la déconnexion. On attend la
      // réponse avant de naviguer. Aucun échec ne bloque la connexion.
      try {
        const identifiant = user.username || input.username;
        if (identifiant && (await Biometric.isAvailable())) {
          // Ancienne clé sans propriétaire connu : supprimée, jamais attribuée à ce compte.
          await oublierAncienChoixBiometrie().catch(() => undefined);
          const choix = await lireChoixBiometrie(identifiant);
          if (choix === null) {
            const label = await Biometric.getTypeLabel();
            await new Promise<void>((resolve) => {
              dialog.confirm({
                title: `Activer ${label} ?`,
                message: `La prochaine fois, ouvre l'app avec ${label} au lieu du mot de passe.`,
                cancelLabel: 'Plus tard',
                confirmLabel: 'Activer',
                onCancel: async () => {
                  await enregistrerChoixBiometrie(identifiant, 'refusee').catch(() => undefined);
                  resolve();
                },
                onConfirm: async () => {
                  await enregistrerChoixBiometrie(identifiant, 'active').catch(() => undefined);
                  resolve();
                },
              });
            });
          }
        }
      } catch {
        // Biometric setup is optional — never block login
      }

      router.replace(accueilDuProfil(user.profile) as never);
    },
    onError: async (e: unknown) => {
      const sansReponse = !(e as { response?: unknown } | null)?.response;
      const horsLigne = sansReponse ? await estHorsLigne() : false;
      dialog.error('Connexion impossible', messageErreurConnexion(e, { horsLigne }));
    },
  });

  const onSubmit = () => {
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      dialog.warning('Champs invalides', parsed.error.issues[0]?.message ?? 'Vérifie les informations saisies.');
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <View className="flex-1 bg-[#f6f7f5] dark:bg-slate-950">
      <StatusBar style="light" />
      <FormScreen
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        className="flex-1"
      >
        {/* Bandeau vert */}
        <View
          testID="bandeau-connexion"
          className="bg-emerald-700 px-7 pb-[72px] gap-[22px]"
          style={{ paddingTop: insets.top + 40, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
        >
          <View className="w-14 h-14 rounded-2xl bg-white items-center justify-center">
            <Truck color="#047857" size={28} />
          </View>
          <View className="gap-1.5">
            <Text className="text-white text-[30px] font-extrabold tracking-tight">Bon retour</Text>
            <Text className="text-emerald-100 text-[15px]">
              Connecte-toi pour démarrer ta tournée.
            </Text>
          </View>
        </View>

        {/* Carte du formulaire, à cheval sur le bandeau */}
        <View
          className="-mt-10 mx-[18px] bg-white dark:bg-slate-900 rounded-3xl px-5 py-6 gap-4"
          style={{
            shadowColor: '#17201b',
            shadowOpacity: 0.08,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <View className="gap-2">
            <Text className="text-sm font-bold text-[#17201b] dark:text-white">Nom d'utilisateur</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ton.identifiant"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Nom d'utilisateur"
              className="h-[52px] px-3.5 rounded-[14px] border border-[#d5dcd7] dark:border-slate-700 bg-[#fbfcfb] dark:bg-slate-800 text-base font-medium text-slate-900 dark:text-white"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-[#17201b] dark:text-white">Mot de passe</Text>
            <View className="h-[52px] flex-row items-center pl-3.5 pr-1.5 rounded-[14px] border border-[#d5dcd7] dark:border-slate-700 bg-[#fbfcfb] dark:bg-slate-800">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                accessibilityLabel="Mot de passe"
                className="flex-1 h-full text-base font-medium text-slate-900 dark:text-white"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="w-11 h-11 items-center justify-center active:opacity-60"
              >
                {showPassword ? (
                  <EyeOff color="#5b665f" size={20} />
                ) : (
                  <Eye color="#5b665f" size={20} />
                )}
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={mutation.isPending}
            accessibilityRole="button"
            className="h-[54px] rounded-2xl bg-emerald-700 items-center justify-center active:opacity-80"
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-extrabold text-base">Se connecter</Text>
            )}
          </Pressable>

          {biometriePossible ? (
            <Pressable
              onPress={onBiometrie}
              disabled={deverrouillage || mutation.isPending}
              accessibilityRole="button"
              className="h-[54px] rounded-2xl border border-[#d5dcd7] dark:border-slate-700 bg-white dark:bg-slate-900 flex-row items-center justify-center gap-2.5 active:opacity-80"
            >
              {deverrouillage ? (
                <ActivityIndicator color="#047857" />
              ) : (
                <>
                  <Fingerprint color="#047857" size={20} />
                  <Text className="text-[15px] font-bold text-[#17201b] dark:text-white">
                    Empreinte ou Face ID
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Pied */}
        <View className="flex-1 justify-end items-center gap-2.5 px-6 pt-6">
          <Pressable
            onPress={() => router.push('/(auth)/signup' as never)}
            accessibilityRole="link"
          >
            <Text className="text-sm text-[#5b665f] dark:text-slate-400">
              Pas encore de compte ?{' '}
              <Text className="font-extrabold text-emerald-700 dark:text-emerald-400">
                Créer un compte
              </Text>
            </Text>
          </Pressable>
          {version ? (
            <Text className="text-xs text-[#8a948e] dark:text-slate-500">Version {version}</Text>
          ) : null}
        </View>
      </FormScreen>
    </View>
  );
}
