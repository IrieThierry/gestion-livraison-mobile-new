import { useEffect, useRef, useState } from 'react';
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
import { ecranApresConnexion } from '../../lib/navigation';
import { useMutation } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Fingerprint, Truck } from 'lucide-react-native';
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
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { messageErreurConnexion } from '../../features/auth/erreurConnexion';
import { lireIdentifiantMemorise, memoriserIdentifiant } from '../../features/auth/souvenir';

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
  // M2 « Se souvenir de moi », cochée par défaut : session gardée et
  // identifiant prérempli. Décochée : jetons en mémoire seulement.
  const [seSouvenir, setSeSouvenir] = useState(true);
  const setSession = useAuthStore((s) => s.setSession);
  const deverrouillageBiometriquePossible = useAuthStore((s) => s.deverrouillageBiometriquePossible);
  const deverrouillerParBiometrie = useAuthStore((s) => s.deverrouillerParBiometrie);
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version;
  // Bouton biométrique seulement s'il peut marcher : session gardée, choix
  // « active » pour ce compte et appareil compatible (comme au démarrage).
  const [biometriePossible, setBiometriePossible] = useState(false);
  const [deverrouillage, setDeverrouillage] = useState(false);
  const verrou = useRef(creerVerrou()).current;

  useEffect(() => {
    let actif = true;
    lireIdentifiantMemorise()
      .then((id) => {
        if (actif && id) setUsername((actuel) => actuel || id);
      })
      .catch(() => undefined);
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
      if (user) router.replace(ecranApresConnexion(user) as never);
    } finally {
      setDeverrouillage(false);
    }
  };

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data, input) => {
      const { token, refreshToken, ...user } = data;
      await setSession(token, refreshToken, user, seSouvenir);
      await memoriserIdentifiant(seSouvenir, user.username || input.username);

      // S4 : la question n'est posée qu'une fois par compte et par téléphone,
      // si l'appareil est compatible. Le choix (« active » / « refusee ») est
      // gardé par identifiant, même après la déconnexion. On attend la
      // réponse avant de naviguer. Aucun échec ne bloque la connexion.
      try {
        const identifiant = user.username || input.username;
        // Session non gardée (M2) : pas de biométrie, la question n'est pas posée.
        if (seSouvenir && identifiant && (await Biometric.isAvailable())) {
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

      // M1 : mot de passe provisoire → « Choisis ton nouveau mot de passe ».
      router.replace(ecranApresConnexion(user) as never);
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
    lancerUneFois(verrou, (fin) => mutation.mutate(parsed.data, { onSettled: fin }));
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
            <Text
              accessibilityRole="header"
              className="text-white text-[30px] font-extrabold tracking-tight"
            >
              Bon retour
            </Text>
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

          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => setSeSouvenir((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityLabel="Se souvenir de moi"
              accessibilityState={{ checked: seSouvenir }}
              hitSlop={6}
              className="flex-row items-center gap-2 active:opacity-70"
            >
              <View
                testID="case-se-souvenir"
                className={`w-5 h-5 rounded-md items-center justify-center border ${
                  seSouvenir
                    ? 'bg-emerald-700 border-emerald-700'
                    : 'bg-white dark:bg-slate-800 border-[#d5dcd7] dark:border-slate-600'
                }`}
              >
                {seSouvenir ? <Check color="#fff" size={14} strokeWidth={3} /> : null}
              </View>
              <Text className="text-sm text-[#17201b] dark:text-white">Se souvenir de moi</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(auth)/mot-de-passe-oublie' as never)}
              accessibilityRole="link"
              hitSlop={6}
            >
              <Text className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                Mot de passe oublié ?
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={mutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
            accessibilityState={{ disabled: mutation.isPending, busy: mutation.isPending }}
            className="h-[54px] rounded-2xl bg-emerald-700 items-center justify-center active:opacity-80"
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" accessibilityLabel="Connexion en cours" />
            ) : (
              <Text className="text-white font-extrabold text-base">Se connecter</Text>
            )}
          </Pressable>

          {biometriePossible && seSouvenir ? (
            <Pressable
              onPress={onBiometrie}
              disabled={deverrouillage || mutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Empreinte ou Face ID"
              accessibilityState={{
                disabled: deverrouillage || mutation.isPending,
                busy: deverrouillage,
              }}
              className="h-[54px] rounded-2xl border border-[#d5dcd7] dark:border-slate-700 bg-white dark:bg-slate-900 flex-row items-center justify-center gap-2.5 active:opacity-80"
            >
              {deverrouillage ? (
                <ActivityIndicator color="#047857" accessibilityLabel="Déverrouillage en cours" />
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
