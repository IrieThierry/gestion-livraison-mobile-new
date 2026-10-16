import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, FileText, X } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SelecteurMois } from '../../../components/fournisseur/SelecteurMois';
import {
  useEnregistrerReversementFournisseur,
  useLivreursPartenaires,
  useReversementsFournisseur,
  useReversementsSyntheseFournisseur,
} from '../../../features/fournisseur/hooks';
import { moisDe } from '../../../features/fournisseur/regles';
import {
  construireReversement,
  depasseNet,
  nomPartenaire,
  periodeReversement,
  totalReverse,
  trierReversements,
} from '../../../features/fournisseur/argent';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { dialog } from '../../../lib/dialog';
import { formatDateLong, formatFCFA } from '../../../lib/format';
import { useAnnuaireRecuFournisseur, usePartagerRecuFournisseur } from '../../../features/reversements/useRecuFournisseur';
import { partiesReversement } from '../../../features/reversements/recu';
import { useRecuStore } from '../../../stores/recuStore';
import type { LigneLivreurDuResponse, ReversementRecord } from '../../../types/api';

const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';
const CHAMP =
  'px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white';

/**
 * F2 : reversements de la remise livreur, comme la page web : « À reverser
 * aux livreurs » du mois choisi (remise du mois, dette courante, net) avec
 * « Reverser » (montant proposé = net ; le dépasser n'est qu'un avertissement),
 * puis le total reversé et l'historique. Une ligne « Information (saisi par le
 * livreur) » n'est comptée dans aucun total. Reçu (PDF partagé) : proposé juste
 * après l'enregistrement, et sur chaque ligne de l'historique, comme le web.
 */
