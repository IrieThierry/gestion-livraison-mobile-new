import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { dialog } from '../../../../lib/dialog';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { BoutonItineraire } from '../../../../components/shared/BoutonItineraire';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  CommandeStatusBadge,
  ReglementBadge,
} from '../../../../components/livreur/CommandeStatusBadge';
import { MontantCommande } from '../../../../components/livreur/MontantCommande';
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
import {
  useConfirmerRemiseCommis,
  useRefuserRemiseCommis,
  useRemisesCommisDeCommande,
} from '../../../../features/commandes/remises';
import { lireMotifRefus, remisesEnAttente } from '../../../../features/commandes/remises-regles';
import { dateHeure, libelleStatutRemise, nomPersonne } from '../../../../features/commis/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { jourLocal } from '../../../../features/encaissements/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateLong, formatFCFA } from '../../../../lib/format';
import type {
  CommandeResponse,
  ProduitCommandeResponse,
  RemiseCommisResponse,
} from '../../../../types/api';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import { retourParent } from '../../../../lib/navigation-app';

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
  // Remises du commis : lues quand le fournisseur a un commis ou qu'une remise attend encore.
  const avecRemises =
    !!q.data && (q.data.gereeParCommis === true || (q.data.remisesEnAttente ?? 0) > 0);
  const qRemises = useRemisesCommisDeCommande(id, avecRemises);
  const mConfirmer = useConfirmerRemiseCommis();
  const mRefuser = useRefuserRemiseCommis();
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  // Refus en cours de saisie : la remise visée, son motif et l'erreur affichée.
  const [refus, setRefus] = useState<{ id: string; motif: string; erreur: string | null } | null>(
    null,
  );
  // Verrou synchrone : un double tap part avant le rendu qui affiche isPending.
  const verrou = useRef(creerVerrou()).current;

  const commande = q.data;

  if (!commande) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Commande" />
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
    mApprenti.isPending ||
    mConfirmer.isPending ||
    mRefuser.isPending;
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
              retourParent();
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

  // Titulaire ou apprenti affecté : une remise confirmée devient une réception (définitive).
  const onConfirmerRemise = (r: RemiseCommisResponse) => {
    const lignes = r.lignes.map((l) => `• ${l.quantite} × ${l.designation}`).join('\n');
    dialog.confirm({
      title: 'Confirmer cette remise ?',
      message:
        `Remise de ${nomPersonne(r.commis)} du ${dateHeure(r.creeLe)} :\n${lignes}\n\n` +
        'Elle devient une réception de la commande. Une remise confirmée est définitive : refuse-la si elle est fausse.',
      confirmLabel: 'Oui, confirmer',
      cancelLabel: 'Non',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mConfirmer.mutate(r.id, {
            onSuccess: () => dialog.success('Remise confirmée'),
            onError: erreur('Confirmation refusée', 'Impossible de confirmer la remise'),
            onSettled: fin,
          }),
        ),
    });
  };

  const onEnvoyerRefus = () => {
    if (!refus) return;
    const lu = lireMotifRefus(refus.motif);
    if (!lu.ok) {
      setRefus({ ...refus, erreur: lu.erreur });
      return;
    }
    lancerUneFois(verrou, (fin) =>
      mRefuser.mutate(
        { id: refus.id, motif: lu.motif },
        {
          onSuccess: () => {
            setRefus(null);
            dialog.success('Remise refusée');
          },
          onError: erreur('Refus impossible', 'Impossible de refuser la remise'),
          onSettled: fin,
        },
      ),
    );
  };

  const remises = qRemises.data ?? [];
  const enAttente = remisesEnAttente(remises);
  const traitees = remises.filter((r) => r.statut !== 'EN_ATTENTE');
  const commandeOuverte = commande.statut === 'CONFIRMEE' || commande.statut === 'EN_RECEPTION';

  const ouvrirReception = () =>
    setSaisie({ type: 'reception', quantites: {}, date: jourLocal(new Date()) });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={commande.reference}
        subtitle={commande.fournisseur.libelle}
      />

      <FormScreen>
        <View className="px-4">
          <View className="flex-row items-center gap-2">
            <CommandeStatusBadge statut={commande.statut} />
            {commande.versementId ? <ReglementBadge /> : null}
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Passée le {formatDateLong(commande.date)}
            {commande.dateLivraison ? ` · livrée le ${formatDateLong(commande.dateLivraison)}` : ''}
          </Text>
          {commande.depot ? (
            <View className="mt-3 gap-1.5">
              <Text className="text-[11px] text-slate-600 dark:text-slate-300">
                {`Dépôt : ${commande.depot.nom}${commande.depot.adresse ? ` · ${commande.depot.adresse}` : ''}`}
              </Text>
              <BoutonItineraire position={commande.depot.position} />
            </View>
          ) : null}
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

          <MontantCommande commande={commande} variante="detail" />

          {commande.remiseLivreurLivree != null ? (
            <View className="flex-row justify-between mt-1 px-1">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">Remise livreur</Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatFCFA(commande.remiseLivreurLivree)} F
              </Text>
            </View>
          ) : null}

          {/* Remises du commis : confirmer ou refuser (titulaire et apprenti affecté) */}
          {enAttente.length > 0 ? (
            <>
              <Text className={SECTION}>Remises à confirmer</Text>
              <View className="gap-2">
                {enAttente.map((r) => (
                  <CarteRemiseAConfirmer
                    key={r.id}
                    remise={r}
                    actif={actif}
                    onConfirmer={() => onConfirmerRemise(r)}
                    refus={refus?.id === r.id ? refus : null}
                    onRefuser={() => setRefus({ id: r.id, motif: '', erreur: null })}
                    onMotif={(motif) => setRefus({ id: r.id, motif, erreur: null })}
                    onEnvoyerRefus={onEnvoyerRefus}
                    onFermerRefus={() => setRefus(null)}
                    pendingRefus={mRefuser.isPending}
                  />
                ))}
              </View>
            </>
          ) : null}
          {traitees.length > 0 ? (
            <>
              <Text className={SECTION}>Remises du commis</Text>
              <View className="gap-2">
                {traitees.map((r) => (
                  <CarteRemiseTraitee key={r.id} remise={r} />
                ))}
              </View>
            </>
          ) : null}
          {commande.gereeParCommis && commandeOuverte ? (
            <View className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-md p-3 mt-4">
              <Text className="text-sky-800 dark:text-sky-300 text-[12px]">
                Les remises sont faites par le commis du fournisseur
              </Text>
            </View>
          ) : null}

          {/* Réceptionner / Passer à Livrée : titulaire et apprenti affecté, fournisseur sans commis */}
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
                  couleur="bg-emerald-700"
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
      </FormScreen>
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
      {pending ? <ActivityIndicator color="#047857" style={{ marginTop: 8 }} /> : null}
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
      <View className="flex-row items-center">
        <View className="mr-2">
          <ProduitVignette designation={l.produit.designation} photoUrl={l.produit.photoUrl} size={28} />
        </View>
        <Text className="flex-1 font-extrabold text-slate-900 dark:text-white text-[13px]">
          {l.produit.designation}
        </Text>
      </View>
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

