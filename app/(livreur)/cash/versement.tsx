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
import { PageHeader } from '../../../components/shared/PageHeader';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { useFournisseurs } from '../../../features/lookups/hooks';
import {
  useVersementSituation,
  useEnregistrerVersement,
} from '../../../features/versements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { formatFCFA } from '../../../lib/format';

// Cible du CTA "Faire un versement" sur l'onglet Cash. Le livreur :
//  1. choisit un fournisseur (chip row)
//  2. consulte la situation 7 derniers jours (valeurAchat / margeCumulee /
//     detteAvant / totalDu) — calculée par GET /versement/situation
//  3. saisit le montantVerse (avec quick-fill "Verser tout = totalDu")
//  4. ajoute un commentaire optionnel
//  5. soumet → POST /versement (CreerVersementRequest)
//
// La plage est figée à `[today−7j, today]` pour le MVP — un futur task
// pourra ajouter un picker de période. La logique métier (chaînage de
// la dette via detteAvant/detteApres) reste 100 % côté back, le mobile
// se contente d'afficher la situation et de poster le montant.
export default function Versement() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';

  const { data: fournisseurs = [] } = useFournisseurs();
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [libre, setLibre] = useState(true);
  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenAgoIso = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [dateDebut, setDateDebut] = useState<string | null>(sevenAgoIso);
  const [dateFin, setDateFin] = useState<string | null>(todayIso);
  const [dateVersement, setDateVersement] = useState<string | null>(todayIso);

  const sit = useVersementSituation({
    livreurId,
    fournisseurId: fournisseurId ?? '',
    dateDebut: dateDebut ?? sevenAgoIso,
    dateFin: dateFin ?? todayIso,
  });

  const m = useEnregistrerVersement();

  if (!user) return null;

  const onSubmit = () => {
    if (!fournisseurId) {
      Alert.alert('Erreur', 'Choisis un fournisseur');
      return;
    }
    const n = parseInt(montant, 10);
    if (!n || n <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (!libre && (!dateDebut || !dateFin)) {
      Alert.alert('Erreur', 'Date début et date fin requises en mode période');
      return;
    }
    if (!libre && dateDebut && dateFin && dateDebut > dateFin) {
      Alert.alert('Erreur', 'La date de début doit être avant la date de fin');
      return;
    }

    m.mutate(
      {
        livreurId,
        fournisseurId,
        montantVerse: n,
        commentaire: commentaire.trim() || undefined,
        dateDebut: libre ? undefined : (dateDebut ?? undefined),
        dateFin: libre ? undefined : (dateFin ?? undefined),
        dateVersement: dateVersement ?? undefined,
        libre: libre || undefined,
      },
      {
        onSuccess: () => {
          // Reset form before navigating
          setFournisseurId(null);
          setMontant('');
          setCommentaire('');
          setLibre(true);
          setDateDebut(sevenAgoIso);
          setDateFin(todayIso);
          setDateVersement(todayIso);
          router.back();
          Alert.alert('Succès', 'Versement enregistré');
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert(
            'Erreur',
            e.response?.data?.message ?? 'Échec de l’enregistrement',
          );
        },
      },
    );
  };

  const totalDu = sit.data?.totalDu ?? 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Faire un versement" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          {/* Fournisseur chip row */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Fournisseur
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {fournisseurs.length === 0 ? (
              <Text className="text-slate-400 text-sm">Chargement…</Text>
            ) : (
              fournisseurs.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setFournisseurId(f.id)}
                  className={`px-3 py-2 rounded-md ${
                    fournisseurId === f.id
                      ? 'bg-emerald-500'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      fournisseurId === f.id
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {f.libelle}
                  </Text>
                </Pressable>
              ))
            )}
          </View>

          {/* Situation card */}
          {fournisseurId ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 mt-5">
              {sit.isLoading ? (
                <Text className="text-slate-400 text-sm">Calcul en cours…</Text>
              ) : sit.data ? (
                <>
                  <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                    Situation 7 derniers jours
                  </Text>
                  <View className="mt-2 gap-1">
                    <RowKV
                      label="Achat (cumul)"
                      value={formatFCFA(sit.data.valeurAchat)}
                    />
                    <RowKV
                      label="Marge cumulée"
                      value={formatFCFA(sit.data.margeCumulee)}
                    />
                    <RowKV
                      label="Dette avant"
                      value={formatFCFA(sit.data.detteAvant)}
                    />
                  </View>
                  <View className="border-t border-slate-100 dark:border-slate-800 mt-3 pt-3 flex-row justify-between">
                    <Text className="text-slate-700 dark:text-slate-300 font-bold">
                      Total dû
                    </Text>
                    <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                      {formatFCFA(sit.data.totalDu)} FCFA
                    </Text>
                  </View>
                </>
              ) : (
                <Text className="text-amber-600 text-sm">
                  Pas de situation calculable
                </Text>
              )}
            </View>
          ) : null}

          {/* Montant */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Montant versé
          </Text>
          <TextInput
            value={montant}
            onChangeText={setMontant}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
          />

          {/* Quick fill */}
          {sit.data && totalDu > 0 ? (
            <Pressable
              onPress={() => setMontant(String(totalDu))}
              className="self-start bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md mt-2 active:opacity-70"
            >
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                Verser tout ({formatFCFA(totalDu)})
              </Text>
            </Pressable>
          ) : null}

          {/* Mode toggle */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Mode du versement
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setLibre(true)}
              className={`flex-1 py-2.5 rounded-md items-center ${
                libre
                  ? 'bg-emerald-500'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Text
                className={`font-bold text-[13px] ${
                  libre ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                Solde libre
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLibre(false)}
              className={`flex-1 py-2.5 rounded-md items-center ${
                !libre
                  ? 'bg-emerald-500'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Text
                className={`font-bold text-[13px] ${
                  !libre ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                Sur une période
              </Text>
            </Pressable>
          </View>

          {!libre ? (
            <View className="mt-3 gap-3">
              <DatePickerField
                label="Date début"
                value={dateDebut}
                onChange={setDateDebut}
              />
              <DatePickerField
                label="Date fin"
                value={dateFin}
                onChange={setDateFin}
              />
            </View>
          ) : null}

          <View className="mt-4">
            <DatePickerField
              label="Date du versement"
              value={dateVersement}
              onChange={setDateVersement}
              optional
            />
          </View>

          {/* Commentaire */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
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

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline}
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : 'Enregistrer'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function RowKV({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-[12px] text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
        {value} FCFA
      </Text>
    </View>
  );
}
