import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Fuel, Wrench, FileText, MoreHorizontal } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { DatePickerField } from '../../../../components/shared/DatePickerField';
import { useCreateDepense } from '../../../../features/depenses/hooks';
import type { DepenseCategorie } from '../../../../types/api';

const CATEGORIES: Array<{
  key: DepenseCategorie;
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
}> = [
  { key: 'CARBURANT', label: 'Carburant', icon: Fuel, color: '#dc2626' },
  { key: 'ENTRETIEN', label: 'Entretien', icon: Wrench, color: '#3b82f6' },
  { key: 'ADMINISTRATIF', label: 'Administratif', icon: FileText, color: '#8b5cf6' },
  { key: 'AUTRE', label: 'Autre', icon: MoreHorizontal, color: '#64748b' },
];

export default function NouvelleDepense() {
  const m = useCreateDepense();
  const today = new Date().toISOString().slice(0, 10);

  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState<DepenseCategorie>('CARBURANT');
  const [montant, setMontant] = useState('');
  const [dateDepense, setDateDepense] = useState<string | null>(today);
  const [commentaire, setCommentaire] = useState('');

  const onSubmit = () => {
    if (!libelle.trim()) {
      Alert.alert('Erreur', 'Saisis un libellé');
      return;
    }
    const n = parseInt(montant, 10);
    if (!n || n <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (!dateDepense) {
      Alert.alert('Erreur', 'Date requise');
      return;
    }
    m.mutate(
      {
        libelle: libelle.trim(),
        categorie,
        montant: n,
        dateDepense,
        commentaire: commentaire.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.back();
          Alert.alert('Succès', 'Dépense enregistrée');
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert('Erreur', e.response?.data?.message ?? 'Échec');
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle dépense" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3 pt-3">
          {/* Libellé */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Libellé *
            </Text>
            <TextInput
              value={libelle}
              onChangeText={setLibelle}
              placeholder="Ex : Plein gasoil"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
            />
          </View>

          {/* Catégorie */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Catégorie *
            </Text>
            <View className="flex-row gap-2 flex-wrap">
              {CATEGORIES.map((c) => {
                const active = categorie === c.key;
                const Icon = c.icon;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategorie(c.key)}
                    className={`flex-row items-center gap-1.5 px-3 py-2 rounded-md border ${
                      active
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Icon color={active ? '#fff' : c.color} size={14} />
                    <Text
                      className={`text-[12px] font-bold ${
                        active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Montant */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Montant (FCFA) *
            </Text>
            <TextInput
              value={montant}
              onChangeText={setMontant}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
            />
          </View>

          {/* Date */}
          <DatePickerField
            label="Date *"
            value={dateDepense}
            onChange={setDateDepense}
          />

          {/* Commentaire */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Commentaire (optionnel)
            </Text>
            <TextInput
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              placeholder="…"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            className="bg-emerald-500 rounded-md py-3.5 mt-3 items-center active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Enregistrer</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
