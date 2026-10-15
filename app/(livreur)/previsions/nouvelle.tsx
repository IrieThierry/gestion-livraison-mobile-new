import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { dialog } from '../../../lib/dialog';
import { Plus } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { SelectField } from '../../../components/shared/SelectField';
import { FormScreen } from '../../../components/shared/FormScreen';
import { SearchInput } from '../../../components/shared/SearchInput';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { useClientsByLivreur, useEncoursByLivreur } from '../../../features/clients/hooks';
import { optionsClients, soldesParClient } from '../../../features/clients/affichage';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../../lib/recherche';
import { useProduits } from '../../../features/produits/hooks';
import { ErreurEnregistrementPartiel, useEnregistrerPrevisions } from '../../../features/previsions/hooks';
import {
  ajouterJours,
  erreurDatePrevue,
  jourLocal,
  libelleEnregistrerPour,
} from '../../../features/previsions/regles';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { useAuthStore } from '../../../stores/authStore';
import { useRetourListe } from '../../../lib/useRetourListe';
import { ProduitVignette } from '../../../components/shared/ProduitVignette';

/**
 * Formulaire « Nouvelle prévision » multi-produits par client. Le livreur
 * choisit un client + une date, puis saisit une quantité par produit.
 * Tous les produits avec une qté > 0 sont créés en une seule action via
 * une boucle de mutations (l'API ne propose pas de batch côté back).
 *
 * Mirror simplifié de la page web `PrevisionsPage` qui utilise un tableau
 * tous produits.
 */
