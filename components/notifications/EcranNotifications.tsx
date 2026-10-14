import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  BellOff,
  CalendarCheck,
  CheckCheck,
  FilePen,
  Handshake,
  Package,
  Truck,
  Users,
} from 'lucide-react-native';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState } from '../shared/EmptyState';
import {
  useFilNotifications,
  useMarquerLue,
  useNombreNonLues,
  useRelireAuFocus,
  useToutMarquerLu,
} from '../../features/notifications/hooks';
import {
  aplatirPages,
  apparenceNotification,
  cibleMobile,
  grouperNotifications,
  heureRelative,
  segmentsTexte,
  type DomaineNotification,
} from '../../features/notifications/regles';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { estResponsable } from '../../features/organisation/regles';
import { useAuthStore } from '../../stores/authStore';
import { ouvrir } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import { extractApiErrorMessage } from '../../lib/api-error';
import type { NotificationResponse } from '../../types/api';

const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400';

type Ligne = { cle: string; groupe: string } | { cle: string; notification: NotificationResponse };

/**
 * N8 : écran Notifications façon Facebook, commun au livreur (cloche de
 * l'Accueil) et au responsable (son onglet). En haut, « À traiter » : les
 * actions rapides fournies par l'écran. Puis le fil, du plus récent au plus
 * ancien, en groupes « Nouveau » (non lues), « Aujourd'hui », « Plus tôt » ;
 * un appui marque la notification lue et ouvre son écran. « Tout marquer
 * comme lu », chargement de la suite au défilement, tirer pour rafraîchir,
 * relecture toutes les 30 s et au retour sur l'écran. État vide et état
 * d'erreur distincts.
 */
export function EcranNotifications({
  aTraiter,
  aTraiterVisible = true,
  aTraiterEnChargement = false,
  onRafraichir,
  showBack = true,
  pied,
}: {
  /** Section « À traiter » (actions rapides de l'écran) : ses rubriques non vides seulement. */
  aTraiter: ReactNode;
  /** S1 : au moins une rubrique à afficher (élément ou erreur). Sinon le titre « À traiter » est masqué. */
  aTraiterVisible?: boolean;
  /** Une rubrique est encore en lecture : évite d'afficher « Aucune notification » trop tôt. */
  aTraiterEnChargement?: boolean;
  /** Relecture des actions rapides (tirer pour rafraîchir, retour sur l'écran). */
  onRafraichir: () => void;
  showBack?: boolean;
  /** Dialogues des actions rapides, rendus hors de la liste. */
  pied?: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const fil = useFilNotifications(!!user);
  const compte = useNombreNonLues(!!user);
  const marquerLue = useMarquerLue();
  const toutLu = useToutMarquerLu();
  const verrou = useRef(creerVerrou()).current;

  // Le spinner ne suit que le geste de l'utilisateur, pas la relecture de fond (30 s).
  const [actualisation, setActualisation] = useState(false);
  const relire = () => {
    const lectures = [fil.refetch(), compte.refetch()];
    onRafraichir();
    return lectures;
  };
  useRelireAuFocus(relire);

  const tirerPourActualiser = () => {
    setActualisation(true);
    Promise.allSettled(relire()).then(() => setActualisation(false));
  };

  const elements = useMemo(() => aplatirPages(fil.data?.pages), [fil.data]);
  const maintenant = new Date();
  const lignes: Ligne[] = useMemo(
    () =>
      grouperNotifications(elements, new Date()).flatMap((g) => [
        { cle: `groupe-${g.titre}`, groupe: g.titre },
        ...g.elements.map((n) => ({ cle: n.id, notification: n })),
      ]),
    [elements],
  );
  const aucuneNonLue = elements.every((n) => n.lue) && (compte.data ?? 0) === 0;

  if (!user) return null;

  const ctx = { apprenti: !!user.parentId, responsable: estResponsable(user) };

  const onAppui = (n: NotificationResponse) => {
    if (!n.lue) marquerLue.mutate(n.id);
    const cible = cibleMobile(n, ctx);
    if (cible) ouvrir(cible.href, cible.params);
  };

  const onToutLu = () =>
    lancerUneFois(verrou, (fin) =>
      toutLu.mutate(undefined, {
        onSettled: fin,
        onError: (e: unknown) =>
          dialog.error('Action impossible', extractApiErrorMessage(e, 'Les notifications n’ont pas pu être marquées comme lues.')),
      }),
    );

  // S1 : « À traiter » seulement s'il a une rubrique ; « Fil d'activité » et
  // « Tout marquer comme lu » seulement si le fil a des notifications.
  const enTete = (
    <View className="px-4 pt-3">
      {aTraiterVisible ? (
        <View className="gap-3">
          <Text className={SECTION}>À traiter</Text>
          <View className="gap-6">{aTraiter}</View>
        </View>
      ) : null}
      {elements.length > 0 ? (
      <View className={`flex-row items-center mb-1 ${aTraiterVisible ? 'mt-5' : ''}`}>
        <Text className="flex-1 font-extrabold text-base text-slate-900 dark:text-white">Fil d’activité</Text>
          <Pressable
            onPress={onToutLu}
            disabled={aucuneNonLue || toutLu.isPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: aucuneNonLue || toutLu.isPending }}
            hitSlop={6}
            className={`flex-row items-center gap-1 ${aucuneNonLue ? 'opacity-40' : 'active:opacity-70'}`}
          >
            <CheckCheck color="#2563eb" size={14} />
            <Text className="text-[12px] font-bold text-blue-700 dark:text-blue-400">Tout marquer comme lu</Text>
          </Pressable>
      </View>
      ) : null}
    </View>
  );

  // Fil vide : un seul indicateur tant que quelque chose se lit (pas de bloc
  // vide qui clignote), l'erreur du fil si sa lecture a échoué, rien si
  // « À traiter » a des rubriques, sinon un seul message sobre.
  const vide = fil.isLoading || (aTraiterEnChargement && !aTraiterVisible) ? (
    <ActivityIndicator color="#10b981" style={{ marginTop: 16 }} />
  ) : fil.isError ? (
    <View className="px-4">
      <EmptyState title="Notifications indisponibles" message="Le fil n’a pas pu être lu. Tire pour réessayer." />
      <Pressable onPress={() => fil.refetch()} accessibilityRole="button" className="self-center active:opacity-70">
        <Text className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">Réessayer</Text>
      </Pressable>
    </View>
  ) : aTraiterVisible ? null : (
    <View className="items-center px-6 pt-8">
      <View className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
        <BellOff color="#94a3b8" size={28} />
      </View>
      <EmptyState title="Aucune notification" />
    </View>
  );

  const pieds = fil.isFetchingNextPage ? (
    <ActivityIndicator color="#10b981" style={{ marginVertical: 16 }} />
  ) : fil.isFetchNextPageError ? (
    <Pressable onPress={() => fil.fetchNextPage()} accessibilityRole="button" className="items-center py-4 active:opacity-70">
      <Text className="text-[12px] text-red-600 dark:text-red-400">La suite n’a pas pu être chargée.</Text>
      <Text className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">Réessayer</Text>
    </Pressable>
  ) : null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Notifications" showBack={showBack} />
      <FlatList
        data={lignes}
        keyExtractor={(l) => l.cle}
        ListHeaderComponent={enTete}
        ListEmptyComponent={vide}
        ListFooterComponent={pieds}
        contentContainerStyle={{ paddingBottom: 32 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (fil.hasNextPage && !fil.isFetchingNextPage && !fil.isFetchNextPageError) fil.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl refreshing={actualisation} onRefresh={tirerPourActualiser} tintColor="#10b981" />
        }
        renderItem={({ item }) =>
          'groupe' in item ? (
            <Text className={`${SECTION} px-4 mt-4 mb-1`}>{item.groupe}</Text>
          ) : (
            <ElementNotification notification={item.notification} maintenant={maintenant} onPress={onAppui} />
          )
        }
      />
      {pied}
    </View>
  );
}

