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
import { useAuthStore } from '../../../stores/authStore';

export default function ModifierInfos() {
  const user = useAuthStore((s) => s.user);

  const [prenom, setPrenom] = useState(user?.prenom ?? '');
  const [nom, setNom] = useState(user?.nom ?? '');
  const [contact, setContact] = useState(user?.contact ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  if (!user) return null;

  const onSubmit = () => {
    // TODO: wire to backend once PUT /utilisateur/me is exposed.
    Alert.alert(
      'Bientôt disponible',
      'La modification des infos personnelles depuis le mobile arrive bientôt.\n\nEn attendant, tu peux modifier ton compte depuis le portail web.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Modifier mes infos" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3">
          <Field label="Prénom" value={prenom} onChange={setPrenom} placeholder="Marc" />
          <Field label="Nom" value={nom} onChange={setNom} placeholder="Konan" />
          <Field
            label="Téléphone"
            value={contact}
            onChange={setContact}
            placeholder="07 12 34 56 78"
            keyboardType="phone-pad"
          />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="marc@exemple.com"
            keyboardType="email-address"
          />

          <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mt-2">
            <Text className="text-[11px] text-amber-800 dark:text-amber-300">
              ℹ️ La modification depuis le mobile arrive bientôt. Pour l'instant, utilise le portail
              web pour mettre à jour tes infos.
            </Text>
          </View>

          <Pressable
            onPress={onSubmit}
            className="bg-emerald-500 rounded-md py-3.5 mt-2 items-center active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Enregistrer</Text>
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
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
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
    </View>
  );
}
