import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  useApprouverDemandeModif,
  useDemandesModif,
  useRejeterDemandeModif,
} from '../../../../features/demandes-modif/hooks';
import {
  LIBELLE_STATUT_DEMANDE,
  champsModifies,
  estADecider,
  libelleDemandeur,
  separerDemandes,
  validerMotifRejet,
} from '../../../../features/demandes-modif/regles';
import { useVersementsLivreur } from '../../../../features/versements/hooks';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useAuthStore } from '../../../../stores/authStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { dialog } from '../../../../lib/dialog';
import { formatDateLong, formatFCFA } from '../../../../lib/format';
import type { DemandeModificationVersementResponse, VersementResponse } from '../../../../types/api';

const SECTION =
  'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2';

/**
 * N7 : « Demandes de modification » de versement du livreur principal
 * (`/livreur/me/demandes-modif-versement`). En attente : avant → après de
 * chaque champ demandé ; une demande du fournisseur s'approuve, ou se rejette
 * avec un motif obligatoire. Historique des demandes décidées.
 */
export default function DemandesModification() {
  const user = useAuthStore((s) => s.user);
  const estPrincipal = !!user && !user.parentId;
  const q = useDemandesModif(estPrincipal);
  const qVersements = useVersementsLivreur(estPrincipal ? user?.id : undefined);
  const approuver = useApprouverDemandeModif();
  const rejeter = useRejeterDemandeModif();
  const verrou = useRef(creerVerrou()).current;
  const [rejetEnCours, setRejetEnCours] = useState<string | null>(null);
  const [motif, setMotif] = useState('');

  const { enAttente, historique } = useMemo(() => separerDemandes(q.data ?? []), [q.data]);
  const versements = useMemo(
    () => new Map((qVersements.data ?? []).map((v) => [v.id, v] as const)),
    [qVersements.data],
  );

  if (!user) return null;

  if (!estPrincipal) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Demandes de modification" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal gère les versements aux fournisseurs."
        />
      </View>
    );
  }

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
      <PageHeader
        title="Demandes de modification"
        subtitle={`${enAttente.length} en attente`}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              qVersements.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        {q.isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#10b981" />
          </View>
        ) : q.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(q.error, 'Impossible de charger les demandes.')}
          />
        ) : enAttente.length === 0 && historique.length === 0 ? (
          <EmptyState
            title="Aucune demande"
            message="Pour corriger un versement, ouvre « Mes versements » et touche « Demander une modification »."
          />
        ) : (
          <>
            <Text className={SECTION}>En attente</Text>
            {enAttente.length === 0 ? (
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 mb-2">Aucune demande en attente.</Text>
            ) : (
              enAttente.map((d) => (
                <View key={d.id} className={`${CARTE} border-l-4 border-l-amber-500`}>
                  <EnTeteDemande d={d} v={versements.get(d.versementId)} />
                  <Changements d={d} v={versements.get(d.versementId)} />
                  {estADecider(d) ? (
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
                          className="flex-1 bg-emerald-500 rounded-md py-2 items-center active:opacity-80"
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
                      En attente de la décision du fournisseur
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
                    <EnTeteDemande d={d} v={versements.get(d.versementId)} />
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

function EnTeteDemande({ d, v }: { d: DemandeModificationVersementResponse; v: VersementResponse | undefined }) {
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
          {v ? `${v.fournisseur?.libelle ?? 'Fournisseur'} · ${formatDateLong(v.dateVersement)}` : 'Versement'}
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
        {libelleDemandeur(d)}
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
