import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  useLivraisonsByLivreur,
  useEncaisserLivraison,
} from '../../../features/livraisons/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import {
  computeSoldeForClient,
  computeEncoursForClient,
} from '../../../lib/credit';
import { isAEncaisser } from '../../../lib/livraison-status';
import { formatFCFA, formatDateShort } from '../../../lib/format';
import type { LivraisonResponse } from '../../../types/api';

/**
 * Page d'encaissement.
 *
 * Deux modes selon les query params :
 *
 *   • `livraisonId` (mode livraison)  — cible une livraison précise. Le
 *     récap montre total livré / déjà encaissé / reste à encaisser pour
 *     CETTE livraison uniquement. Cible historique : bouton Encaisser
 *     du détail livraison.
 *
 *   • `clientId` (mode client) — cible un client. On agrège toutes ses
 *     livraisons non encaissées, on affiche la liste, le total à
 *     encaisser et le solde calculé. Le montant est pré-rempli avec le
 *     reste dû (= solde positif). Cible : bouton Encaisser de la fiche
 *     client et de la liste clients.
 *
 * Le payload backend est le même dans les deux cas : `clientId`,
 * `montantEncaisse`, optional `dateDebut`/`dateFin`/`libre`. Le back
 * applique l'encaissement sur les livraisons en cours côté serveur.
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
  const qEnc = useEncaissementsByLivreur(livreurId);
  const qCli = useClientsByLivreur(livreurId);
  const m = useEncaisserLivraison();

  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [libre, setLibre] = useState(true);
  const todayIso = new Date().toISOString().slice(0, 10);
  const monthAgoIso = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [dateDebut, setDateDebut] = useState<string | null>(monthAgoIso);
  const [dateFin, setDateFin] = useState<string | null>(todayIso);
  const [dateEncaissement, setDateEncaissement] = useState<string | null>(todayIso);

  // Mode = livraison si livraisonId présent, sinon client
  const mode: 'livraison' | 'client' = params.livraisonId ? 'livraison' : 'client';

  // === Mode livraison : recherche de la livraison ciblée ===
  const livraisonCiblee = useMemo(
    () =>
      mode === 'livraison'
        ? (qLiv.data ?? []).find((l) => l.id === params.livraisonId)
        : undefined,
    [mode, qLiv.data, params.livraisonId],
  );

  // === Mode client : agrégation des livraisons non encaissées + solde ===
  const clientId =
    mode === 'client'
      ? params.clientId ?? null
      : livraisonCiblee?.client.id ?? null;

  const client = useMemo(
    () => (qCli.data ?? []).find((c) => c.id === clientId),
    [qCli.data, clientId],
  );

  const livraisonsNonEncaissees = useMemo<LivraisonResponse[]>(() => {
    if (!clientId) return [];
    return (qLiv.data ?? [])
      .filter((l) => l.client.id === clientId && isAEncaisser(l))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [qLiv.data, clientId]);

  const totalNonEncaisse = useMemo(
    () => livraisonsNonEncaissees.reduce((acc, l) => acc + (l.montantLivre ?? 0), 0),
    [livraisonsNonEncaissees],
  );

  const soldeClient = useMemo(
    () =>
      clientId
        ? computeSoldeForClient(qLiv.data ?? [], qEnc.data ?? [], clientId)
        : 0,
    [qLiv.data, qEnc.data, clientId],
  );

  const encoursClient = useMemo(
    () => (clientId ? computeEncoursForClient(qLiv.data ?? [], clientId) : 0),
    [qLiv.data, clientId],
  );

  if (!user) return null;

  if (qLiv.isLoading || qCli.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  // Aucune cible n'est trouvée — message d'erreur clair
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

  // === Calculs des montants à encaisser selon le mode ===
  const totalCible = mode === 'livraison'
    ? livraisonCiblee?.montantLivre ?? 0
    : totalNonEncaisse;
  // Reste à payer = solde dû (positif), borné par totalCible (cas crédit ou
  // sur-encaissement précédent).
  const resteAPayer = Math.max(0, Math.min(soldeClient, totalCible));
  // Pré-remplir le montant la première fois (uniquement si vide)
  if (montant === '' && resteAPayer > 0) {
    setMontant(String(resteAPayer));
  }

  const clientName = client
    ? `${client.prenom} ${client.nom}`.trim()
    : livraisonCiblee
    ? `${livraisonCiblee.client.prenom} ${livraisonCiblee.client.nom}`
    : 'Client';

  const onSubmit = () => {
    if (!clientId) {
      Alert.alert('Erreur', 'Client invalide');
      return;
    }
    const n = parseInt(montant, 10);
    if (!n || n <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (totalCible > 0 && n > totalCible) {
      Alert.alert(
        'Erreur',
        `Le montant dépasse le total à encaisser (${formatFCFA(totalCible)} FCFA)`,
      );
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
        livreurId: user.id,
        clientId,
        montantEncaisse: n,
        commentaire: commentaire.trim() || undefined,
        dateDebut: libre ? undefined : (dateDebut ?? undefined),
        dateFin: libre ? undefined : (dateFin ?? undefined),
        dateEncaissement: dateEncaissement ?? undefined,
        libre: libre || undefined,
      },
      {
        onSuccess: () => {
          setMontant('');
          setCommentaire('');
          setLibre(true);
          setDateDebut(monthAgoIso);
          setDateFin(todayIso);
          setDateEncaissement(todayIso);
          router.back();
          Alert.alert('Succès', 'Encaissement enregistré');
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert(
            'Erreur',
            e.response?.data?.message ?? 'Échec de l’encaissement',
          );
        },
      },
    );
  };

  const montantInt = parseInt(montant, 10) || 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Encaisser" subtitle={clientName} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3">
          {/* Récap principal — 4 chiffres clés */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                {mode === 'livraison'
                  ? 'Total livré (cette livraison)'
                  : 'Total non encaissé'}
              </Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatFCFA(totalCible)} F
              </Text>
            </View>
            {mode === 'client' ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                  Encours (livré non encaissé)
                </Text>
                <Text className="font-bold text-slate-700 dark:text-slate-300">
                  {formatFCFA(encoursClient)} F
                </Text>
              </View>
            ) : null}
            <View className="flex-row justify-between mb-2">
              <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                Solde du client
              </Text>
              <Text
                className={`font-bold ${
                  soldeClient > 0
                    ? 'text-amber-700 dark:text-amber-400'
                    : soldeClient < 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {soldeClient < 0 ? '+' : ''}
                {formatFCFA(Math.abs(soldeClient))} F
                {soldeClient < 0 ? ' (crédit)' : soldeClient > 0 ? ' (dû)' : ''}
              </Text>
            </View>
            <View className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-3 flex-row justify-between">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">
                Reste à encaisser
              </Text>
              <Text className="font-extrabold text-amber-600 dark:text-amber-400 text-base">
                {formatFCFA(resteAPayer)} FCFA
              </Text>
            </View>
          </View>

          {/* Liste des livraisons non encaissées (mode client uniquement) */}
          {mode === 'client' && livraisonsNonEncaissees.length > 0 ? (
            <View className="mt-3">
              <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Livraisons non encaissées ({livraisonsNonEncaissees.length})
              </Text>
              <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 gap-2">
                {livraisonsNonEncaissees.map((l) => (
                  <View
                    key={l.id}
                    className="flex-row justify-between items-center"
                  >
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
                      {formatFCFA(l.montantLivre)} F
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {mode === 'client' && livraisonsNonEncaissees.length === 0 ? (
            <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md p-3 mt-3">
              <Text className="text-[12px] text-emerald-700 dark:text-emerald-400 text-center">
                Toutes les livraisons sont déjà encaissées.
                {soldeClient > 0
                  ? ' Le solde restant correspond à une dette antérieure.'
                  : ''}
              </Text>
            </View>
          ) : null}

          {/* Montant */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Montant reçu (FCFA)
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

          {/* Quick fills */}
          <View className="flex-row gap-2 mt-2 flex-wrap">
            {resteAPayer > 0 ? (
              <Pressable
                onPress={() => setMontant(String(resteAPayer))}
                className="bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md active:opacity-70"
              >
                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  Tout solder ({formatFCFA(resteAPayer)})
                </Text>
              </Pressable>
            ) : null}
            {totalCible > 0 && totalCible !== resteAPayer ? (
              <Pressable
                onPress={() => setMontant(String(totalCible))}
                className="bg-blue-100 dark:bg-blue-500/15 px-3 py-1.5 rounded-md active:opacity-70"
              >
                <Text className="text-blue-700 dark:text-blue-400 text-[11px] font-bold">
                  Total ({formatFCFA(totalCible)})
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Mode toggle */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Mode d'encaissement
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
          <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {libre
              ? 'Solde la dette du client sans contrainte de plage.'
              : 'Encaisse les livraisons de la plage choisie (vérifie les chevauchements).'}
          </Text>

          {!libre ? (
            <View className="mt-4 gap-3">
              <DatePickerField label="Date début" value={dateDebut} onChange={setDateDebut} />
              <DatePickerField label="Date fin" value={dateFin} onChange={setDateFin} />
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

          {/* Commentaire */}
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

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline || montantInt <= 0}
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline || montantInt <= 0
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline || montantInt <= 0 ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : montantInt <= 0
                  ? 'Saisis un montant'
                  : `Encaisser ${formatFCFA(montantInt)} FCFA`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