const ICONES: Record<DomaineNotification, typeof Bell> = {
  transfert: ArrowLeftRight,
  remise: Banknote,
  versement: FilePen,
  commande: Package,
  chargement: Truck,
  clients: Users,
  cloture: CalendarCheck,
  relation: Handshake,
  autre: Bell,
};

/** Une notification : icône ronde colorée, phrase (noms en gras), heure relative, pastille si non lue. */
export function ElementNotification({
  notification: n,
  maintenant,
  onPress,
}: {
  notification: NotificationResponse;
  maintenant: Date;
  onPress: (n: NotificationResponse) => void;
}) {
  const { domaine, couleur } = apparenceNotification(n);
  const Icone = n.type === 'COMMANDE_LIVREE' ? Truck : ICONES[domaine];
  const heure = heureRelative(n.creeLe, maintenant);
  return (
    <Pressable
      onPress={() => onPress(n)}
      accessibilityRole="button"
      accessibilityLabel={`${n.titre}. ${n.texte} ${heure}${n.lue ? '' : ', non lue'}`}
      testID={`notification-${n.id}`}
      className={`flex-row items-start gap-3 px-4 py-3 active:opacity-70 ${
        n.lue ? '' : 'bg-blue-50 dark:bg-blue-500/10'
      }`}
    >
      <View
        className="w-11 h-11 rounded-full items-center justify-center"
        style={{ backgroundColor: couleur }}
      >
        <Icone color="#ffffff" size={20} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] leading-5 text-slate-800 dark:text-slate-200">
          {segmentsTexte(n.texte, [n.auteur?.nom]).map((s, i) =>
            s.gras ? (
              <Text key={i} className="font-bold text-slate-900 dark:text-white">
                {s.texte}
              </Text>
            ) : (
              s.texte
            ),
          )}
        </Text>
        <Text
          className={`text-[12px] mt-0.5 ${
            n.lue ? 'text-slate-500 dark:text-slate-400' : 'font-bold text-blue-700 dark:text-blue-400'
          }`}
        >
          {heure}
        </Text>
      </View>
      {!n.lue ? (
        <View testID={`non-lue-${n.id}`} className="w-3 h-3 rounded-full bg-blue-600 mt-4" />
      ) : null}
    </Pressable>
  );
}
