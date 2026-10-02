import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { dialog } from '../../../lib/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../components/shared/PageHeader';
import { SelectField } from '../../../components/shared/SelectField';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useFournisseurs } from '../../../features/lookups/hooks';
import { useCommandesARegler } from '../../../features/commandes/hooks';
import { commandeKeys } from '../../../features/commandes/keys';
import {
  useVersementSituation,
  useEnregistrerVersement,
} from '../../../features/versements/hooks';
import { versementKeys } from '../../../features/versements/keys';
import { selectionValide, validerVersement } from '../../../features/versements/regles';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort, formatFCFA } from '../../../lib/format';

// Cible du CTA "Faire un versement" sur l'onglet Cash. Le livreur principal :
//  1. choisit un fournisseur
//  2. coche les commandes livrées qu'il règle (aucune cochée = versement libre,
//     qui réduit seulement la dette et exige un montant > 0)
//  3. consulte la situation (valeur, marge, dette antérieure, total dû) calculée
//     par GET /versement/situation
//  4. saisit le montant versé (quick-fill « Verser tout = totalDu »)
//  5. soumet → POST /versement (CreerVersementRequest)
//
// La logique métier (chaînage de la dette, rattachement des commandes) reste
// 100 % côté back. Seul le livreur principal règle les commandes : un apprenti
// voit un écran d'information.
export default function Versement() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';
  const isRootLivreur = !!user && !user.parentId;

  const { data: fournisseurs = [] } = useFournisseurs();
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const todayIso = new Date().toISOString().slice(0, 10);
  const [dateVersement, setDateVersement] = useState<string | null>(todayIso);

  const commandesQ = useCommandesARegler(isRootLivreur && fournisseurId ? fournisseurId : undefined);
  const commandes = useMemo(() => commandesQ.data ?? [], [commandesQ.data]);

  // Sélection effective : une commande réglée ailleurs disparaît de la liste et
  // ne doit plus être comptée ni envoyée (dérivée, sans effet).
  const selectionEffective = useMemo(() => selectionValide(selection, commandes), [selection, commandes]);
  const idsSelectionnes = useMemo(() => [...selectionEffective], [selectionEffective]);

  const sit = useVersementSituation({
    livreurId: isRootLivreur ? livreurId : '',
    fournisseurId: fournisseurId ?? '',
    commandeIds: idsSelectionnes,
  });

  const m = useEnregistrerVersement();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh : fournisseurs (lookup), commandes à régler et situation.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lookups', 'fournisseurs'] }),
        qc.invalidateQueries({ queryKey: commandeKeys.all }),
        qc.invalidateQueries({ queryKey: versementKeys.all }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const fournisseursOptions = useMemo(
    () =>
      [...fournisseurs]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map((f) => ({ id: f.id, label: f.libelle })),
    [fournisseurs],
  );

  if (!user) return null;

  if (!isRootLivreur) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Faire un versement" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal règle les commandes auprès des fournisseurs."
        />
      </View>
    );
  }

  const changerFournisseur = (id: string | null) => {
    setFournisseurId(id);
    setSelection(new Set());
  };

  const basculer = (id: string) => {
    const suivante = new Set(selectionEffective);
    if (suivante.has(id)) suivante.delete(id);
    else suivante.add(id);
    setSelection(suivante);
  };

  const toutesCochees = commandes.length > 0 && commandes.every((c) => selectionEffective.has(c.id));

  const onSubmit = () => {
    const erreur = validerVersement({
      fournisseurId: fournisseurId ?? '',
      montant,
      nbCommandes: selectionEffective.size,
    });
    if (erreur || !fournisseurId) {
      dialog.warning('Versement incomplet', erreur ?? 'Choisis un fournisseur.');
      return;
    }

    m.mutate(
      {
        livreurId,
        fournisseurId,
        commandeIds: idsSelectionnes.length > 0 ? idsSelectionnes : undefined,
        dateVersement: dateVersement ?? undefined,
        montantVerse: Number(montant),
        commentaire: commentaire.trim() || undefined,
      },
      {
        onSuccess: () => {
          setFournisseurId(null);
          setSelection(new Set());
          setMontant('');
          setCommentaire('');
          setDateVersement(todayIso);
          router.back();
          dialog.success('Versement enregistré');
        },
        onError: (err: unknown) => {
          dialog.error('Erreur', extractApiErrorMessage(err, 'Échec de l’enregistrement'));
        },
      },
    );
  };

  const totalDu = sit.data?.totalDu ?? 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Faire un versement" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
      >
        <View className="px-4">
          <SelectField
            label="Fournisseur *"
            placeholder="Choisir un fournisseur"
            value={fournisseurId}
            onChange={changerFournisseur}
            options={fournisseursOptions}
            isLoading={fournisseurs.length === 0}
            emptyMessage="Aucun fournisseur disponible"
          />

          {/* Commandes à régler */}
          {fournisseurId ? (
            <>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
                Commandes à régler (aucune cochée = versement libre)
              </Text>
              {commandesQ.isLoading ? (
                <Text className="text-slate-400 text-sm">Chargement…</Text>
              ) : commandes.length === 0 ? (
                <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                  Aucune commande livrée à régler chez ce fournisseur. Tu peux quand même enregistrer
                  un versement libre pour réduire la dette.
                </Text>
              ) : (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <Pressable
                    onPress={() =>
                      setSelection(toutesCochees ? new Set() : new Set(commandes.map((c) => c.id)))
                    }
                    className="px-4 py-3 flex-row items-center justify-between active:opacity-70"
                  >
                    <Text className="font-bold text-slate-700 dark:text-slate-300 text-[13px]">
                      {toutesCochees ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectionEffective.size} / {commandes.length}
                    </Text>
                  </Pressable>
                  {commandes.map((c) => {
                    const cochee = selectionEffective.has(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => basculer(c.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: cochee }}
                        accessibilityLabel={`Sélectionner ${c.reference}`}
                        className="px-4 py-3 flex-row items-center gap-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
                      >
                        <View
                          className={`w-5 h-5 rounded border items-center justify-center ${
                            cochee
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {cochee ? <Check color="#fff" size={14} /> : null}
                        </View>
                        <View className="flex-1">
                          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                            {c.reference}
                          </Text>
                          <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                            {c.dateLivraison ? `Livrée le ${formatDateShort(c.dateLivraison)}` : ''}
                          </Text>
                        </View>
                        <Text className="font-bold text-slate-700 dark:text-slate-300 text-[12px]">
                          {formatFCFA(c.montantLivre)} F
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          {/* Situation */}
          {fournisseurId ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 mt-5">
              {sit.isError ? (
                <Text className="text-red-600 dark:text-red-400 text-sm">
                  {extractApiErrorMessage(sit.error, 'Calcul de la situation impossible')}
                </Text>
              ) : sit.isLoading ? (
                <Text className="text-slate-400 text-sm">Calcul en cours…</Text>
              ) : sit.data ? (
                <>
                  <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                    Situation — {sit.data.nbCommandes} commande{sit.data.nbCommandes > 1 ? 's' : ''}
                  </Text>
                  <View className="mt-2 gap-1">
                    <RowKV label="Valeur des commandes" value={formatFCFA(sit.data.valeurAchat)} />
                    <RowKV label="Marge cumulée" value={formatFCFA(sit.data.margeCumulee)} />
                    <RowKV label="Dette avant" value={formatFCFA(sit.data.detteAvant)} />
                  </View>
                  <View className="border-t border-slate-100 dark:border-slate-800 mt-3 pt-3 flex-row justify-between">
                    <Text className="text-slate-700 dark:text-slate-300 font-bold">Total dû</Text>
                    <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                      {formatFCFA(sit.data.totalDu)} FCFA
                    </Text>
                  </View>
                </>
              ) : (
                <Text className="text-amber-600 text-sm">Pas de situation calculable</Text>
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
              !isOnline ? 'bg-slate-200 dark:bg-slate-800' : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${!isOnline ? 'text-slate-400' : 'text-white'}`}>
                {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Enregistrer'}
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
      <Text className="text-[12px] text-slate-500 dark:text-slate-400">{label}</Text>
      <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{value} FCFA</Text>
    </View>
  );
}
