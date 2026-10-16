import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState } from '../shared/EmptyState';
import { FormScreen } from '../shared/FormScreen';
import { DatePickerField } from '../shared/DatePickerField';
import {
  LIBELLE_STATUT_DEMANDE,
  champsModifies,
  construireDemandeModif,
  estADeciderPour,
  libelleDemandeur,
  separerDemandes,
  validerMotifRejet,
} from '../../features/demandes-modif/regles';
import type { RoleDemandes } from '../../features/demandes-modif/api';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { extractApiErrorMessage } from '../../lib/api-error';
import { dialog } from '../../lib/dialog';
import { formatDateLong, formatFCFA } from '../../lib/format';
import type {
  CreerDemandeModifVersementRequest,
  DemandeModificationVersementResponse,
  UUID,
  VersementResponse,
} from '../../types/api';

const SECTION =
  'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2';
const LABEL = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2';
const CHAMP =
  'px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white';

/** Lecture (TanStack Query) utilisée par ces écrans. */
interface Lecture<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  isFetching?: boolean;
  error?: unknown;
  refetch: () => unknown;
}

interface Mutation<V> {
  mutate: (v: V, o: { onSettled: () => void; onSuccess: () => void; onError: (e: unknown) => void }) => void;
  isPending: boolean;
}

/** L'autre partie : celle qui décide des demandes « initiées par moi ». */
const AUTRE: Record<RoleDemandes, string> = { livreur: 'du fournisseur', fournisseur: 'du livreur' };

/** Titre d'un versement dans une demande : l'autre partie et la date. */
function titreVersement(v: VersementResponse, role: RoleDemandes): string {
  const partie =
    role === 'livreur'
      ? (v.fournisseur?.libelle ?? 'Fournisseur')
      : [v.livreur?.prenom, v.livreur?.nom].filter(Boolean).join(' ') || 'Livreur';
  return `${partie} · ${formatDateLong(v.dateVersement)}`;
}

/**
 * N7, FM3 : « Demandes de modification » de versement, pour le livreur
 * principal ou le fournisseur. En attente : avant → après de chaque champ
 * demandé ; une demande de l'autre partie s'approuve, ou se rejette avec un
 * motif obligatoire. Historique des demandes décidées.
 */
