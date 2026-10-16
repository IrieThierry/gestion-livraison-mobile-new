import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Check } from 'lucide-react-native';
import { PageHeader } from '../shared/PageHeader';
import { FormScreen } from '../shared/FormScreen';
import { SelectField } from '../shared/SelectField';
import { DatePickerField } from '../shared/DatePickerField';
import {
  useCommandesLivreurFournisseur,
  useEnregistrerVersementFournisseur,
  useLivreursPartenaires,
  useSituationVersementFournisseur,
} from '../../features/fournisseur/hooks';
import { commandesAReglerDe, nomLivreur, validerVersementRecu } from '../../features/fournisseur/gestion';
import { selectionValide, valeurCommande } from '../../features/versements/regles';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { jourIso } from '../../lib/periode';
import { useNetworkStore } from '../../stores/networkStore';
import { dialog } from '../../lib/dialog';
import { extractApiErrorMessage } from '../../lib/api-error';
import { formatDateShort, formatFCFA } from '../../lib/format';
import { retourParent } from '../../lib/navigation-app';
import type { UUID } from '../../types/api';

const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';

/**
 * F2, FM3 : enregistrer un versement reçu d'un livreur (même règle que le web) :
 * depuis sa fiche (livreur fixé), ou depuis Argent (choix du livreur partenaire,
 * comme le dialogue « Enregistrer un versement » du portail) ;
 * cocher les commandes livrées qu'il règle ; sans commande cochée, le
 * versement est libre et réduit seulement la dette (montant > 0). La
 * situation (valeur, remise, dette, total dû) est calculée par le back.
 */
