import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { PageHeader } from '../shared/PageHeader';
import { FormScreen } from '../shared/FormScreen';
import { EmptyState } from '../shared/EmptyState';
import { ProduitVignette } from '../shared/ProduitVignette';
import { CommandeStatusBadge, ReglementBadge } from '../livreur/CommandeStatusBadge';
import { MontantCommande } from '../livreur/MontantCommande';
import {
  useCommandesFournisseur,
  useConfirmerCommandeFournisseur,
  useRefuserCommandeFournisseur,
} from '../../features/fournisseur/hooks';
import { lireMotifRefus, nomLivreur, peutConfirmer, peutRefuser } from '../../features/fournisseur/gestion';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { useNetworkStore } from '../../stores/networkStore';
import { dialog } from '../../lib/dialog';
import { extractApiErrorMessage } from '../../lib/api-error';
import { formatDateLong, formatDateShort, formatFCFA } from '../../lib/format';
import type { CommandeResponse, ProduitCommandeResponse, ReceptionCommandeResponse, UUID } from '../../types/api';

const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';

/** Carte d'une commande reçue (listes Commandes et Commandes d'un livreur). */
export function CarteCommandeFournisseur({
  commande: c,
  onPress,
  afficherLivreur = true,
}: {
  commande: CommandeResponse;
  onPress: () => void;
  afficherLivreur?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Commande ${c.reference}`}
      className={`${CARTE} p-3 active:opacity-80`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{c.reference}</Text>
        <View className="flex-row items-center gap-1">
          <CommandeStatusBadge statut={c.statut} />
          {c.versementId ? <ReglementBadge /> : null}
        </View>
      </View>
      {afficherLivreur ? (
        <Text className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">{nomLivreur(c.livreur)}</Text>
      ) : null}
      <View className="flex-row items-center justify-between mt-1">
        <Text className="text-[10px] text-slate-500 dark:text-slate-400">{formatDateShort(c.date)}</Text>
        <MontantCommande commande={c} />
      </View>
    </Pressable>
  );
}

/**
 * F2 : détail d'une commande reçue (onglet Commandes, ou commandes d'un livreur), lu dans
 * la liste du fournisseur (pas de GET par id côté fournisseur, comme le web). Actions
 * selon le statut : Confirmer (envoyée), Refuser avec un motif obligatoire (envoyée ou
 * confirmée). Le reste est en lecture seule : la réception et « Passer à Livrée »
 * appartiennent au livreur.
 */
export function DetailCommandeFournisseur({ id }: { id: UUID | undefined }) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const q = useCommandesFournisseur();
  const mConfirmer = useConfirmerCommandeFournisseur();
  const mRefuser = useRefuserCommandeFournisseur();
  const verrou = useRef(creerVerrou()).current;
  const [motif, setMotif] = useState<string | null>(null);
  const [erreurMotif, setErreurMotif] = useState<string | null>(null);

  const commande = q.data?.find((c) => c.id === id);

  if (!commande) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Commande" />
        {q.isLoading ? (
          <Text className="text-slate-400 text-sm px-4 pt-4">Chargement…</Text>
        ) : q.isError ? (
          <EmptyState title="Commande indisponible" message={extractApiErrorMessage(q.error, 'Commandes indisponibles')} />
        ) : (
          <EmptyState title="Commande introuvable" message="Elle n’apparaît plus dans tes commandes reçues." />
        )}
      </View>
    );
  }

  const enCours = mConfirmer.isPending || mRefuser.isPending;
  const actif = isOnline && !enCours;
  const livreur = nomLivreur(commande.livreur);

  const onConfirmer = () =>
    lancerUneFois(verrou, (fin) =>
      mConfirmer.mutate(commande.id, {
        onSuccess: () => dialog.success('Commande confirmée'),
        onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, 'Impossible de confirmer la commande')),
        onSettled: fin,
      }),
    );

  const onRefuser = () => {
    const lecture = lireMotifRefus(motif ?? '');
    if (!lecture.ok) {
      setErreurMotif(lecture.erreur);
      return;
    }
    setErreurMotif(null);
    lancerUneFois(verrou, (fin) =>
      mRefuser.mutate(
        { id: commande.id, motif: lecture.motif },
        {
          onSuccess: () => {
            setMotif(null);
            dialog.success('Commande refusée');
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, 'Impossible de refuser la commande')),
          onSettled: fin,
        },
      ),
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={commande.reference} subtitle={livreur} />
      <FormScreen>
        <View className="px-4">
          <View className="flex-row items-center gap-2">
            <CommandeStatusBadge statut={commande.statut} />
            {commande.versementId ? <ReglementBadge /> : null}
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Passée le {formatDateLong(commande.date)} par {livreur}
            {commande.livreur.contact ? ` · ${commande.livreur.contact}` : ''}
          </Text>
          {commande.dateDecision ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Réponse le {formatDateLong(commande.dateDecision)}
            </Text>
          ) : null}
          {commande.dateLivraison ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Livrée le {formatDateLong(commande.dateLivraison)}
            </Text>
          ) : null}
          {commande.livreeManuellement ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Passée à Livrée par {commande.livreePar?.nom ?? '—'}
              {commande.dateLivree ? ` le ${formatDateLong(commande.dateLivree)}` : ''} : le reliquat a été abandonné.
            </Text>
          ) : null}
          {commande.apprentiAffecte ? (
            <Text className="text-[12px] text-slate-700 dark:text-slate-300 mt-2">
              Apprenti affecté : <Text className="font-bold">{commande.apprentiAffecte.nom}</Text>
            </Text>
          ) : null}

          {commande.motifRefus ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3">
              <Text className="text-red-700 dark:text-red-400 text-[12px]">Motif du refus : {commande.motifRefus}</Text>
            </View>
          ) : null}

          <Text className={SECTION}>Produits</Text>
          <View className={CARTE}>
            {commande.produitsCommandes.map((l, i) => (
              <LigneProduit key={l.id} ligne={l} first={i === 0} />
            ))}
          </View>

          <MontantCommande commande={commande} variante="detail" />
          {commande.remiseLivreurLivree != null ? (
            <View className="flex-row justify-between mt-1 px-1">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">Remise livreur</Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatFCFA(commande.remiseLivreurLivree)} F
              </Text>
            </View>
          ) : null}

          {commande.receptions.length > 0 ? (
            <>
              <Text className={SECTION}>Réceptions ({commande.receptions.length})</Text>
              <View className="gap-2">
                {commande.receptions.map((r) => (
                  <CarteReception key={r.id} reception={r} />
                ))}
              </View>
            </>
          ) : null}

          {motif !== null ? (
            <View className={`${CARTE} p-4 mt-5`}>
              <Text className="font-extrabold text-slate-900 dark:text-white text-[14px]">
                Refuser la commande {commande.reference}
              </Text>
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
                {livreur} sera informé du refus. Cette action est définitive.
              </Text>
              <Text className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-3 mb-1">Motif *</Text>
              <TextInput
                value={motif}
                onChangeText={(t) => {
                  setMotif(t);
                  if (erreurMotif) setErreurMotif(null);
                }}
                accessibilityLabel="Motif du refus"
                placeholder="ex. rupture de stock"
                placeholderTextColor="#94a3b8"
                multiline
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[70px]"
              />
              {erreurMotif ? <Text className="text-red-600 dark:text-red-400 text-[12px] mt-1">{erreurMotif}</Text> : null}
              <View className="flex-row gap-2 mt-3">
                <Pressable
                  onPress={() => {
                    setMotif(null);
                    setErreurMotif(null);
                  }}
                  disabled={mRefuser.isPending}
                  className="flex-1 rounded-md py-3 items-center border border-slate-300 dark:border-slate-700 active:opacity-70"
                >
                  <Text className="font-bold text-slate-700 dark:text-slate-200">Retour</Text>
                </Pressable>
                <BoutonAction
                  label="Refuser la commande"
                  couleur="bg-red-600"
                  onPress={onRefuser}
                  actif={actif}
                  isOnline={isOnline}
                  pending={mRefuser.isPending}
                  flex
                />
              </View>
            </View>
          ) : (
            <>
              {peutConfirmer(commande) ? (
                <BoutonAction
                  label="Confirmer"
                  couleur="bg-emerald-700"
                  onPress={onConfirmer}
                  actif={actif}
                  isOnline={isOnline}
                  pending={mConfirmer.isPending}
                />
              ) : null}
              {peutRefuser(commande) ? (
                <BoutonAction
                  label="Refuser"
                  couleur="bg-red-500"
                  onPress={() => setMotif('')}
                  actif={actif}
                  isOnline={isOnline}
                />
              ) : null}
            </>
          )}
        </View>
      </FormScreen>
    </View>
  );
}

function LigneProduit({ ligne: l, first }: { ligne: ProduitCommandeResponse; first: boolean }) {
  return (
    <View className={`px-4 py-3 ${first ? '' : 'border-t border-slate-100 dark:border-slate-800'}`}>
      <View className="flex-row items-center">
        <View className="mr-2">
          <ProduitVignette designation={l.produit.designation} photoUrl={l.produit.photoUrl} size={28} />
        </View>
        <Text className="flex-1 font-extrabold text-slate-900 dark:text-white text-[13px]">{l.produit.designation}</Text>
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-[12px] text-slate-500 dark:text-slate-400">
          Commandé : {l.qteCommandee} · Reçu : {l.qteRecue} · Restant : {l.qteRestante}
        </Text>
        {l.qteRecue > 0 ? (
          <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{formatFCFA(l.montantRecu)} F</Text>
        ) : null}
      </View>
      {l.qteRecue > 0 && l.remiseLivreurRecue > 0 ? (
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Remise livreur reçue : {formatFCFA(l.remiseLivreurRecue)} F
        </Text>
      ) : null}
    </View>
  );
}

/** Réception en lecture seule (le fournisseur ne la modifie pas). */
function CarteReception({ reception: r }: { reception: ReceptionCommandeResponse }) {
  return (
    <View className={`${CARTE} p-3 ${r.annulee ? 'opacity-60' : ''}`}>
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[12px]">{r.reference}</Text>
        {r.annulee ? <Text className="text-[10px] font-bold text-red-600 dark:text-red-400">Annulée</Text> : null}
      </View>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        {formatDateLong(r.dateReception)} · par {r.receptionnePar.nom}
      </Text>
      {r.lignes.map((l) => (
        <Text key={l.produit.id} className="text-[12px] text-slate-700 dark:text-slate-300 mt-0.5">
          {l.produit.designation} × {l.quantite}
        </Text>
      ))}
    </View>
  );
}

export function BoutonAction({
  label,
  couleur,
  onPress,
  actif,
  isOnline,
  pending,
  flex,
}: {
  label: string;
  couleur: string;
  onPress: () => void;
  actif: boolean;
  isOnline: boolean;
  pending?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`rounded-md py-3.5 items-center ${flex ? 'flex-1' : 'mt-4'} ${
        actif ? `${couleur} active:opacity-80` : 'bg-slate-200 dark:bg-slate-800'
      }`}
    >
      {pending ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`font-bold text-base ${actif ? 'text-white' : 'text-slate-400'}`}>
          {!isOnline ? 'Hors ligne — réessaye en ligne' : label}
        </Text>
      )}
    </Pressable>
  );
}
