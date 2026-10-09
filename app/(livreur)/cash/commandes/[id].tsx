import { useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { dialog } from '../../../../lib/dialog';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  CommandeStatusBadge,
  ReglementBadge,
} from '../../../../components/livreur/CommandeStatusBadge';
import { ApprentiAffecteField } from '../../../../components/livreur/ApprentiAffecteField';
import { CARTE, SaisieQuantites, type Saisie } from '../../../../components/livreur/SaisieReception';
import {
  useAffecterApprenti,
  useAnnulerCommande,
  useCommande,
  usePasserLivree,
  useReceptionner,
} from '../../../../features/commandes/hooks';
import {
  construireReception,
  dateReceptionParam,
  estTitulaireCommande,
  peutAnnuler,
  peutChangerApprenti,
  peutPasserLivree,
  peutReceptionner,
  reliquat,
} from '../../../../features/commandes/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { jourLocal } from '../../../../features/encaissements/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateLong, formatFCFA } from '../../../../lib/format';
import type { CommandeResponse, ProduitCommandeResponse } from '../../../../types/api';

const SECTION =
  'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';

export default function CommandeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const q = useCommande(id);
  const mAnnuler = useAnnulerCommande();
  const mReceptionner = useReceptionner();
  const mPasserLivree = usePasserLivree();
  const mApprenti = useAffecterApprenti();
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
        <PageHeader title="Commande" fallback={fallback} />
        {q.isLoading ? (
          <Text className="text-slate-400 text-sm px-4 pt-4">Chargement…</Text>
        ) : (
          <EmptyState
            title="Commande introuvable"
            message={q.isError ? extractApiErrorMessage(q.error, '') || undefined : undefined}
          />
        )}
      </View>
    );
  }

  const titulaire = estTitulaireCommande(commande, user);
  const enCours =
    mAnnuler.isPending ||
    mReceptionner.isPending ||
    mPasserLivree.isPending ||
    mApprenti.isPending;
  const actif = isOnline && !enCours;
  const erreur = (titre: string, defaut: string) => (err: unknown) =>
    dialog.error(titre, extractApiErrorMessage(err, defaut));

  const onAnnuler = () => {
    dialog.confirm({
      title: 'Annuler cette commande ?',
      message: `${commande.reference} chez ${commande.fournisseur.libelle}. Une commande ne peut être annulée que tant que le fournisseur n'a pas répondu.`,
      confirmLabel: 'Oui, annuler',
      cancelLabel: 'Non, garder',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mAnnuler.mutate(commande.id, {
            onSuccess: () => {
              router.back();
              dialog.success('Commande annulée');
            },
            onError: erreur('Erreur', "Impossible d'annuler la commande"),
            onSettled: fin,
          }),
        ),
    });
  };

  const onChangerApprenti = (apprentiId: string | null) => {
    if (apprentiId === (commande.apprentiAffecte?.id ?? null)) return;
    lancerUneFois(verrou, (fin) =>
      mApprenti.mutate(
        { id: commande.id, apprentiId },
        {
          onSuccess: () =>
            dialog.success(apprentiId ? 'Apprenti affecté' : 'Apprenti retiré'),
          onError: erreur('Affectation refusée', "Impossible de changer l'apprenti affecté"),
          onSettled: fin,
        },
      ),
    );
  };

  const onValiderSaisie = () => {
    if (!saisie || saisie.type !== 'reception') return;
    const r = construireReception(
      commande.produitsCommandes,
      saisie.quantites,
      dateReceptionParam(saisie.date, jourLocal(new Date())),
    );
    if (!r.ok) {
      dialog.warning('Réception incomplète', r.erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      mReceptionner.mutate(
        { id: commande.id, payload: r.valeur },
        {
          onSuccess: () => {
            setSaisie(null);
            dialog.success('Réception enregistrée');
          },
          onError: erreur('Réception refusée', "Impossible d'enregistrer la réception"),
          onSettled: fin,
        },
      ),
    );
  };

  const onPasserLivree = () => {
    const reste = reliquat(commande);
    const lignes = reste.map((l) => `• ${l.produit.designation} × ${l.qteRestante}`).join('\n');
    dialog.confirm({
      title: `Passer la commande ${commande.reference} à Livrée ?`,
      message:
        'La commande sera close avec les quantités déjà reçues. Le reliquat sera abandonné.' +
        (reste.length > 0 ? `\n\nReliquat non reçu :\n${lignes}` : ''),
      confirmLabel: 'Oui, passer à Livrée',
      cancelLabel: 'Non, continuer la réception',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mPasserLivree.mutate(commande.id, {
            onSuccess: () => {
              setSaisie(null);
              dialog.success('Commande passée à Livrée');
            },
            onError: erreur('Passage refusé', 'Impossible de passer la commande à Livrée'),
            onSettled: fin,
          }),
        ),
    });
  };

  const ouvrirReception = () =>
    setSaisie({ type: 'reception', quantites: {}, date: jourLocal(new Date()) });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={commande.reference}
        subtitle={commande.fournisseur.libelle}
        fallback={fallback}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="px-4">
          <View className="flex-row items-center gap-2">
            <CommandeStatusBadge statut={commande.statut} />
            {commande.versementId ? <ReglementBadge /> : null}
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Passée le {formatDateLong(commande.date)}
            {commande.dateLivraison ? ` · livrée le ${formatDateLong(commande.dateLivraison)}` : ''}
          </Text>
          {commande.livreeManuellement && commande.livreePar ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Passée à Livrée par {commande.livreePar.nom}
              {commande.dateLivree ? ` le ${formatDateLong(commande.dateLivree)}` : ''}
            </Text>
          ) : null}

          {commande.motifRefus ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3">
              <Text className="text-red-700 dark:text-red-400 text-[12px]">
                Motif du refus : {commande.motifRefus}
              </Text>
            </View>
          ) : null}

          <ApprentiBloc
            commande={commande}
            modifiable={peutChangerApprenti(commande, titulaire)}
            onChange={onChangerApprenti}
            pending={mApprenti.isPending}
          />

          <Text className={SECTION}>Produits</Text>
          <View className={CARTE}>
            {commande.produitsCommandes.map((l, i) => (
              <LigneProduit key={l.id} ligne={l} first={i === 0} />
            ))}
          </View>

          {commande.montantLivre != null ? (
            <View className="flex-row justify-between mt-3 px-1">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">Total reçu</Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                {formatFCFA(commande.montantLivre)} FCFA
              </Text>
            </View>
          ) : null}

          {commande.remiseLivreurLivree != null ? (
            <View className="flex-row justify-between mt-1 px-1">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">Remise livreur</Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatFCFA(commande.remiseLivreurLivree)} F
              </Text>
            </View>
          ) : null}

          {/* Réceptionner / Passer à Livrée : titulaire et apprenti affecté */}
          {saisie?.type === 'reception' ? (
            <SaisieQuantites
              titre="Nouvelle réception"
              lignes={commande.produitsCommandes.filter((l) => l.qteRestante > 0)}
              borne={(l) => l.qteRestante}
              saisie={saisie}
              onChange={setSaisie}
              onValider={onValiderSaisie}
              onFermer={() => setSaisie(null)}
              pending={mReceptionner.isPending}
              actif={actif}
            />
          ) : (
            <>
              {peutReceptionner(commande) ? (
                <BoutonAction
                  label="Réceptionner"
                  couleur="bg-emerald-500"
                  onPress={ouvrirReception}
                  actif={actif && saisie === null}
                  isOnline={isOnline}
                />
              ) : null}
              {peutPasserLivree(commande) ? (
                <BoutonAction
                  label="Passer à Livrée"
                  couleur="bg-sky-600"
                  onPress={onPasserLivree}
                  actif={actif && saisie === null}
                  isOnline={isOnline}
                  pending={mPasserLivree.isPending}
                />
              ) : null}
            </>
          )}

          {titulaire && peutAnnuler(commande) ? (
            <BoutonAction
              label="Annuler la commande"
              couleur="bg-red-500"
              onPress={onAnnuler}
              actif={actif}
              isOnline={isOnline}
              pending={mAnnuler.isPending}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function ApprentiBloc({
  commande,
  modifiable,
  onChange,
  pending,
}: {
  commande: CommandeResponse;
  modifiable: boolean;
  onChange: (apprentiId: string | null) => void;
  pending: boolean;
}) {
  const a = commande.apprentiAffecte;
  return (
    <View className="mt-4">
      {modifiable ? (
        <ApprentiAffecteField
          fournisseurId={commande.fournisseur.id}
          value={a?.id ?? null}
          onChange={onChange}
          actuel={a}
          disabled={pending}
        />
      ) : (
        <Text className="text-[12px] text-slate-700 dark:text-slate-300">
          Apprenti affecté : <Text className="font-bold">{a ? a.nom : 'Aucun'}</Text>
        </Text>
      )}
      {pending ? <ActivityIndicator color="#10b981" style={{ marginTop: 8 }} /> : null}
      {commande.affectePar && commande.dateAffectation ? (
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          {a ? `${a.nom} — affecté` : 'Affectation retirée'} par {commande.affectePar.nom} le{' '}
          {formatDateLong(commande.dateAffectation)}
        </Text>
      ) : null}
    </View>
  );
}

function LigneProduit({ ligne: l, first }: { ligne: ProduitCommandeResponse; first: boolean }) {
  return (
    <View className={`px-4 py-3 ${first ? '' : 'border-t border-slate-100 dark:border-slate-800'}`}>
      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
        {l.produit.designation}
      </Text>
      <View className="flex-row justify-between mt-1">
        <Text className="text-[12px] text-slate-500 dark:text-slate-400">
          Commandé : {l.qteCommandee} · Reçu : {l.qteRecue} · Restant : {l.qteRestante}
        </Text>
        {l.qteRecue > 0 ? (
          <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
            {formatFCFA(l.montantRecu)} F
          </Text>
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

function BoutonAction({
  label,
  couleur,
  onPress,
  actif,
  isOnline,
  pending,
}: {
  label: string;
  couleur: string;
  onPress: () => void;
  actif: boolean;
  isOnline: boolean;
  pending?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      className={`rounded-md py-3.5 mt-4 items-center ${
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
