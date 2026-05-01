import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Save, Camera, Trash2 } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { authApi } from '../../../features/auth/api';
import { updateProfileSchema } from '../../../features/auth/schemas';
import {
  useUploadMaPhoto,
  useSupprimerMaPhoto,
} from '../../../features/photos/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { pickImage } from '../../../lib/image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Modification des infos perso du livreur connecté.
 * Endpoint : PUT /auth/me — same as web SettingsPage.
 *
 * Sur succès on met à jour le store Zustand + AsyncStorage pour que les
 * changements soient visibles immédiatement (header de la page Profil,
 * fiche client / fab, etc.) et persistés au prochain démarrage.
 */
export default function ModifierInfos() {
  const user = useAuthStore((s) => s.user);

  const [prenom, setPrenom] = useState(user?.prenom ?? '');
  const [nom, setNom] = useState(user?.nom ?? '');
  const [contact, setContact] = useState(user?.contact ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const m = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: async (updated) => {
      // Patch le store sans toucher au token : on construit un nouvel objet
      // user en fusionnant la réponse back avec ce qu'on avait déjà (notamment
      // `parentId`, `actif`, `statut` que le back peut ou non renvoyer).
      const merged = { ...(user ?? {}), ...updated };
      useAuthStore.setState({ user: merged });
      await AsyncStorage.setItem('user', JSON.stringify(merged));

      Alert.alert('Succès', 'Tes informations ont été mises à jour.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      Alert.alert('Erreur', e.response?.data?.message ?? 'Mise à jour impossible');
    },
  });

  // Photo : upload + delete via les hooks dédiés. On ne touche PAS au form
  // info — l'upload met à jour user.photoUrl à la volée et persiste dans
  // AsyncStorage (cf. useUploadMaPhoto.onSuccess).
  const uploadPhoto = useUploadMaPhoto();
  const deletePhoto = useSupprimerMaPhoto();

  const onPickPhoto = async () => {
    const picked = await pickImage({ aspect: [1, 1] });
    if (!picked) return;
    uploadPhoto.mutate(
      { uri: picked.uri, name: picked.name },
      {
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert('Erreur', e.response?.data?.message ?? 'Upload échoué');
        },
      },
    );
  };

  const onDeletePhoto = () => {
    Alert.alert('Supprimer la photo ?', 'Tu retomberas sur tes initiales.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => deletePhoto.mutate(),
      },
    ]);
  };

  if (!user) return null;

  const initials = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase();
  const hasPhoto = !!user.photoUrl;

  const onSubmit = () => {
    const parsed = updateProfileSchema.safeParse({ prenom, nom, contact, email });
    if (!parsed.success) {
      Alert.alert('Erreur', parsed.error.issues[0]?.message ?? 'Champs invalides');
      return;
    }
    m.mutate(parsed.data);
  };

  // Détecte si quelque chose a changé pour activer/désactiver le bouton
  const dirty =
    prenom.trim() !== (user.prenom ?? '') ||
    nom.trim() !== (user.nom ?? '') ||
    contact.trim() !== (user.contact ?? '') ||
    email.trim() !== (user.email ?? '');

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Modifier mes infos" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3 pt-3">
          {/* Photo de profil */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 items-center">
            <Pressable
              onPress={onPickPhoto}
              disabled={uploadPhoto.isPending}
              className="active:opacity-70"
            >
              <View
                className="w-24 h-24 rounded-full overflow-hidden items-center justify-center"
                style={{ backgroundColor: hasPhoto ? '#f1f5f9' : '#d1fae5' }}
              >
                {hasPhoto ? (
                  <Image
                    source={{ uri: user.photoUrl ?? undefined }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-emerald-700 text-3xl font-extrabold">
                    {initials || '?'}
                  </Text>
                )}
                {uploadPhoto.isPending ? (
                  <View className="absolute inset-0 bg-black/50 items-center justify-center">
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </View>
              <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-500 items-center justify-center border-2 border-white dark:border-slate-900">
                <Camera color="#fff" size={14} />
              </View>
            </Pressable>

            <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-3 text-center">
              {hasPhoto
                ? 'Tape la photo pour la remplacer'
                : 'Tape pour ajouter une photo'}
            </Text>

            {hasPhoto ? (
              <Pressable
                onPress={onDeletePhoto}
                disabled={deletePhoto.isPending}
                className="flex-row items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md bg-red-50 dark:bg-red-500/10 active:opacity-70"
              >
                {deletePhoto.isPending ? (
                  <ActivityIndicator color="#dc2626" size="small" />
                ) : (
                  <Trash2 color="#dc2626" size={12} />
                )}
                <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  Supprimer la photo
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Field
            label="Prénom *"
            value={prenom}
            onChange={setPrenom}
            placeholder="Marc"
          />
          <Field
            label="Nom *"
            value={nom}
            onChange={setNom}
            placeholder="Konan"
          />
          <Field
            label="Téléphone *"
            value={contact}
            onChange={setContact}
            placeholder="0712345678"
            keyboardType="phone-pad"
            hint="10 chiffres, sans espaces"
          />
          <Field
            label="Email (optionnel)"
            value={email}
            onChange={setEmail}
            placeholder="marc@exemple.com"
            keyboardType="email-address"
          />

          {/* Identifiants en lecture seule */}
          <View className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-2">
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Nom d'utilisateur
            </Text>
            <Text className="font-mono text-slate-700 dark:text-slate-300">
              {user.username}
            </Text>
            <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Le nom d'utilisateur ne peut pas être modifié.
            </Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !dirty}
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${
              !dirty
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color={dirty ? '#ffffff' : '#94a3b8'} size={16} />
                <Text
                  className={`font-bold text-base ${
                    dirty ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {dirty ? 'Enregistrer' : 'Aucune modification'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
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
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
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