export function EcranDemandesModif({
  role,
  demandesQ,
  versementsQ,
  approuver,
  rejeter,
  messageVide,
}: {
  role: RoleDemandes;
  demandesQ: Lecture<DemandeModificationVersementResponse[]>;
  /** Versements connus (valeurs « avant » et titre). */
  versementsQ: Lecture<VersementResponse[]>;
  approuver: Mutation<UUID>;
  rejeter: Mutation<{ id: UUID; motif: string }>;
  messageVide: string;
}) {
  const verrou = useRef(creerVerrou()).current;
  const [rejetEnCours, setRejetEnCours] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const q = demandesQ;

  const { enAttente, historique } = useMemo(() => separerDemandes(q.data ?? [], role), [q.data, role]);
  const versements = useMemo(
    () => new Map((versementsQ.data ?? []).map((v) => [v.id, v] as const)),
    [versementsQ.data],
  );

  const onApprouver = (d: DemandeModificationVersementResponse) =>
    dialog.confirm({
      title: 'Approuver la demande ?',
      message: 'Le versement sera modifié et la dette recalculée.',
      confirmLabel: 'Approuver',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          approuver.mutate(d.id, {
            onSettled: fin,
            onSuccess: () => dialog.success('Demande approuvée', 'Versement modifié et dette recalculée.'),
            onError: (err: unknown) => dialog.error('Erreur', extractApiErrorMessage(err, 'Approbation impossible')),
          }),
        ),
    });

  const onRejeter = (d: DemandeModificationVersementResponse) => {
    const r = validerMotifRejet(motif);
    if (!r.ok) {
      dialog.warning('Motif manquant', r.erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      rejeter.mutate(
        { id: d.id, motif: r.valeur },
        {
          onSettled: fin,
          onSuccess: () => {
            setRejetEnCours(null);
            setMotif('');
            dialog.success('Demande rejetée');
          },
          onError: (err: unknown) => dialog.error('Erreur', extractApiErrorMessage(err, 'Rejet impossible')),
        },
      ),
    );
  };

  const occupe = approuver.isPending || rejeter.isPending;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Demandes de modification" subtitle={`${enAttente.length} en attente`} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={!!q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              versementsQ.refetch();
            }}
            tintColor="#047857"
          />
        }
      >
        {!q.isError && versementsQ.isError ? (
          <View className="mt-3 mb-1 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40">
            <Text className="text-[12px] text-amber-800 dark:text-amber-300">
              Les versements n’ont pas pu être chargés : les valeurs « avant » ne sont pas affichées.
            </Text>
            <Pressable onPress={() => versementsQ.refetch()} accessibilityRole="button" className="mt-1 active:opacity-70">
              <Text className="text-[12px] font-bold text-amber-900 dark:text-amber-200">Réessayer</Text>
            </Pressable>
          </View>
        ) : null}
        {q.isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#047857" />
          </View>
        ) : q.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(q.error, 'Impossible de charger les demandes.')}
          />
        ) : enAttente.length === 0 && historique.length === 0 ? (
          <EmptyState title="Aucune demande" message={messageVide} />
        ) : (
          <>
            <Text className={SECTION}>En attente</Text>
            {enAttente.length === 0 ? (
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 mb-2">Aucune demande en attente.</Text>
            ) : (
              enAttente.map((d) => (
                <View key={d.id} className={`${CARTE} border-l-4 border-l-amber-500`}>
                  <EnTeteDemande d={d} v={versements.get(d.versementId)} role={role} />
                  <Changements d={d} v={versements.get(d.versementId)} />
                  {estADeciderPour(role)(d) ? (
                    rejetEnCours === d.id ? (
                      <View className="mt-2">
                        <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Motif du rejet *
                        </Text>
                        <TextInput
                          value={motif}
                          onChangeText={setMotif}
                          multiline
                          accessibilityLabel="Motif du rejet"
                          placeholder="Ex : le montant indiqué est incorrect"
                          placeholderTextColor="#94a3b8"
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white min-h-[60px]"
                        />
                        <View className="flex-row gap-2 mt-2">
                          <Pressable
                            onPress={() => {
                              setRejetEnCours(null);
                              setMotif('');
                            }}
                            className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md py-2 items-center active:opacity-70"
                          >
                            <Text className="font-bold text-slate-700 dark:text-slate-300 text-[13px]">Annuler</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => onRejeter(d)}
                            disabled={occupe}
                            className="flex-1 bg-red-600 rounded-md py-2 items-center active:opacity-80"
                          >
                            <Text className="font-bold text-white text-[13px]">Confirmer le rejet</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row gap-2 mt-2">
                        <Pressable
                          onPress={() => onApprouver(d)}
                          disabled={occupe}
                          className="flex-1 bg-emerald-700 rounded-md py-2 items-center active:opacity-80"
                        >
                          <Text className="font-bold text-white text-[13px]">Approuver</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setRejetEnCours(d.id);
                            setMotif('');
                          }}
                          disabled={occupe}
                          className="flex-1 border border-red-300 dark:border-red-500/40 rounded-md py-2 items-center active:opacity-70"
                        >
                          <Text className="font-bold text-red-600 dark:text-red-400 text-[13px]">Rejeter</Text>
                        </Pressable>
                      </View>
                    )
                  ) : (
                    <Text className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-2">
                      En attente de la décision {AUTRE[role]}
                    </Text>
                  )}
                </View>
              ))
            )}

            {historique.length > 0 ? (
              <>
                <Text className={SECTION}>Historique</Text>
                {historique.map((d) => (
                  <View key={d.id} className={CARTE}>
                    <EnTeteDemande d={d} v={versements.get(d.versementId)} role={role} />
                    <Changements d={d} v={undefined} />
                    {d.motifDecision ? (
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Motif de la décision : {d.motifDecision}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function EnTeteDemande({
  d,
  v,
  role,
}: {
  d: DemandeModificationVersementResponse;
  v: VersementResponse | undefined;
  role: RoleDemandes;
}) {
  const couleur =
    d.statut === 'APPROVED'
      ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : d.statut === 'REJECTED'
        ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400'
        : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400';
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold text-slate-900 dark:text-white flex-1 pr-2" numberOfLines={1}>
          {v ? titreVersement(v, role) : 'Versement'}
        </Text>
        <Text className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${couleur}`}>
          {LIBELLE_STATUT_DEMANDE[d.statut] ?? d.statut}
        </Text>
      </View>
      {v ? (
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Versement de {formatFCFA(Number(v.montantVerse))} F
        </Text>
      ) : null}
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        {libelleDemandeur(d, role)}
        {d.createdAt ? ` · ${formatDateLong(d.createdAt)}` : ''}
      </Text>
      {d.motifDemande ? (
        <Text className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-0.5">« {d.motifDemande} »</Text>
      ) : null}
    </View>
  );
}

/** Champs demandés : avant → après (avant seulement si le versement est connu). */
function Changements({ d, v }: { d: DemandeModificationVersementResponse; v: VersementResponse | undefined }) {
  const champs = champsModifies(d.payloadModif, v);
  if (champs.length === 0) return null;
  return (
    <View className="mt-2 bg-slate-50 dark:bg-slate-800/60 rounded-md p-2 gap-1">
      {champs.map((c) => (
        <Text key={c.libelle} className="text-[12px] text-slate-700 dark:text-slate-300">
          <Text className="font-bold">{c.libelle} : </Text>
          {c.avant != null ? `${c.avant} → ${c.apres}` : `→ ${c.apres}`}
        </Text>
      ))}
    </View>
  );
}

/**
 * N7, FM3 : « Demander une modification » d'un versement (mêmes champs que le
 * web) : nouvelle date de versement, nouveau montant, nouveau commentaire ; un
 * champ laissé vide ne change pas. Motif obligatoire. L'autre partie doit approuver.
 */
export function EcranDemanderModif({
  role,
  versement,
  versementsQ,
  creer,
  isOnline,
  onEnvoyee,
}: {
  role: RoleDemandes;
  versement: VersementResponse | undefined;
  versementsQ: Pick<Lecture<unknown>, 'isLoading' | 'isError' | 'error'>;
  creer: Mutation<CreerDemandeModifVersementRequest>;
  isOnline: boolean;
  /** Après l'envoi réussi (retour à la liste). */
  onEnvoyee: () => void;
}) {
  const verrou = useRef(creerVerrou()).current;
  const [dateVersement, setDateVersement] = useState<string | null>(null);
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [motif, setMotif] = useState('');

  const autrePartie = versement
    ? role === 'livreur'
      ? (versement.fournisseur?.libelle ?? 'le fournisseur')
      : [versement.livreur?.prenom, versement.livreur?.nom].filter(Boolean).join(' ') || 'le livreur'
    : undefined;

  if (!versementsQ.isLoading && !versement) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Demander une modification" />
        {versementsQ.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(versementsQ.error, 'Impossible de charger le versement.')}
          />
        ) : (
          <EmptyState title="Versement introuvable" />
        )}
      </View>
    );
  }

  const onSubmit = () => {
    if (!versement) return;
    const r = construireDemandeModif({
      versementId: versement.id,
      dateVersement,
      montantVerse: montant,
      commentaire,
      motif,
    });
    if (!r.ok) {
      dialog.warning('Demande incomplète', r.erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      creer.mutate(r.valeur, {
        onSettled: fin,
        onSuccess: () => {
          onEnvoyee();
          dialog.success(
            'Demande de modification envoyée',
            role === 'livreur' ? 'Le fournisseur doit l’approuver.' : 'Le livreur doit l’approuver.',
          );
        },
        onError: (err: unknown) => dialog.error('Erreur', extractApiErrorMessage(err, 'Création de demande impossible')),
      }),
    );
  };

  const desactive = creer.isPending || !isOnline || !motif.trim();

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Demander une modification" subtitle={autrePartie} />
      <FormScreen>
        {versementsQ.isLoading || !versement ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#047857" />
          </View>
        ) : (
          <View className="px-4 pt-3 gap-3">
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <Text className="text-[12px] text-slate-700 dark:text-slate-300">
                {role === 'livreur'
                  ? `Versement du ${formatDateLong(versement.dateVersement)} : ${formatFCFA(Number(versement.montantVerse))} F chez ${autrePartie}.`
                  : `Versement du ${formatDateLong(versement.dateVersement)} : ${formatFCFA(Number(versement.montantVerse))} F reçu de ${autrePartie}.`}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Livraisons du {formatDateLong(versement.dateDebut)} au {formatDateLong(versement.dateFin)} (plage
                déterminée par les commandes réglées, non modifiable). Laisse un champ vide pour ne pas le modifier.
              </Text>
            </View>

            <DatePickerField
              label="Nouvelle date de versement"
              value={dateVersement}
              onChange={setDateVersement}
              optional
              maximumDate={new Date()}
            />

            <View>
              <Text className={LABEL}>Nouveau montant versé (FCFA)</Text>
              <TextInput
                value={montant}
                onChangeText={setMontant}
                keyboardType="decimal-pad"
                accessibilityLabel="Nouveau montant versé"
                placeholder={String(versement.montantVerse)}
                placeholderTextColor="#94a3b8"
                className={CHAMP}
              />
            </View>

            <View>
              <Text className={LABEL}>Nouveau commentaire</Text>
              <TextInput
                value={commentaire}
                onChangeText={setCommentaire}
                accessibilityLabel="Nouveau commentaire"
                placeholder={versement.commentaire ?? 'Aucun commentaire'}
                placeholderTextColor="#94a3b8"
                className={CHAMP}
              />
            </View>

            <View>
              <Text className={LABEL}>Motif de la demande *</Text>
              <TextInput
                value={motif}
                onChangeText={setMotif}
                multiline
                accessibilityLabel="Motif de la demande"
                placeholder="Ex : erreur sur le montant versé"
                placeholderTextColor="#94a3b8"
                className={`${CHAMP} min-h-[80px]`}
              />
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={desactive}
              className={`rounded-md py-3.5 mt-3 items-center ${
                desactive && !creer.isPending ? 'bg-slate-200 dark:bg-slate-800' : 'bg-emerald-700 active:opacity-80'
              }`}
            >
              {creer.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-bold text-base ${desactive ? 'text-slate-400' : 'text-white'}`}>
                  {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Envoyer la demande'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </FormScreen>
    </View>
  );
}
