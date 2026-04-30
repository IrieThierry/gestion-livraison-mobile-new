import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../features/auth/api';
import { loginSchema } from '../../features/auth/schemas';
import { useAuthStore } from '../../stores/authStore';
import { Biometric } from '../../lib/biometric';
import { SecureStorage } from '../../lib/secure-storage';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const setSession = useAuthStore((s) => s.setSession);

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      const { token, ...user } = data;
      await setSession(token, user);

      // Offer to enable biometric for next launches. We await the Alert
      // promise so the user finishes choosing before we navigate away.
      // Any failure here must NOT block the login — biometric is optional.
      try {
        if (await Biometric.isAvailable()) {
          const already = await SecureStorage.get('biometric_enabled');
          if (already !== '1') {
            const label = await Biometric.getTypeLabel();
            await new Promise<void>((resolve) => {
              Alert.alert(
                `Activer ${label} ?`,
                `La prochaine fois, ouvre l'app avec ${label} au lieu du mot de passe.`,
                [
                  { text: 'Plus tard', style: 'cancel', onPress: () => resolve() },
                  {
                    text: 'Activer',
                    onPress: async () => {
                      await SecureStorage.set('biometric_enabled', '1');
                      resolve();
                    },
                  },
                ],
                { cancelable: false },
              );
            });
          }
        }
      } catch {
        // Biometric setup is optional — never block login
      }

      router.replace('/(livreur)');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      Alert.alert('Erreur', err.response?.data?.message ?? 'Identifiants incorrects');
    },
  });

  const onSubmit = () => {
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      Alert.alert('Erreur', parsed.error.issues[0]?.message ?? 'Champs invalides');
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
          <View className="px-6 py-8">
            {/* Logo — large, centered hero */}
            <View className="items-center">
              <View className="bg-slate-900 dark:bg-emerald-500/15 dark:border dark:border-emerald-500/30 px-7 py-5 rounded-2xl shadow-md">
                <Text className="text-white dark:text-emerald-400 font-extrabold text-3xl text-center">
                  Gestion <Text className="text-emerald-500">Livraison</Text>
                </Text>
              </View>
            </View>

            {/* Greeting */}
            <Text className="text-4xl font-extrabold text-slate-900 dark:text-white mt-10">
              Bonjour 👋
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
              Connecte-toi à ton compte livreur
            </Text>

            {/* Form */}
            <View className="mt-10">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Nom d'utilisateur
              </Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ton.identifiant"
                placeholderTextColor="#94a3b8"
                className="px-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-lg"
              />
            </View>
            <View className="mt-5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Mot de passe
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                className="px-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-lg"
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={onSubmit}
              disabled={mutation.isPending}
              className="mt-8 bg-emerald-500 py-4 rounded-lg items-center active:opacity-80"
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">Se connecter</Text>
              )}
            </Pressable>

            {/* Signup link */}
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Inscription',
                  'Pour créer un compte livreur, contacte ton administrateur ou rends-toi sur le portail web.',
                )
              }
              className="mt-6 items-center"
            >
              <Text className="text-base text-slate-500 dark:text-slate-400">
                Pas encore de compte ?{' '}
                <Text className="font-bold text-emerald-600 dark:text-emerald-400">
                  S'inscrire
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