export function FormulaireVersementRecu({ livreurIdFixe }: { livreurIdFixe?: UUID }) {
  const pathname = usePathname();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const partenairesQ = useLivreursPartenaires();
  const [livreurChoisi, setLivreurChoisi] = useState<UUID | null>(null);
  const id = livreurIdFixe ?? livreurChoisi ?? undefined;
  const partenaire = partenairesQ.data?.find((p) => p.livreur.id === id);
  const options = useMemo(
    () =>
      [...(partenairesQ.data ?? [])]
        .map((p) => ({ id: p.livreur.id, label: nomLivreur(p.livreur) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [partenairesQ.data],
  );
  const commandesQ = useCommandesLivreurFournisseur(id);
  const m = useEnregistrerVersementFournisseur();
  const verrou = useRef(creerVerrou()).current;

  const [selection, setSelection] = useState<Set<UUID>>(new Set());
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [dateVersement, setDateVersement] = useState<string | null>(jourIso(new Date()));

  const aRegler = useMemo(() => commandesAReglerDe(commandesQ.data, id ?? ''), [commandesQ.data, id]);
  const selectionEffective = useMemo(() => selectionValide(selection, aRegler), [selection, aRegler]);
  const ids = useMemo(() => [...selectionEffective], [selectionEffective]);
  const sit = useSituationVersementFournisseur(id, ids);

  const nom = partenaire ? nomLivreur(partenaire.livreur) : undefined;
  const toutesCochees = aRegler.length > 0 && aRegler.every((c) => selectionEffective.has(c.id));
  const totalDu = sit.data?.totalDu ?? 0;

  const basculer = (cid: UUID) => {
    const suivante = new Set(selectionEffective);
    if (suivante.has(cid)) suivante.delete(cid);
    else suivante.add(cid);
    setSelection(suivante);
  };

  const onSubmit = () => {
    const erreur = validerVersementRecu({ montant, nbCommandes: selectionEffective.size });
    if (!id) {
      dialog.warning('Versement incomplet', 'Choisis le livreur qui a versé.');
      return;
    }
    if (erreur) {
      dialog.warning('Versement incomplet', erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      m.mutate(
        {
          livreurId: id,
          commandeIds: ids.length > 0 ? ids : undefined,
          dateVersement: dateVersement ?? undefined,
          montantVerse: Number(montant),
          commentaire: commentaire.trim() || undefined,
        },
        {
          onSuccess: () => {
            dialog.success('Versement enregistré');
            retourParent(pathname);
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, "Impossible d'enregistrer ce versement")),
          onSettled: fin,
        },
      ),
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Versement reçu" subtitle={nom} />
      <FormScreen>
        <View className="px-4">
          {livreurIdFixe ? null : (
            <View className="mb-3">
              <SelectField
                label="Livreur"
                placeholder="Choisir un livreur partenaire"
                value={livreurChoisi}
                options={options}
                onChange={(v) => {
                  setLivreurChoisi(v);
                  // Commandes et montant (« Tout le dû ») propres au livreur précédent : remis à zéro.
                  setSelection(new Set());
                  setMontant('');
                }}
                isLoading={partenairesQ.isLoading}
                emptyMessage="Aucun livreur partenaire pour l’instant"
              />
              {partenairesQ.isError ? (
                <Text className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {extractApiErrorMessage(partenairesQ.error, 'Chargement des livreurs impossible')}
                </Text>
              ) : null}
            </View>
          )}
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            Coche les commandes livrées que ce versement règle. Sans commande cochée, le versement est libre : il réduit
            seulement la dette.
          </Text>

          <Text className={SECTION}>Commandes à régler (aucune cochée = versement libre)</Text>
          {!id ? (
            <Text className="text-slate-500 dark:text-slate-400 text-[12px]">Choisis d’abord le livreur.</Text>
          ) : commandesQ.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : commandesQ.isError ? (
            <Text className="text-red-600 dark:text-red-400 text-sm">
              {extractApiErrorMessage(commandesQ.error, 'Chargement des commandes impossible')}
            </Text>
          ) : aRegler.length === 0 ? (
            <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
              Aucune commande livrée à régler pour ce livreur. Tu peux quand même enregistrer un versement libre pour
              réduire sa dette.
            </Text>
          ) : (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <Pressable
                onPress={() => setSelection(toutesCochees ? new Set() : new Set(aRegler.map((c) => c.id)))}
                className="px-4 py-3 flex-row items-center justify-between active:opacity-70"
              >
                <Text className="font-bold text-slate-700 dark:text-slate-300 text-[13px]">
                  {toutesCochees ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectionEffective.size} / {aRegler.length}
                </Text>
              </Pressable>
              {aRegler.map((c) => {
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
                        cochee ? 'bg-emerald-700 border-emerald-700' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {cochee ? <Check color="#fff" size={14} /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{c.reference}</Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                        {c.dateLivraison ? `Livrée le ${formatDateShort(c.dateLivraison)}` : ''}
                      </Text>
                    </View>
                    <Text className="font-bold text-slate-700 dark:text-slate-300 text-[12px]">
                      {formatFCFA(valeurCommande(c))} F
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 mt-5">
            {!id ? (
              <Text className="text-slate-400 text-sm">La situation s’affiche une fois le livreur choisi.</Text>
            ) : sit.isError ? (
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
                  <LigneKV label="Valeur des commandes (prix + remise)" valeur={sit.data.valeurAchat} />
                  <LigneKV label="dont remise livreur" valeur={sit.data.remiseLivreurCumulee} />
                  <LigneKV label="Dette avant" valeur={sit.data.detteAvant} />
                </View>
                <View className="border-t border-slate-100 dark:border-slate-800 mt-3 pt-3 flex-row justify-between">
                  <Text className="text-slate-700 dark:text-slate-300 font-bold">Total dû</Text>
                  <Text className="font-extrabold text-emerald-800 dark:text-emerald-400 text-base">
                    {formatFCFA(sit.data.totalDu)} FCFA
                  </Text>
                </View>
              </>
            ) : (
              <Text className="text-amber-600 text-sm">Pas de situation calculable</Text>
            )}
          </View>

          <Text className={SECTION}>Montant versé (FCFA)</Text>
          <TextInput
            value={montant}
            onChangeText={setMontant}
            keyboardType="number-pad"
            accessibilityLabel="Montant versé"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
          />
          {sit.data && totalDu > 0 ? (
            <Pressable
              onPress={() => setMontant(String(totalDu))}
              className="self-start bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md mt-2 active:opacity-70"
            >
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                Tout le dû ({formatFCFA(totalDu)})
              </Text>
            </Pressable>
          ) : null}

          <View className="mt-4">
            <DatePickerField label="Date du versement" value={dateVersement} onChange={setDateVersement} optional />
          </View>

          <Text className={SECTION}>Commentaire (optionnel)</Text>
          <TextInput
            value={commentaire}
            onChangeText={setCommentaire}
            multiline
            accessibilityLabel="Commentaire"
            placeholder="ex. paiement partiel"
            placeholderTextColor="#94a3b8"
            className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
          />

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le versement"
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline ? 'bg-slate-200 dark:bg-slate-800' : 'bg-emerald-700 active:opacity-80'
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
      </FormScreen>
    </View>
  );
}

function LigneKV({ label, valeur }: { label: string; valeur: number }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-[12px] text-slate-500 dark:text-slate-400">{label}</Text>
      <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{formatFCFA(valeur)} FCFA</Text>
    </View>
  );
}
