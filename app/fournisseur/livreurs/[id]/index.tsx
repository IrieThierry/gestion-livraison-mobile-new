import { useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ban, ChevronRight, ClipboardList, HandCoins, Percent, Tags, Unlock } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { BoutonAction } from '../../../../components/fournisseur/CommandeFournisseur';
import {
  useBloquerLivreur,
  useDebloquerLivreur,
  useEnregistrerRemiseLivreur,
  useLivreursPartenaires,
  useSupprimerRemiseLivreur,
} from '../../../../features/fournisseur/hooks';
import { libelleDu, lireRemiseLivreur, nomLivreur } from '../../../../features/fournisseur/gestion';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateLong, formatFCFA, formatMontant } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';
import type { LivreurPartenaireDuResponse } from '../../../../types/api';

const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';
const CHAMP =
  'px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white';

type Panneau = 'remise' | 'bloquer' | null;

/**
 * F2 : fiche d'un livreur partenaire : dû, remise, versements ; commandes,
 * remise par unité, prix particuliers (remise et prix fermés pour un bloqué,
 * comme le web), blocage ou déblocage, versement reçu.
 */
export default function FicheLivreurPartenaire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useLivreursPartenaires();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const mRemise = useEnregistrerRemiseLivreur();
  const mSupprimerRemise = useSupprimerRemiseLivreur();
  const mBloquer = useBloquerLivreur();
  const mDebloquer = useDebloquerLivreur();
  const verrou = useRef(creerVerrou()).current;
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const p = q.data?.find((x) => x.livreur.id === id);

  if (!p) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Livreur" />
        {q.isLoading ? (
          <Text className="text-slate-400 text-sm px-4 pt-4">Chargement…</Text>
        ) : q.isError ? (
          <EmptyState
            title="Livreur indisponible"
            message={extractApiErrorMessage(q.error, 'Livreurs partenaires indisponibles')}
          />
        ) : (
          <EmptyState title="Livreur introuvable" message="Il ne fait plus partie de tes livreurs partenaires." />
        )}
      </View>
    );
  }

  const nom = nomLivreur(p.livreur);
  const enCours = mRemise.isPending || mSupprimerRemise.isPending || mBloquer.isPending || mDebloquer.isPending;
  const actif = isOnline && !enCours;
  const du = libelleDu(p.du);
  const erreurDe = (defaut: string) => (e: unknown) => dialog.error('Erreur', extractApiErrorMessage(e, defaut));

  const ouvrirPanneau = (x: Panneau) => {
    setErreur(null);
    setSaisie(x === 'remise' ? String(p.remiseUnitaire ?? 0) : '');
    setPanneau(x);
  };

  const onEnregistrerRemise = () => {
    const lecture = lireRemiseLivreur(saisie);
    if (!lecture.ok) {
      setErreur(lecture.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      mRemise.mutate(
        { livreurId: p.livreur.id, remiseLivreur: lecture.valeur },
        {
          onSuccess: () => {
            setPanneau(null);
            dialog.success('Remise livreur enregistrée');
          },
          onError: erreurDe("Impossible d'enregistrer cette remise livreur"),
          onSettled: fin,
        },
      ),
    );
  };

  const onSupprimerRemise = () =>
    lancerUneFois(verrou, (fin) =>
      mSupprimerRemise.mutate(p.livreur.id, {
        onSuccess: () => {
          setPanneau(null);
          dialog.success('Remise livreur supprimée');
        },
        onError: erreurDe('Impossible de supprimer cette remise livreur'),
        onSettled: fin,
      }),
    );

  const onBloquer = () =>
    lancerUneFois(verrou, (fin) =>
      mBloquer.mutate(
        { livreurId: p.livreur.id, motif: saisie.trim() || undefined },
        {
          onSuccess: () => {
            setPanneau(null);
            dialog.success('Livreur bloqué');
          },
          onError: erreurDe('Impossible de bloquer ce livreur'),
          onSettled: fin,
        },
      ),
    );

  const onDebloquer = () =>
    dialog.confirm({
      title: `Débloquer ${nom} ?`,
      message: 'Ce livreur pourra à nouveau passer des commandes auprès de ta boutique.',
      confirmLabel: 'Débloquer',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mDebloquer.mutate(p.livreur.id, {
            onSuccess: () => dialog.success('Livreur débloqué'),
            onError: erreurDe('Impossible de débloquer ce livreur'),
            onSettled: fin,
          }),
        ),
    });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={nom} subtitle={p.livreur.contact ?? undefined} />
      <FormScreen
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
      >
        <View className="px-4 gap-3">
          {p.bloque ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3">
              <Text className="text-red-700 dark:text-red-400 text-[12px] font-bold">
                Bloqué : il ne peut plus te passer commande.
              </Text>
            </View>
          ) : null}

          <Chiffres partenaire={p} du={du} />

          {panneau === 'remise' ? (
            <PanneauSaisie
              titre={`Remise de ${nom}`}
              aide={`Montant par unité que tu rends à ce livreur, pour tous tes produits. Il est figé sur chaque commande à la saisie de la livraison. Remise actuelle : ${formatMontant(p.remiseUnitaire)} F.`}
              onFermer={() => setPanneau(null)}
            >
              <Text className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Remise livreur (FCFA / unité)
              </Text>
              <TextInput
                value={saisie}
                onChangeText={(t) => {
                  setSaisie(t);
                  if (erreur) setErreur(null);
                }}
                keyboardType="decimal-pad"
                accessibilityLabel="Remise livreur"
                className={`${CHAMP} text-right font-bold`}
              />
              {erreur ? <Text className="text-red-600 dark:text-red-400 text-[12px] mt-1">{erreur}</Text> : null}
              <BoutonAction
                label="Enregistrer"
                couleur="bg-emerald-700"
                onPress={onEnregistrerRemise}
                actif={actif}
                isOnline={isOnline}
                pending={mRemise.isPending}
              />
              {p.remiseUnitaire !== 0 ? (
                <Pressable
                  onPress={onSupprimerRemise}
                  disabled={!actif}
                  accessibilityRole="button"
                  className="mt-3 items-center py-2 active:opacity-70"
                >
                  <Text className={`font-bold text-[13px] ${actif ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                    Supprimer la remise
                  </Text>
                </Pressable>
              ) : null}
            </PanneauSaisie>
          ) : null}

          {panneau === 'bloquer' ? (
            <PanneauSaisie
              titre={`Bloquer ${nom} ?`}
              aide="Ce livreur ne pourra plus passer de commande auprès de ta boutique. Tu pourras le débloquer à tout moment."
              onFermer={() => setPanneau(null)}
            >
              <Text className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Motif (facultatif)</Text>
              <TextInput
                value={saisie}
                onChangeText={setSaisie}
                multiline
                accessibilityLabel="Motif du blocage"
                placeholder="ex. impayés répétés"
                placeholderTextColor="#94a3b8"
                className={`${CHAMP} min-h-[70px]`}
              />
              <BoutonAction
                label="Bloquer"
                couleur="bg-red-600"
                onPress={onBloquer}
                actif={actif}
                isOnline={isOnline}
                pending={mBloquer.isPending}
              />
            </PanneauSaisie>
          ) : null}
          <View className={CARTE}>
            <Action
              Icone={ClipboardList}
              label="Commandes"
              detail="Toutes ses commandes chez toi"
              onPress={() => naviguer(`/fournisseur/livreurs/${p.livreur.id}/commandes`)}
            />
            <Action
              Icone={Percent}
              label="Remise"
              detail={`Actuelle : ${formatMontant(p.remiseUnitaire)} F par unité`}
              onPress={() => ouvrirPanneau('remise')}
              desactive={p.bloque}
            />
            <Action
              Icone={Tags}
              label="Prix particuliers"
              detail="Un prix à lui, produit par produit"
              onPress={() => naviguer(`/fournisseur/livreurs/${p.livreur.id}/prix`)}
              desactive={p.bloque}
            />
            <Action
              Icone={HandCoins}
              label="Enregistrer un versement"
              detail="Argent reçu de ce livreur"
              onPress={() => naviguer(`/fournisseur/livreurs/${p.livreur.id}/versement`)}
            />
            {p.bloque ? (
              <Action Icone={Unlock} label="Débloquer" detail="Il pourra de nouveau commander" onPress={onDebloquer} />
            ) : (
              <Action
                Icone={Ban}
                label="Bloquer"
                detail="Il ne pourra plus te passer commande"
                onPress={() => ouvrirPanneau('bloquer')}
                danger
              />
            )}
          </View>

        </View>
      </FormScreen>
    </View>
  );
}

function Chiffres({
  partenaire: p,
  du,
}: {
  partenaire: LivreurPartenaireDuResponse;
  du: ReturnType<typeof libelleDu>;
}) {
  const ligne = (label: string, valeur: string, accent?: string) => (
    <View className="flex-row justify-between py-1" accessibilityLabel={`${label} : ${valeur}`}>
      <Text className="text-[12px] text-slate-500 dark:text-slate-400">{label}</Text>
      <Text className={`text-[12px] font-bold ${accent ?? 'text-slate-700 dark:text-slate-300'}`}>{valeur}</Text>
    </View>
  );
  return (
    <View className={`${CARTE} p-4`}>
      <View className="flex-row justify-between items-end">
        <Text className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
          {du.libelle === 'Avance' ? 'Avance (versé en trop)' : 'Ce qu’il te doit'}
        </Text>
        <Text
          className={`text-xl font-extrabold ${
            du.libelle === 'Avance' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {formatFCFA(du.montant)} F
        </Text>
      </View>
      <View className="border-t border-slate-100 dark:border-slate-800 mt-3 pt-2">
        {ligne('Total reçu (prix et remise)', `${formatFCFA(p.totalRecu)} F`)}
        {ligne('Total versé', `${formatFCFA(p.totalVerse)} F`)}
        {ligne('Remise / unité', p.remiseUnitaire ? `${formatMontant(p.remiseUnitaire)} F` : '—')}
        {ligne('Remise à reverser', `${formatFCFA(p.remiseAReverser)} F`, 'text-amber-700 dark:text-amber-400')}
        {ligne('Dernier versement', p.dernierVersement ? formatDateLong(p.dernierVersement) : '—')}
      </View>
    </View>
  );
}

function Action({
  Icone,
  label,
  detail,
  onPress,
  desactive,
  danger,
}: {
  Icone: typeof Ban;
  label: string;
  detail: string;
  onPress: () => void;
  desactive?: boolean;
  danger?: boolean;
}) {
  const couleur = desactive ? '#94a3b8' : danger ? '#dc2626' : '#047857';
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!desactive }}
      className="px-4 py-3 flex-row items-center gap-3 border-b border-slate-100 dark:border-slate-800 active:opacity-70"
    >
      <Icone color={couleur} size={18} />
      <View className="flex-1">
        <Text
          className={`font-bold text-[13px] ${
            desactive ? 'text-slate-400' : danger ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {label}
        </Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
          {desactive ? 'Indisponible pour un livreur bloqué' : detail}
        </Text>
      </View>
      <ChevronRight color="#94a3b8" size={16} />
    </Pressable>
  );
}

function PanneauSaisie({
  titre,
  aide,
  onFermer,
  children,
}: {
  titre: string;
  aide: string;
  onFermer: () => void;
  children: ReactNode;
}) {
  return (
    <View className={`${CARTE} p-4`}>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-extrabold text-slate-900 dark:text-white text-[14px]">{titre}</Text>
        <Pressable onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={8}>
          <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12px]">Annuler</Text>
        </Pressable>
      </View>
      <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 mb-3">{aide}</Text>
      {children}
    </View>
  );
}