export default function NouvellePrevision() {
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const aujourdhui = jourLocal();
  const demain = ajouterJours(aujourdhui, 1);
  const [clientId, setClientId] = useState<string | null>(null);
  // Date prévue obligatoire : demain par défaut, jamais dans le passé (aujourd'hui autorisé).
  const [date, setDate] = useState<string | null>(() =>
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date >= aujourdhui ? params.date : demain,
  );
  const erreurDate = erreurDatePrevue(date, aujourdhui);
  const [qtes, setQtes] = useState<Record<string, string>>({});
  const [commentaire, setCommentaire] = useState('');
  // Lignes déjà écrites lors d'un envoi interrompu (retirées du formulaire).
  const [dejaEnregistrees, setDejaEnregistrees] = useState<string[]>([]);
  const [rechercheProduit, setRechercheProduit] = useState('');

  const clientsQ = useClientsByLivreur(livreurId);
  const encoursQ = useEncoursByLivreur(livreurId);
  const produitsQ = useProduits();
  const m = useEnregistrerPrevisions();
  const retourListe = useRetourListe('/(livreur)/previsions');

  const clientOptions = useMemo(
    () =>
      optionsClients(clientsQ.data ?? [], soldesParClient(encoursQ.data)),
    [clientsQ.data, encoursQ.data],
  );

  // Filtre d'affichage seulement : les quantités déjà saisies restent comptées.
  const produitsAffiches = useMemo(
    () => filtrerRecherche(produitsQ.data ?? [], rechercheProduit, (p) => [p.designation, p.code]),
    [produitsQ.data, rechercheProduit],
  );

  const lignesAvecQte = useMemo(() => {
    return (produitsQ.data ?? [])
      .map((p) => ({
        produit: p,
        qte: parseInt(qtes[p.id] ?? '0', 10) || 0,
      }))
      .filter((l) => l.qte > 0);
  }, [produitsQ.data, qtes]);

  const onSubmit = () => {
    if (!user) return;
    if (!clientId) {
      dialog.warning('Champ requis', 'Choisis un client');
      return;
    }
    if (erreurDate || !date) {
      dialog.warning('Date de livraison prévue', erreurDate ?? 'Date requise');
      return;
    }
    if (lignesAvecQte.length === 0) {
      dialog.warning('Lignes invalides', 'Saisis au moins une quantité > 0');
      return;
    }

    // Une prévision existante pour le même client + produit + jour est
    // complétée (quantité ajoutée) au lieu d'être dupliquée.
    const designation = (id: string) =>
      (produitsQ.data ?? []).find((p) => p.id === id)?.designation ?? 'un produit';
    m.mutate(
      {
        livreurId,
        clientId,
        jour: date,
        commentaire: commentaire.trim() || undefined,
        lignes: lignesAvecQte.map((l) => ({ produitId: l.produit.id, qte: l.qte })),
        // Ligne écrite : retirée du formulaire, un nouvel essai ne l'ajoute pas deux fois.
        onLigneEcrite: (produitId) => {
          setQtes((q) => {
            const { [produitId]: _ecrite, ...reste } = q;
            return reste;
          });
          setDejaEnregistrees((d) => [...d, designation(produitId)]);
        },
      },
      {
        onSuccess: () => {
          retourListe();
          dialog.success(
            `${lignesAvecQte.length} prévision${lignesAvecQte.length > 1 ? 's' : ''} enregistrée${lignesAvecQte.length > 1 ? 's' : ''}`,
          );
        },
        onError: (err: unknown) => {
          const cause = err instanceof ErreurEnregistrementPartiel ? err.cause : err;
          const message = extractApiErrorMessage(cause, 'Échec de l’enregistrement');
          const ecrites = err instanceof ErreurEnregistrementPartiel ? err.ecrites.map(designation) : [];
          dialog.error(
            'Enregistrement interrompu',
            ecrites.length > 0
              ? `Enregistrement interrompu : ${message}. Déjà enregistrées : ${ecrites.join(', ')} ; les autres lignes restent à envoyer.`
              : `Enregistrement interrompu : ${message}.`,
          );
        },
      },
    );
  };

  if (!user) return null;

  const inactif = lignesAvecQte.length === 0 || !!erreurDate;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle prévision" subtitle="Multi-produits par client" />

      <FormScreen>
        <View className="px-4 pt-3 gap-3">
          {/* Date prévue : obligatoire, en haut */}
          <DatePickerField
            label="Date de livraison prévue *"
            value={date}
            onChange={setDate}
            minimumDate={new Date(Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(5, 7)) - 1, Number(aujourdhui.slice(8, 10)))}
          />
          {erreurDate ? (
            <Text className="text-[12px] text-red-600 dark:text-red-400">{erreurDate}</Text>
          ) : null}

          {/* Client */}
          <SelectField
            label="Client *"
            placeholder="Choisir un client"
            value={clientId}
            onChange={setClientId}
            options={clientOptions}
            isLoading={clientsQ.isLoading}
            emptyMessage="Aucun client. Crée-en depuis l'onglet Clients."
          />

          {/* Produits */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-2">
            Quantités estimées
          </Text>
          <SearchInput
            value={rechercheProduit}
            onChangeText={setRechercheProduit}
            placeholder="Rechercher un produit…"
          />
          <View className="gap-2">
            {produitsAffiches.length === 0 && rechercheProduit.trim() ? (
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-3">
                {AUCUN_RESULTAT}
              </Text>
            ) : null}
            {produitsAffiches.map((p) => (
              <View
                key={p.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2"
              >
                <ProduitVignette designation={p.designation} photoUrl={p.photoUrl} size={36} />
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white">
                    {p.designation}
                  </Text>
                  {p.code ? (
                    <Text className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {p.code}
                    </Text>
                  ) : null}
                </View>
                <TextInput
                  value={qtes[p.id] ?? ''}
                  onChangeText={(v) =>
                    setQtes((q) => ({
                      ...q,
                      [p.id]: v.replace(/[^0-9]/g, ''),
                    }))
                  }
                  keyboardType="number-pad"
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  className="w-20 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-slate-900 dark:text-white text-base"
                />
              </View>
            ))}
          </View>

          {/* Commentaire */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Commentaire (optionnel)
            </Text>
            <TextInput
              value={commentaire}
              onChangeText={setCommentaire}
              placeholder="…"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white"
            />
          </View>

          {dejaEnregistrees.length > 0 ? (
            <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md p-3 mt-3">
              <Text className="text-[12px] text-emerald-800 dark:text-emerald-200">
                Déjà enregistrées : {dejaEnregistrees.join(', ')}
              </Text>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || inactif}
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${
              inactif
                ? 'bg-slate-300 dark:bg-slate-700'
                : 'bg-emerald-700 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Plus
                  color={inactif ? '#94a3b8' : '#ffffff'}
                  size={16}
                />
                <Text
                  className={`font-bold text-base ${
                    inactif ? 'text-slate-500' : 'text-white'
                  }`}
                >
                  {date && !erreurDate ? libelleEnregistrerPour(date) : 'Choisis la date prévue'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
