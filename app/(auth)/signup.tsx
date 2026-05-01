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
import {
  Truck,
  Building2,
  ArrowLeft,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react-native';
import { authApi } from '../../features/auth/api';
import { signupSchema } from '../../features/auth/schemas';

/**
 * Auto-inscription d'un livreur ou fournisseur. Le back crée le compte avec
 * `statut=EN_ATTENTE_VALIDATION` — l'utilisateur peut se connecter mais
 * tous les écrans métier sont remplacés par la `PendingValidationScreen`
 * tant qu'un admin n'a pas validé.
 *
 * Mirror simplifié de la page web `SignupPage`.
 */
export default function Signup() {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profile, setProfile] = useState<'LIVREUR' | 'FOURNISSEUR'>('LIVREUR');
  const [showPwd, setShowPwd] = useState(false);

  const m = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      Alert.alert(
        'Compte créé',
        'Ton inscription est enregistrée. Un administrateur doit valider ton compte avant que tu puisses utiliser l\'app — connecte-toi pour suivre l\'état.',
        [{ text: 'Se connecter', onPress: () => router.replace('/(auth)/login') }],
      );
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      Alert.alert('Erreur', e.response?.data?.message ?? 'Création impossible');
    },
  });

  const onSubmit = () => {
    const parsed = signupSchema.safeParse({
      prenom,
      nom,
      contact,
      email,
      username,
      password,
      confirmPassword,
      profile,
    });
    if (!parsed.success) {
      Alert.alert('Erreur', parsed.error.issues[0]?.message ?? 'Champs invalides');
      return;
    }
    m.mutate(parsed.data);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
          <View className="px-6 pt-4 pb-8">
            {/* Back button */}
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              className="flex-row items-center gap-1 active:opacity-70 mb-4"
            >
              <ArrowLeft color="#64748b" size={18} />
              <Text className="text-slate-600 dark:text-slate-400 font-bold">
                Connexion
              </Text>
            </Pressable>

            <Text className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Créer un compte
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 mt-2">
              Un administrateur validera ton compte avant la première utilisation.
            </Text>

            {/* Type de compte */}
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-6 mb-2">
              Type de compte
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setProfile('LIVREUR')}
                className={`flex-1 flex-col items-center gap-1 py-3 rounded-lg border-2 ${
                  profile === 'LIVREUR'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <Truck color={profile === 'LIVREUR' ? '#10b981' : '#64748b'} size={20} />
                <Text
                  className={`font-bold text-[13px] ${
                    profile === 'LIVREUR'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Livreur
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setProfile('FOURNISSEUR')}
                className={`flex-1 flex-col items-center gap-1 py-3 rounded-lg border-2 ${
                  profile === 'FOURNISSEUR'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <Building2
                  color={profile === 'FOURNISSEUR' ? '#10b981' : '#64748b'}
                  size={20}
                />
                <Text
                  className={`font-bold text-[13px] ${
                    profile === 'FOURNISSEUR'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Fournisseur
                </Text>
              </Pressable>
            </View>
            {profile === 'FOURNISSEUR' ? (
              <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mt-3">
                <Text className="text-[11px] text-amber-700 dark:text-amber-400">
                  Le compte sera créé mais devra être lié à une entité fournisseur par un administrateur.
                </Text>
              </View>
            ) : null}

            {/* Identité */}
            <View className="flex-row gap-3 mt-4">
              <View className="flex-1">
                <Field label="Prénom *" value={prenom} onChange={setPrenom} placeholder="Marc" />
              </View>
              <View className="flex-1">
                <Field label="Nom *" value={nom} onChange={setNom} placeholder="Konan" />
              </View>
            </View>

            <View className="mt-3">
              <Field
                label="Téléphone *"
                value={contact}
                onChange={setContact}
                placeholder="0712345678"
                keyboardType="phone-pad"
                hint="10 chiffres, sans espaces"
              />
            </View>

            <View className="mt-3">
              <Field
                label="Email (optionnel)"
                value={email}
                onChange={setEmail}
                placeholder="marc@…"
                keyboardType="email-address"
              />
            </View>

            <View className="mt-3">
              <Field
                label="Nom d'utilisateur *"
                value={username}
                onChange={setUsername}
                placeholder="marc"
                autoCapitalize="none"
                hint="Min 3 caractères, sans espaces"
              />
            </View>

            {/* Passwords */}
            <View className="mt-3">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Mot de passe *
              </Text>
              <View className="flex-row items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                  placeholder="Min 6 caractères"
                  placeholderTextColor="#94a3b8"
                  autoCorrect={false}
                  autoCapitalize="none"
                  className="flex-1 px-4 py-3.5 text-slate-900 dark:text-white text-base"
                />
                <Pressable
                  onPress={() => setShowPwd((v) => !v)}
                  hitSlop={10}
                  className="px-3 py-3.5 active:opacity-60"
                >
                  {showPwd ? (
                    <EyeOff color="#64748b" size={18} />
                  ) : (
                    <Eye color="#64748b" size={18} />
                  )}
                </Pressable>
              </View>
            </View>
            <View className="mt-3">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Confirmer le mot de passe *
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPwd}
                placeholder="Re-tape le mot de passe"
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
                autoCapitalize="none"
                className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={onSubmit}
              disabled={m.isPending}
              className="mt-6 bg-emerald-500 py-4 rounded-lg items-center flex-row justify-center gap-2 active:opacity-80"
            >
              {m.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <UserPlus color="#fff" size={18} />
                  <Text className="text-white font-bold text-lg">Créer mon compte</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace('/(auth)/login' as never)}
              className="mt-5 items-center"
            >
              <Text className="text-base text-slate-500 dark:text-slate-400">
                Déjà inscrit ?{' '}
                <Text className="font-bold text-emerald-600 dark:text-emerald-400">
                  Se connecter
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  hint,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  hint?: string;
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={
          autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')
        }
        autoCorrect={false}
        className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
      />
      {hint ? (
        <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
