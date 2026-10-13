import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { Bell, Package, Truck, Banknote, RotateCcw } from 'lucide-react-native';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../features/encaissements/hooks';
import { useEncoursByLivreur } from '../../features/clients/hooks';
import {
  encaisseAujourdhui,
  num,
  totalAEncaisser,
} from '../../features/encaissements/regles';
import { useMouvementsStock, useStockCourant } from '../../features/stock/hooks';
import {
  chiffreAccueil,
  jourLocal,
  nbProduitsRecus,
  nbProduitsVendus,
} from '../../features/accueil/regles';
import { useCommandesAReceptionner } from '../../features/commandes/hooks';
import { usePrevisionsEchues } from '../../features/previsions/hooks';
import { useRemisesAConfirmer } from '../../features/remises-argent/hooks';
import { nbRemisesAConfirmer } from '../../features/remises-argent/regles';
import { useTransfertsADecider } from '../../features/transferts/hooks';
import { nbTransfertsADecider } from '../../features/transferts/regles';
import { useAuthStore } from '../../stores/authStore';
import { EmptyState } from '../../components/shared/EmptyState';
import { Avatar } from '../../components/shared/Avatar';
import { AbonnementExpireBanner } from '../../components/shared/AbonnementExpireBanner';
import { useMonAbonnement } from '../../features/abonnement/hooks';
import { LivraisonCard } from '../../components/livreur/LivraisonCard';
import { formatMontant } from '../../lib/format';
import { extractApiErrorMessage } from '../../lib/api-error';
// Accueil : chaque tuile / action ouvre sa rubrique sur une pile propre
// (lib/navigation) ; retour depuis la liste ouverte = Accueil.
import { ouvrir } from '../../lib/navigation-app';
import { estMembreOrganisation, estResponsable } from '../../features/organisation/regles';
import { TableauDeBordResponsable } from '../../components/responsable/TableauDeBordResponsable';

/**
 * Accueil : tableau de bord pour le responsable d'une organisation (son
 * espace en lecture, O15 : aucune requête de vente lancée), Tournée sinon.
 */
export default function Accueil() {
  const responsable = estResponsable(useAuthStore((s) => s.user));
  return responsable ? <TableauDeBordResponsable /> : <Tournee />;
}