function LignesRemise({ remise }: { remise: RemiseCommisResponse }) {
  return (
    <>
      {remise.lignes.map((l) => (
        <View key={l.produitFournisseurId} className="flex-row items-center mt-1.5">
          <View className="mr-2">
            <ProduitVignette designation={l.designation} photoUrl={l.photoUrl} size={28} />
          </View>
          <Text
            className={`flex-1 text-[13px] ${
              remise.statut === 'ANNULEE'
                ? 'text-slate-400 line-through'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            {`${l.quantite} × ${l.designation}`}
          </Text>
        </View>
      ))}
    </>
  );
}

/** Remise en attente : commis, date et heure, produits ; Confirmer, ou Refuser avec un motif. */
function CarteRemiseAConfirmer({
  remise,
  actif,
  onConfirmer,
  refus,
  onRefuser,
  onMotif,
  onEnvoyerRefus,
  onFermerRefus,
  pendingRefus,
}: {
  remise: RemiseCommisResponse;
  actif: boolean;
  onConfirmer: () => void;
  refus: { motif: string; erreur: string | null } | null;
  onRefuser: () => void;
  onMotif: (motif: string) => void;
  onEnvoyerRefus: () => void;
  onFermerRefus: () => void;
  pendingRefus: boolean;
}) {
  const commis = nomPersonne(remise.commis);
  return (
    <View className={`${CARTE} p-3`}>
      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
        {`Remise de ${commis} · ${dateHeure(remise.creeLe)}`}
      </Text>
      <LignesRemise remise={remise} />
      {refus ? (
        <View className="mt-3">
          <TextInput
            value={refus.motif}
            onChangeText={onMotif}
            placeholder="Motif du refus"
            placeholderTextColor="#94a3b8"
            multiline
            className="border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-[13px] text-slate-900 dark:text-white bg-white dark:bg-slate-900"
          />
          {refus.erreur ? (
            <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{refus.erreur}</Text>
          ) : null}
          <View className="flex-row gap-2 mt-2">
            <Pressable
              onPress={onFermerRefus}
              accessibilityRole="button"
              className="flex-1 rounded-md py-2.5 items-center border border-slate-300 dark:border-slate-700 active:opacity-70"
            >
              <Text className="font-bold text-slate-600 dark:text-slate-300 text-[13px]">Fermer</Text>
            </Pressable>
            <Pressable
              onPress={onEnvoyerRefus}
              disabled={!actif}
              accessibilityRole="button"
              className={`flex-1 rounded-md py-2.5 items-center ${
                actif ? 'bg-red-600 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              {pendingRefus ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-bold text-[13px] ${actif ? 'text-white' : 'text-slate-400'}`}>
                  Envoyer le refus
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2 mt-3">
          <Pressable
            onPress={onRefuser}
            disabled={!actif}
            accessibilityRole="button"
            accessibilityLabel={`Refuser la remise de ${commis}`}
            className="flex-1 rounded-md py-2.5 items-center border border-red-300 dark:border-red-500/40 active:opacity-70"
          >
            <Text className={`font-bold text-[13px] ${actif ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
              Refuser
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirmer}
            disabled={!actif}
            accessibilityRole="button"
            accessibilityLabel={`Confirmer la remise de ${commis}`}
            className={`flex-1 rounded-md py-2.5 items-center ${
              actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          >
            <Text className={`font-bold text-[13px] ${actif ? 'text-white' : 'text-slate-400'}`}>
              Confirmer
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Remise déjà traitée (confirmée, refusée, annulée) : lecture seule, motif d'un refus. */
function CarteRemiseTraitee({ remise }: { remise: RemiseCommisResponse }) {
  return (
    <View className={`${CARTE} p-3`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-bold text-slate-900 dark:text-white text-[12px]">
          {`Remise de ${nomPersonne(remise.commis)} · ${dateHeure(remise.creeLe)}`}
        </Text>
        <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {libelleStatutRemise(remise.statut)}
        </Text>
      </View>
      <LignesRemise remise={remise} />
      {remise.statut === 'REFUSEE' && remise.motif ? (
        <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{`Motif : ${remise.motif}`}</Text>
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
