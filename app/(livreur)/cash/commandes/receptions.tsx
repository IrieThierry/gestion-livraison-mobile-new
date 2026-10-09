import { useRef, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { dialog } from '../../../../lib/dialog';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  CarteReception,
  SaisieQuantites,
  type Saisie,
} from '../../../../components/livreur/SaisieReception';
import {
  useAnnulerReception,
  useCommande,
  useModifierReception,
} from '../../../../features/commandes/hooks';
import {
  construireModificationReception,
  dateReceptionParam,
  estTitulaireCommande,
  peutCorrigerReception,
  quantiteDansReception,
  quantitesDeReception,
} from '../../../../features/commandes/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { jourLocal } from '../../../../features/encaissements/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import type { ReceptionCommandeResponse } from '../../../../types/api';

/**
 * Réceptions d'une commande (annulées comprises), ouvertes depuis le bouton
 * « Réceptions » de la liste. Corriger et annuler : titulaire seulement (le back arbitre).
 */
export default function ReceptionsCommande() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const q = useCommande(id);
  const mModifier = useModifierReception();
  const mAnnulerReception = useAnnulerReception();
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  // Verrou synchrone : un double tap part avant le rendu qui affiche isPending.
  const verrou = useRef(creerVerrou()).current;

  const commande = q.data;
  const fallback = user?.parentId
    ? '/(livreur)/cash/commandes/a-receptionner'
    : '/(livreur)/cash/commandes';

  if (!commande) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Réceptions" fallback={fallback} />
        {q.isLoading ? (
          <Text className="text-slate-400 text-sm px-4 pt-4">Chargement…</Text>
        ) : q.isError ? (
          <Text className="text-red-600 dark:text-red-400 text-sm px-4 pt-4">
            {extractApiErrorMessage(q.error, 'Réceptions indisponibles')}
          </Text>
        ) : (
          <EmptyState title="Commande introuvable" />
        )}
      </View>
    );
  }

  const titulaire = estTitulaireCommande(commande, user);
  const enCours = mModifier.isPending || mAnnulerReception.isPending;
  const actif = isOnline && !enCours;
  const erreur = (titre: string, defaut: string) => (err: unknown) =>
    dialog.error(titre, extractApiErrorMessage(err, defaut));

  const ouvrirModification = (r: ReceptionCommandeResponse) =>
    setSaisie({
      type: 'modification',
      receptionId: r.id,
      quantites: quantitesDeReception(r),
      date: jourLocal(new Date(r.dateReception)),
    });

  const onValiderSaisie = () => {
    if (!saisie || saisie.type !== 'modification') return;
    const reception = commande.receptions.find((x) => x.id === saisie.receptionId);
    if (!reception) return;
    const r = construireModificationReception(
      commande,
      reception,
      saisie.quantites,
      dateReceptionParam(saisie.date, jourLocal(new Date(reception.dateReception))),
    );
    if (!r.ok) {
      dialog.warning('Modification incomplète', r.erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      mModifier.mutate(
        { id: commande.id, receptionId: reception.id, payload: r.valeur },
        {
          onSuccess: () => {
            setSaisie(null);
            dialog.success('Réception modifiée');
          },
          onError: erreur('Modification refusée', 'Impossible de modifier la réception'),
          onSettled: fin,
        },
      ),
    );
  };

  const onAnnulerReception = (r: ReceptionCommandeResponse) => {
    dialog.confirm({
      title: `Annuler la réception ${r.reference} ?`,
      message:
        'Toutes ses quantités seront retirées du stock de ' +
        `${r.receptionnePar.nom}. La réception restera visible comme annulée.`,
      confirmLabel: 'Oui, annuler la réception',
      cancelLabel: 'Non, garder',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mAnnulerReception.mutate(
            { id: commande.id, receptionId: r.id },
            {
              onSuccess: () => {
                setSaisie(null);
                dialog.success('Réception annulée');
              },
              onError: erreur('Annulation refusée', "Impossible d'annuler la réception"),
              onSettled: fin,
            },
          ),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Réceptions"
        subtitle={`${commande.reference} · ${commande.fournisseur.libelle}`}
        fallback={fallback}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-2 gap-2">
          {commande.receptions.length === 0 ? (
            <EmptyState title="Aucune réception" />
          ) : (
            commande.receptions.map((r) =>
              saisie?.type === 'modification' && saisie.receptionId === r.id ? (
                <SaisieQuantites
                  key={r.id}
                  titre={`Modifier ${r.reference}`}
                  lignes={commande.produitsCommandes}
                  borne={(l) => l.qteRestante + quantiteDansReception(r, l.produit.id)}
                  saisie={saisie}
                  onChange={setSaisie}
                  onValider={onValiderSaisie}
                  onFermer={() => setSaisie(null)}
                  pending={mModifier.isPending}
                  actif={actif}
                />
              ) : (
                <CarteReception
                  key={r.id}
                  reception={r}
                  corrigeable={peutCorrigerReception(commande, r, titulaire)}
                  actif={actif && saisie === null}
                  onModifier={() => ouvrirModification(r)}
                  onAnnuler={() => onAnnulerReception(r)}
                />
              ),
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}
