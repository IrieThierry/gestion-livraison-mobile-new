import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';

export default function ChangerMotDePasse() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const onSubmit = () => {
    if (!current || !next || !confirm) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Erreur', 'La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    // TODO: wire to backend once POST /auth/change-password is exposed.
    Alert.alert(
      'Bientôt disponible',
      'Le changement de mot de passe depuis le mobile arrive bientôt.\n\nEn attendant, tu peux modifier ton mot de passe depuis le portail web.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Changer le mot de passe" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3">
          <PasswordField label="Mot de passe actuel" value={current} onChange={setCurrent} />
          <PasswordField label="Nouveau mot de passe" value={next} onChange={setNext} />
          <PasswordField
            label="Confirmer le nouveau"
            value={confirm}
            onChange={setConfirm}
          />

          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            8 caractères minimum. Mélange lettres + chiffres recommandé.
          </Text>

          <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mt-2">
            <Text className="text-[11px] text-amber-800 dark:text-amber-300">
              ℹ️ Le changement depuis le mobile arrive bientôt. Pour l'instant, utilise le portail
              web pour mettre à jour ton mot de passe.
            </Text>
          </View>

          <Pressable
            onPress={onSubmit}
            className="bg-emerald-500 rounded-md py-3.5 mt-2 items-center active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Mettre à jour</Text>
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
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        autoCapitalize="none"
        className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
      />
    </View>
  );
}
