import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useClientsByLivreur, useEncoursClient } from '../../../features/clients/hooks';
import {
  useCreerEncaissement,
  useSituationEncaissement,
} from '../../../features/encaissements/hooks';
import {
  avanceEstimee,
  dateEncaissementParam,
  jourLocal,
  num,
  parseMontant,
  plageEnParams,
} from '../../../features/encaissements/regles';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { isAEncaisser } from '../../../lib/livraison-status';
import { formatMontant, formatDateShort } from '../../../lib/format';
import type { EncaissementLivraisonResponse, LivraisonResponse } from '../../../types/api';

/**
 * Page d'encaissement d'un paiement client.
 *
 *   • `livraisonId` — on arrive depuis une livraison : son dû restant
 *     (serveur, `montantDu`) est affiché et pré-rempli.
 *   • `clientId` — on arrive depuis la fiche / la liste clients : le
 *     solde du client (serveur) est pré-rempli.
 *
 * Tous les montants dus viennent du serveur : solde et limite via
 * `GET /client/{id}/encours`, situation d'une plage via
 * `GET /encaissement/livraison/situation`. Un paiement au-delà du dû est
 * accepté : c'est une avance (solde négatif). Mode libre par défaut.
 */
export default function EncaisserPage() {
  const params = useLocalSearchParams<{
    livraisonId?: string;
    clientId?: string;
  }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';

  const qLiv = useLivraisonsByLivreur(livreurId);
  const qCli = useClientsByLivreur(livreurId);
  const m = useCreerEncaissement();

  const todayIso = jourLocal(new Date());
  const monthAgoIso = jourLocal(new Date(Date.now() - 30 * 86_400_000));
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [libre, setLibre] = useState(true);
  const [dateDebut, setDateDebut] = useState<string | null>(monthAgoIso);
  const [dateFin, setDateFin] = useState<string | null>(todayIso);
  const [dateEncaissement, setDateEncaissement] = useState<string | null>(todayIso);

  const mode: 'livraison' | 'client' = params.livraisonId ? 'livraison' : 'client';

  const livraisonCiblee = useMemo(
    () =>
      mode === 'livraison'
        ? (qLiv.data ?? []).find((l) => l.id === params.livraisonId)
        : undefined,
    [mode, qLiv.data, params.livraisonId],
  );

  const clientId =
    mode === 'client' ? params.clientId ?? null : livraisonCiblee?.client.id ?? null;

  const client = useMemo(
    () => (qCli.data ?? []).find((c) => c.id === clientId),
    [qCli.data, clientId],
  );

  const qEncours = useEncoursClient(clientId);
  const encours = qEncours.data;
  const solde = num(encours?.solde);

  const plageValide = !libre && !!dateDebut && !!dateFin && dateDebut <= dateFin;
  const qSituation = useSituationEncaissement(
    plageValide && clientId && livreurId
      ? { livreurId, clientId, ...plageEnParams(dateDebut as string, dateFin as string) }
      : null,
  );
  const situation = qSituation.data;

  const livraisonsNonEncaissees = useMemo<LivraisonResponse[]>(() => {
    if (!clientId) return [];
    return (qLiv.data ?? [])
      .filter((l) => l.client.id === clientId && isAEncaisser(l))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [qLiv.data, clientId]);

  const duLivraison = num(livraisonCiblee?.montantDu);

  // Pré-remplissage une seule fois, hors du rendu, dès que le dû serveur est connu.
  const prerempli = useRef(false);
  useEffect(() => {
    if (prerempli.current || !encours) return;
    if (mode === 'livraison' && !livraisonCiblee) return;
    prerempli.current = true;
    const suggestion = mode === 'livraison' && duLivraison > 0 ? duLivraison : Math.max(0, solde);
    if (suggestion > 0) setMontant(String(suggestion));
  }, [encours, mode, livraisonCiblee, duLivraison, solde]);

  if (!user) return null;

  if (qLiv.isLoading || qCli.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (mode === 'livraison' && !livraisonCiblee) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Encaisser" />
        <EmptyState
          title="Livraison introuvable"
          message="Reviens à la tournée et choisis une livraison."
        />
      </View>
    );
  }
  if (mode === 'client' && !client) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Encaisser" />
        <EmptyState
          title="Client introuvable"
          message="Ce client n'est plus dans ta liste."
        />
      </View>
    );
  }

  const clientName = client
    ? `${client.prenom} ${client.nom ?? ''}`.trim()
    : livraisonCiblee
    ? `${livraisonCiblee.client.prenom} ${livraisonCiblee.client.nom ?? ''}`.trim()
    : 'Client';

  const saisie = parseMontant(montant);
  const montantSaisi = saisie.ok ? saisie.valeur : 0;
  const avance = encours && montantSaisi > 0 ? avanceEstimee(solde, montantSaisi) : 0;

  const messageApres = (enc: EncaissementLivraisonResponse | null): string => {
    if (!enc) return 'Le solde du client est mis à jour.';
    const apres = num(enc.detteApres);
    if (apres > 0) return `Reste dû par le client : ${formatMontant(apres)} FCFA`;
    if (apres < 0) return `Avance du client : ${formatMontant(-apres)} FCFA`;
    return 'Le client est à jour.';
  };

  const onSubmit = () => {
    if (!clientId) {
      dialog.error('Erreur', 'Client invalide');
      return;
    }
    if (!isOnline) {
      dialog.warning('Hors ligne', "L'encaissement nécessite une connexion. Réessaye une fois en ligne.");
      return;
    }
    if (!saisie.ok) {
      dialog.warning('Montant invalide', saisie.erreur);
      return;
    }
    if (!libre && (!dateDebut || !dateFin)) {
      dialog.warning('Champs requis', 'Date début et date fin requises en mode période');
      return;
    }
    if (!libre && dateDebut && dateFin && dateDebut > dateFin) {
      dialog.warning('Dates invalides', 'La date de début doit être avant la date de fin');
      return;
    }

    const plage = !libre && dateDebut && dateFin ? plageEnParams(dateDebut, dateFin) : null;
    m.mutate(
      {
        livreurId: user.id,
        clientId,
        montantEncaisse: saisie.valeur,
        commentaire: commentaire.trim() || undefined,
        dateDebut: plage?.dateDebut,
        dateFin: plage?.dateFin,
        dateEncaissement: dateEncaissementParam(dateEncaissement, todayIso),
        libre,
      },
      {
        onSuccess: (enc) => {
          router.back();
          dialog.success('Encaissement enregistré', messageApres(enc), { autoDismissMs: 4000 });
        },
        onError: (err: unknown) => {
          dialog.error('Erreur', extractApiErrorMessage(err, 'Échec de l’encaissement'));
        },
      },
    );
  };

  const soldeLabel =
    solde > 0 ? ' (dû)' : solde < 0 ? ' (avance)' : '';
  const soldeClass =
    solde > 0
      ? 'text-amber-700 dark:text-amber-400'
      : solde < 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-slate-700 dark:text-slate-300';
  const desactive = m.isPending || !isOnline || montantSaisi <= 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Encaisser" subtitle={clientName} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3">
          {/* Récap serveur */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
            {mode === 'livraison' ? (
              <Ligne label="Dû restant (cette livraison)" valeur={`${formatMontant(duLivraison)} F`} />
            ) : null}
            {qEncours.isLoading ? (
              <ActivityIndicator color="#10b981" />
            ) : qEncours.isError ? (
              <Text className="text-[12px] text-red-600 dark:text-red-400">
                {extractApiErrorMessage(qEncours.error, 'Solde du client indisponible')}
              </Text>
            ) : (
              <>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                    Solde du client
                  </Text>
                  <Text className={`font-bold ${soldeClass}`}>
                    {formatMontant(Math.abs(solde))} F{soldeLabel}
                  </Text>
                </View>
                <Ligne
                  label="Limite de crédit"
                  valeur={`${formatMontant(num(encours?.limiteCredit))} F`}
                />
                {encours?.enDepassement ? (
                  <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-2 py-1 mt-1">
                    <Text className="text-[11px] font-bold text-red-700 dark:text-red-400">
                      Limite de crédit dépassée
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Livraisons avec un dû restant (mode client) */}
          {mode === 'client' && livraisonsNonEncaissees.length > 0 ? (
            <View className="mt-3">
              <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Livraisons non encaissées ({livraisonsNonEncaissees.length})
              </Text>
              <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 gap-2">
                {livraisonsNonEncaissees.map((l) => (
                  <View key={l.id} className="flex-row justify-between items-center">
                    <View className="flex-1 pr-2">
                      <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                        {formatDateShort(l.date)}
                      </Text>
                      <Text className="text-[10px] text-slate-400 dark:text-slate-500">
                        {(l.produitsLivraison ?? [])
                          .map((p) => `${p.qteLivre} ${p.produit.designation}`)
                          .join(' · ') || '—'}
                      </Text>
                    </View>
                    <Text className="font-extrabold text-slate-700 dark:text-slate-300">
                      {formatMontant(num(l.montantDu))} F
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Montant */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Montant reçu (FCFA)
          </Text>
          <TextInput
            value={montant}
            onChangeText={setMontant}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
          />
          {montant !== '' && !saisie.ok ? (
            <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">{saisie.erreur}</Text>
          ) : null}
          {avance > 0 ? (
            <Text className="text-[12px] text-emerald-700 dark:text-emerald-400 mt-1">
              dont avance de {formatMontant(avance)} FCFA (estimation)
            </Text>
          ) : null}

          {/* Remplissages rapides (valeurs serveur) */}
          <View className="flex-row gap-2 mt-2 flex-wrap">
            {solde > 0 ? (
              <Raccourci
                label={`Tout solder (${formatMontant(solde)})`}
                onPress={() => setMontant(String(solde))}
              />
            ) : null}
            {mode === 'livraison' && duLivraison > 0 && duLivraison !== solde ? (
              <Raccourci
                label={`Cette livraison (${formatMontant(duLivraison)})`}
                onPress={() => setMontant(String(duLivraison))}
              />
            ) : null}
            {situation && num(situation.valeurLivraisons) > 0 ? (
              <Raccourci
                label={`Période (${formatMontant(num(situation.valeurLivraisons))})`}
                onPress={() => setMontant(String(num(situation.valeurLivraisons)))}
              />
            ) : null}
          </View>

          {/* Mode */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Mode d'encaissement
          </Text>
          <View className="flex-row gap-2">
            <ModeBouton actif={libre} label="Solde libre" onPress={() => setLibre(true)} />
            <ModeBouton actif={!libre} label="Sur une période" onPress={() => setLibre(false)} />
          </View>
          <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {libre
              ? 'Le paiement est imputé au solde du client.'
              : 'Le paiement est imputé au solde du client ; la période sert de repère.'}
          </Text>

          {!libre ? (
            <View className="mt-4 gap-3">
              <DatePickerField label="Date début" value={dateDebut} onChange={setDateDebut} />
              <DatePickerField label="Date fin" value={dateFin} onChange={setDateFin} />
              {qSituation.isLoading && plageValide ? (
                <ActivityIndicator color="#10b981" />
              ) : qSituation.isError ? (
                <Text className="text-[12px] text-red-600 dark:text-red-400">
                  {extractApiErrorMessage(qSituation.error, 'Situation indisponible')}
                </Text>
              ) : situation ? (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
                  <Ligne
                    label="Livraisons de la période"
                    valeur={`${formatMontant(num(situation.valeurLivraisons))} F`}
                  />
                  <Ligne
                    label="Remise de la période"
                    valeur={`${formatMontant(num(situation.margeCumulee))} F`}
                  />
                  <Ligne
                    label="Solde hors période"
                    valeur={`${formatMontant(num(situation.detteAvant))} F`}
                  />
                  <Ligne
                    label="Total dû"
                    valeur={`${formatMontant(num(situation.totalDu))} F`}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-4">
            <DatePickerField
              label="Date encaissement"
              value={dateEncaissement}
              onChange={setDateEncaissement}
              optional
            />
          </View>

          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
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

          <Pressable
            onPress={onSubmit}
            disabled={desactive}
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline || montantSaisi <= 0
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline || montantSaisi <= 0 ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : montantSaisi <= 0
                  ? 'Saisis un montant'
                  : `Encaisser ${formatMontant(montantSaisi)} FCFA`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View className="flex-row justify-between mb-2">
      <Text className="text-slate-500 dark:text-slate-400 text-[12px]">{label}</Text>
      <Text className="font-bold text-slate-700 dark:text-slate-300">{valeur}</Text>
    </View>
  );
}

function Raccourci({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md active:opacity-70"
    >
      <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">{label}</Text>
    </Pressable>
  );
}

function ModeBouton({
  actif,
  label,
  onPress,
}: {
  actif: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-2.5 rounded-md items-center ${
        actif
          ? 'bg-emerald-500'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text
        className={`font-bold text-[13px] ${
          actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