export default function ReversementsFournisseur() {
  const [mois, setMois] = useState(() => moisDe());
  const isOnline = useNetworkStore((s) => s.isOnline);
  const syntheseQ = useReversementsSyntheseFournisseur(mois);
  const historiqueQ = useReversementsFournisseur();
  const partenairesQ = useLivreursPartenaires();
  const m = useEnregistrerReversementFournisseur();
  const verrou = useRef(creerVerrou()).current;

  const [enCours, setEnCours] = useState<LigneLivreurDuResponse | null>(null);
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  /** Dernier reversement enregistré : son reçu est proposé (sans bloquer). */
  const [dernier, setDernier] = useState<ReversementRecord | null>(null);

  const lignes = syntheseQ.data?.aReverserAuxLivreurs ?? [];
  const totalAReverser = lignes.reduce((s, l) => s + (l.montantNetAReverser ?? 0), 0);
  const historique = useMemo(() => trierReversements(historiqueQ.data), [historiqueQ.data]);
  const total = totalReverse(historiqueQ.data);
  const annuaire = useAnnuaireRecuFournisseur(lignes);
  const partagerRecu = usePartagerRecuFournisseur(annuaire);
  const preparation = useRecuStore((s) => s.preparation);

  const ouvrir = (l: LigneLivreurDuResponse) => {
    setEnCours(l);
    setMontant(String(l.montantNetAReverser));
    setCommentaire('');
  };

  const confirmer = () => {
    if (!enCours) return;
    const r = construireReversement({ livreurId: enCours.livreurId, mois, montant, commentaire });
    if (!r.ok) {
      dialog.warning('Montant invalide', r.erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      m.mutate(r.valeur, {
        onSuccess: (enregistre?: ReversementRecord) => {
          setEnCours(null);
          setDernier(enregistre ?? null);
          dialog.success('Reversement enregistré');
        },
        onError: (e: unknown) => dialog.error('Erreur', extractApiErrorMessage(e, 'Création impossible')),
        onSettled: fin,
      }),
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Reversements" subtitle="La remise livreur à reverser à tes livreurs" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={!!syntheseQ.isFetching && !syntheseQ.isLoading}
            onRefresh={() => {
              syntheseQ.refetch();
              historiqueQ.refetch();
              partenairesQ.refetch();
            }}
            tintColor="#047857"
          />
        }
      >
        <SelecteurMois
          mois={mois}
          onChange={(m2) => {
            // Le montant proposé est le net du mois affiché : changer de mois ferme le panneau.
            setEnCours(null);
            setMois(m2);
          }}
        />

        {dernier ? (
          <View
            accessibilityLabel="Reçu du reversement enregistré"
            className="mt-4 p-3 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 gap-2"
          >
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 text-[12px] text-slate-800 dark:text-slate-200">
                {`Reversement de ${formatFCFA(Number(dernier.montant))} F à ${partiesReversement(dernier, annuaire).beneficiaire.nom} enregistré.`}
              </Text>
              <Pressable onPress={() => setDernier(null)} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={8}>
                <X color="#64748b" size={16} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => partagerRecu(dernier)}
              disabled={preparation === dernier.id}
              accessibilityRole="button"
              accessibilityLabel="Partager le reçu"
              className="self-start flex-row items-center gap-1 bg-emerald-700 rounded-md px-3 py-1.5 active:opacity-80"
            >
              {preparation === dernier.id ? <ActivityIndicator color="#fff" size="small" /> : <FileText color="#fff" size={13} />}
              <Text className="text-white text-[12px] font-bold">Partager le reçu</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between mt-5 mb-2">
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
            À reverser aux livreurs
          </Text>
          <Text className="text-[12px] font-extrabold text-emerald-700 dark:text-emerald-400">
            {formatFCFA(totalAReverser)} F
          </Text>
        </View>
        {syntheseQ.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : syntheseQ.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(syntheseQ.error, 'Impossible de charger la synthèse.')}
          />
        ) : lignes.length === 0 ? (
          <EmptyState
            title="Rien à reverser"
            message="Aucune remise livreur accumulée pour tes livreurs sur cette période."
          />
        ) : (
          lignes.map((l) => {
            const ouvert = enCours?.livreurId === l.livreurId;
            return (
              <View key={l.livreurId} className={`${CARTE} p-3 mb-2`}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      {[l.prenom, l.nom].filter(Boolean).join(' ')}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {`Remise du mois ${formatFCFA(l.remiseLivreurCumuleeMois)} F · dette ${formatFCFA(l.detteCourante)} F`}
                    </Text>
                  </View>
                  <Text className="font-extrabold text-emerald-800 dark:text-emerald-400">
                    {formatFCFA(l.montantNetAReverser)} F
                  </Text>
                </View>
                {ouvert ? (
                  <View className="mt-3 gap-2">
                    <Text className="text-[12px] text-slate-600 dark:text-slate-300">
                      Confirme le montant à verser à {[l.prenom, l.nom].filter(Boolean).join(' ')}.
                    </Text>
                    <TextInput
                      value={montant}
                      onChangeText={setMontant}
                      keyboardType="decimal-pad"
                      accessibilityLabel="Montant du reversement"
                      placeholderTextColor="#94a3b8"
                      className={CHAMP}
                    />
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Net à reverser : {formatFCFA(l.montantNetAReverser)} F
                    </Text>
                    {depasseNet(montant, l.montantNetAReverser) ? (
                      <Text className="text-[11px] text-amber-700 dark:text-amber-400">
                        Montant supérieur au net à reverser
                      </Text>
                    ) : null}
                    <TextInput
                      value={commentaire}
                      onChangeText={setCommentaire}
                      accessibilityLabel="Commentaire du reversement"
                      placeholder="Commentaire (optionnel)"
                      placeholderTextColor="#94a3b8"
                      className={CHAMP}
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => setEnCours(null)}
                        accessibilityRole="button"
                        className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md py-2 items-center active:opacity-70"
                      >
                        <Text className="font-bold text-slate-700 dark:text-slate-300 text-[13px]">Annuler</Text>
                      </Pressable>
                      <Pressable
                        onPress={confirmer}
                        disabled={m.isPending || !isOnline}
                        accessibilityRole="button"
                        accessibilityLabel="Confirmer le reversement"
                        className={`flex-1 rounded-md py-2 items-center ${
                          isOnline ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      >
                        {m.isPending ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text className={`font-bold text-[13px] ${isOnline ? 'text-white' : 'text-slate-400'}`}>
                            {isOnline ? 'Confirmer' : 'Hors ligne'}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => ouvrir(l)}
                    disabled={l.montantNetAReverser <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Reverser à ${[l.prenom, l.nom].filter(Boolean).join(' ')}`}
                    accessibilityState={{ disabled: l.montantNetAReverser <= 0 }}
                    className={`self-start mt-2 flex-row items-center gap-1 border border-emerald-600 rounded-md px-3 py-1.5 ${
                      l.montantNetAReverser <= 0 ? 'opacity-40' : 'active:opacity-70'
                    }`}
                  >
                    <Check color="#047857" size={13} />
                    <Text className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">Reverser</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        <View className={`${CARTE} p-3 mt-5`}>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">Total cumulé reversé</Text>
            <Text className="font-extrabold text-lg text-slate-900 dark:text-white">{formatFCFA(total)} F</Text>
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Les lignes « Information (saisi par le livreur) » ne sont comptées dans aucun total : seul le reversement
            que tu enregistres compte.
          </Text>
        </View>

        <Text className={SECTION}>Historique</Text>
        {historiqueQ.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : historiqueQ.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(historiqueQ.error, 'Impossible de charger les reversements.')}
          />
        ) : historique.length === 0 ? (
          <EmptyState title="Aucun reversement" message="Pas encore de reversement effectué." />
        ) : (
          historique.map((r) => (
            <View key={r.id} className={`${CARTE} p-3 mb-2 ${r.informatif ? 'opacity-70' : ''}`}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    {nomPartenaire(partenairesQ.data, r.livreurId)}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {[formatDateLong(r.dateReversement), periodeReversement(r)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text className="font-extrabold text-slate-900 dark:text-white">{formatFCFA(Number(r.montant))} F</Text>
              </View>
              {r.informatif ? (
                <Text className="self-start mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Information (saisi par le livreur)
                </Text>
              ) : null}
              {r.commentaire ? (
                <Text className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-1">{r.commentaire}</Text>
              ) : null}
              <Pressable
                onPress={() => partagerRecu(r)}
                disabled={preparation === r.id}
                accessibilityRole="button"
                accessibilityLabel={`Reçu du reversement de ${formatFCFA(Number(r.montant))} F à ${partiesReversement(r, annuaire).beneficiaire.nom}`}
                accessibilityState={{ busy: preparation === r.id }}
                className="self-start mt-2 flex-row items-center gap-1 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 active:opacity-70"
              >
                {preparation === r.id ? <ActivityIndicator color="#047857" size="small" /> : <FileText color="#64748b" size={12} />}
                <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Reçu</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
