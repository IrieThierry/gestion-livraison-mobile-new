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

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const setSession = useAuthStore((s) => s.setSession);

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      const { token, ...user } = data;
      await setSession(token, user);
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
          className="flex-1 px-6"
        >
          <View className="items-start">
            <View className="bg-slate-900 dark:bg-emerald-500/15 px-3 py-2 rounded-md">
              <Text className="text-white dark:text-emerald-400 font-extrabold text-lg">
                Gestion<Text className="text-emerald-500">.</Text>
              </Text>
            </View>
          </View>

          <Text className="text-3xl font-extrabold text-slate-900 dark:text-white mt-8">
            Bonjour 👋
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 mt-1">
            Connecte-toi à ton compte livreur
          </Text>

          <View className="mt-8 gap-3">
            <View>
              <Text className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                Nom d'utilisateur
              </Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ton.identifiant"
                placeholderTextColor="#94a3b8"
                className="mt-1 px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white"
              />
            </View>
            <View>
              <Text className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                Mot de passe
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                className="mt-1 px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white"
              />
            </View>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={mutation.isPending}
            className="mt-6 bg-emerald-500 py-3 rounded-md items-center"
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">Se connecter</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