function Tournee() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qLiv = useLivraisonsByLivreur(livreurId);
  const qEnc = useEncaissementsByLivreur(livreurId);
  const qEncours = useEncoursByLivreur(livreurId);
  // Stock courant (Plan D) — somme des `qteVendable` (= achats − livraisons
  // + retours sur la période). C'est ce que l'écran Stock affiche aussi.
  const qStock = useStockCourant();
  // Organisation : pas de commandes fournisseur (routes fermées), le stock arrive par transferts.
  const organisation = estMembreOrganisation(user);
  const qARecep = useCommandesAReceptionner(!!user && !organisation);
  // Prévisions échues du livreur connecté (pas celles des apprentis), hors « Plus tard ».
  const qEchues = usePrevisionsEchues(user?.id);
  // Abonnement effectif : bandeau en EXPIRE (relu au tirer-pour-rafraîchir).
  const qAbo = useMonAbonnement();
  // Principal : remises déclarées par ses apprentis, à confirmer (désactivé pour un apprenti).
  const qRemises = useRemisesAConfirmer();
  // Transferts à recevoir : en attente, dont le livreur connecté est le décideur (principal comme apprenti).
  const qTransferts = useTransfertsADecider();
  // Mouvements de stock du jour (local) du livreur connecté — l'apprenti voit
  // les siens : quantités vendues (livraisons) et réceptionnées du jour.
  const jour = jourLocal();
  const filtresMouvements = useMemo(() => ({ debut: jour, fin: jour }), [jour]);
  const qMv = useMouvementsStock(livreurId, filtresMouvements);
  // Nombre de produits différents (pas de quantités) ; le détail reste sur les pages ouvertes.
  const vendus = useMemo(() => nbProduitsVendus(qMv.data ?? [], jour), [qMv.data, jour]);
  const recus = useMemo(() => nbProduitsRecus(qMv.data ?? [], jour), [qMv.data, jour]);

  const computed = useMemo(() => {
    const today = new Date().toDateString();
    const all = qLiv.data ?? [];
    const duJour = all.filter((l) => new Date(l.date).toDateString() === today);

    // « Encaissé aujourd'hui » = Σ montantEncaisse des encaissements du jour
    // (et non plus le montant livré des livraisons soldées).
    const encs = qEnc.data ?? [];
    const totalEncaisseAujourd = encaisseAujourdhui(encs);
    const totalEncaisseHier = encaisseAujourdhui(encs, new Date(Date.now() - 86_400_000));
    // « À encaisser » = Σ des soldes positifs des clients (serveur).
    const encours = qEncours.data ?? [];
    const aEncaisser = totalAEncaisser(encours);
    const clientsAEncaisser = encours.filter((e) => num(e.solde) > 0).length;

    let varPct: number | null = null;
    if (totalEncaisseHier > 0) {
      varPct = Math.round(((totalEncaisseAujourd - totalEncaisseHier) / totalEncaisseHier) * 100);
    }

    return {
      duJour,
      totalEncaisseAujourd,
      aEncaisser,
      clientsAEncaisser,
      varPct,
    };
  }, [qLiv.data, qEnc.data, qEncours.data]);

  const totalStock = useMemo(
    () => (qStock.data ?? []).reduce((acc, s) => acc + (s.qteVendable ?? 0), 0),
    [qStock.data],
  );

  if (!user) return null;

  // Clochette = commandes à réceptionner + prévisions échues de l'utilisateur courant
  // + (principal) remises déclarées par ses apprentis, à confirmer + transferts à recevoir.
  const nbRemises = user.parentId ? 0 : nbRemisesAConfirmer(qRemises.data);
  const nbTransferts = nbTransfertsADecider(qTransferts.data, user.id);
  const nbCommandes = organisation ? 0 : qARecep.data?.length ?? 0;
  const notifCount = nbCommandes + qEchues.echues.length + nbRemises + nbTransferts;

  const onRefresh = () => {
    if (!organisation) qARecep.refetch();
    qEchues.refetch();
    if (!user.parentId) qRemises.refetch();
    qTransferts.refetch();
    qLiv.refetch();
    qEnc.refetch();
    qEncours.refetch();
    qStock.refetch();
    qMv.refetch();
    qAbo.refetch();
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={
            (qLiv.isFetching && !qLiv.isLoading) || (qStock.isFetching && !qStock.isLoading)
          }
          onRefresh={onRefresh}
          tintColor="#10b981"
        />
      }
    >
      <View className="px-4 pt-3">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">Bonjour</Text>
            <Text className="font-extrabold text-slate-900 dark:text-white text-lg">
              {user.prenom} {user.nom?.[0] ?? ''}.
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              hitSlop={6}
              onPress={() => ouvrir('/(livreur)/previsions/echues')}
              accessibilityRole="button"
              accessibilityLabel={`Notifications : ${notifCount}`}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
            >
              <Bell color="#475569" size={18} />
              {notifCount > 0 ? (
                <View
                  className="absolute -top-1 -right-1 h-4 px-1 rounded-full bg-red-500 items-center justify-center"
                  style={{ minWidth: 16 }}
                >
                  <Text className="text-white text-[9px] font-bold">
                    {notifCount > 99 ? '99+' : notifCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              hitSlop={6}
              onPress={() => ouvrir('/(livreur)/profil/infos')}
              accessibilityRole="button"
              accessibilityLabel="Modifier mes infos"
              className="active:opacity-70"
            >
              <Avatar prenom={user.prenom} nom={user.nom} photoUrl={user.photoUrl} size={40} />
            </Pressable>
          </View>
        </View>

        <AbonnementExpireBanner />

        {/* Hero card — solde du jour with sub-cards */}
        <View
          className="bg-emerald-500 mt-4 rounded-2xl p-4"
          style={{
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white/95">
              Encaissé aujourd’hui
            </Text>
            {computed.varPct !== null ? (
              <View className="bg-white/20 rounded-full px-2.5 py-1">
                <Text className="text-white text-[10px] font-extrabold">
                  {computed.varPct >= 0 ? '+' : ''}
                  {computed.varPct}% / hier
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-white font-extrabold mt-1">
            <Text className="text-4xl">{formatMontant(computed.totalEncaisseAujourd)}</Text>
            <Text className="text-base"> FCFA</Text>
          </Text>

          {/* Chiffres du jour, cliquables : liste des livraisons, détail des produits vendus, réceptions */}
          <View className="flex-row gap-2 mt-3">
            <SousCarte
              libelle="Livraisons"
              valeur={chiffreAccueil(qLiv, computed.duJour.length)}
              onPress={() => ouvrir('/(livreur)/livraisons')}
            />
            <SousCarte
              libelle="Produits vendus"
              valeur={chiffreAccueil(qMv, vendus)}
              onPress={() => ouvrir('/(livreur)/livraisons/produits-vendus')}
            />
            <SousCarte
              libelle="Réceptionnés"
              valeur={chiffreAccueil(qMv, recus)}
              // Commandes (et leurs réceptions) ; apprenti : commandes à réceptionner, comme le menu « Accéder à ».
              // Organisation : les chargements reçus sont des transferts.
              onPress={() =>
                ouvrir(
                  organisation
                    ? '/(livreur)/stock/transferts'
                    : user.parentId
                    ? '/(livreur)/cash/commandes/a-receptionner'
                    : '/(livreur)/cash/commandes',
                )
              }
            />
          </View>
        </View>

        {/* Stat cards — Stock + À encaisser */}
        <View className="flex-row gap-2 mt-3">
          <Pressable
            onPress={() => ouvrir('/(livreur)/stock')}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-xl p-3 active:opacity-70"
          >
            <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
              Stock
            </Text>
            <Text className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-none">
              {totalStock}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              unités vendables
            </Text>
          </Pressable>
          <Pressable
            // Soldes clients : liste Encours (ex-entrée du carrefour Cash).
            onPress={() => ouvrir('/(livreur)/cash/encours')}
            accessibilityRole="button"
            accessibilityLabel="À encaisser"
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 rounded-xl p-3 active:opacity-70"
          >
            <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
              À encaisser
            </Text>
            <Text className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-none">
              {qEncours.isError ? '—' : formatMontant(computed.aEncaisser)}
            </Text>
            <Text
              className={`text-[11px] mt-1 ${
                qEncours.isError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {qEncours.isError
                ? extractApiErrorMessage(qEncours.error, 'Soldes indisponibles')
                : `${computed.clientsAEncaisser} client${computed.clientsAEncaisser > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>

        {/* Actions rapides */}
        <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 mt-5 mb-2">
          Actions rapides
        </Text>
        <View className="flex-row gap-2">
          <ActionCard
            icon={Package}
            label="Stock"
            onPress={() => ouvrir('/(livreur)/stock')}
          />
          <ActionCard
            icon={Truck}
            label="Livrer"
            onPress={() => ouvrir('/(livreur)/livraisons/nouvelle')}
          />
          <ActionCard
            icon={Banknote}
            label="Encaisser"
            onPress={() => ouvrir('/(livreur)/livraisons')}
          />
          <ActionCard
            icon={RotateCcw}
            label="Retour produit"
            onPress={() => ouvrir('/(livreur)/cash/retour-client')}
          />
        </View>

        {/* Tournée du jour */}
        <View className="flex-row items-center justify-between mt-5 mb-2">
          <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
            Ma tournée · aujourd'hui
          </Text>
          <Pressable
            onPress={() => ouvrir('/(livreur)/livraisons')}
            className="active:opacity-70"
            hitSlop={6}
          >
            <Text className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
              Tout voir →
            </Text>
          </Pressable>
        </View>

        {qLiv.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : computed.duJour.length === 0 ? (
          <EmptyState
            title="Aucune livraison"
            message="Crée ta première livraison via le bouton ➕."
          />
        ) : (
          <View className="gap-2">
            {computed.duJour.slice(0, 5).map((l) => (
              <LivraisonCard key={l.id} livraison={l} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/** Sous-carte de la carte verte : un chiffre du jour, cliquable. */
function SousCarte({
  libelle,
  valeur,
  onPress,
}: {
  libelle: string;
  valeur: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${libelle} : ${valeur}`}
      className="flex-1 bg-white/15 rounded-xl px-3 py-2 active:opacity-70"
    >
      <Text
        className="text-[10px] uppercase font-bold tracking-wide text-white/90"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {libelle}
      </Text>
      <Text className="text-white font-extrabold text-lg">{valeur}</Text>
    </Pressable>
  );
}

function ActionCard({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 items-center gap-2 active:opacity-70"
    >
      <View className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
        <Icon color="#10b981" size={18} />
      </View>
      <Text className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
        {label}
      </Text>
    </Pressable>
  );
}
