import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { authApi } from '../../../features/auth/api';
import { changePasswordSchema } from '../../../features/auth/schemas';

/**
 * Change le mot de passe du livreur connecté. Endpoint :
 * `PUT /auth/me/password` avec `{ currentPassword, newPassword }`.
 *
 * Le back vérifie que `currentPassword` correspond au hash en base avant
 * d'appliquer le nouveau. Si ok, le token actuel reste valide (pas besoin
 * de re-login) — c'est ce que fait aussi la web SettingsPage.
 */
export default function ChangerMotDePasse() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const m = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      Alert.alert('Succès', 'Ton mot de passe a été mis à jour.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      Alert.alert(
        'Erreur',
        e.response?.data?.message ?? 'Mise à jour impossible — vérifie ton mot de passe actuel.',
      );
    },
  });

  const onSubmit = () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      Alert.alert('Erreur', parsed.error.issues[0]?.message ?? 'Champs invalides');
      return;
    }
    m.mutate({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Changer le mot de passe" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3 pt-3">
          <PasswordField
            label="Mot de passe actuel *"
            value={currentPassword}
            onChange={setCurrent}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />
          <PasswordField
            label="Nouveau mot de passe *"
            value={newPassword}
            onChange={setNew}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            autoComplete="new-password"
            hint="Min 6 caractères. Mélange lettres + chiffres recommandé."
          />
          <PasswordField
            label="Confirmer le nouveau *"
            value={confirmPassword}
            onChange={setConfirm}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            autoComplete="new-password"
          />

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            className="bg-emerald-500 rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <KeyRound color="#fff" size={16} />
                <Text className="text-white font-bold text-base">
                  Mettre à jour
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: 'current-password' | 'new-password';
  hint?: string;
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>
      <View className="flex-row items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          className="flex-1 px-4 py-3.5 text-slate-900 dark:text-white text-base"
        />
        <Pressable
          onPress={onToggleShow}
          hitSlop={10}
          className="px-3 py-3.5 active:opacity-60"
        >
          {show ? (
            <EyeOff color="#64748b" size={18} />
          ) : (
            <Eye color="#64748b" size={18} />
          )}
        </Pressable>
      </View>
      {hint ? (
        <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
