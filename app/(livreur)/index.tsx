import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Bell, Package, Truck, Banknote, RotateCcw, ShoppingBag, PackageCheck } from 'lucide-react-native';
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
  jourLocal,
  produitsVendus,
  receptionsParFournisseur,
} from '../../features/accueil/regles';
import { useCommandesAReceptionner } from '../../features/commandes/hooks';
import { useAuthStore } from '../../stores/authStore';
import { EmptyState } from '../../components/shared/EmptyState';
import { Avatar } from '../../components/shared/Avatar';
import { ProduitVignette } from '../../components/shared/ProduitVignette';
import { PendingValidationGate } from '../../components/shared/PendingValidationGate';
import { LivraisonCard } from '../../components/livreur/LivraisonCard';
import { formatMontant } from '../../lib/format';
import { extractApiErrorMessage } from '../../lib/api-error';

export default function Tournee() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qLiv = useLivraisonsByLivreur(livreurId);
  const qEnc = useEncaissementsByLivreur(livreurId);
  const qEncours = useEncoursByLivreur(livreurId);
  // Stock courant (Plan D) — somme des `qteVendable` (= achats − livraisons
  // + retours sur la période). C'est ce que l'écran Stock affiche aussi.
  const qStock = useStockCourant();
  const qARecep = useCommandesAReceptionner(!!user);
  // Mouvements de stock du jour (local) du livreur connecté — l'apprenti voit
  // les siens : produits vendus (livraisons) et réceptions par fournisseur.
  const jour = jourLocal();
  const filtresMouvements = useMemo(() => ({ debut: jour, fin: jour }), [jour]);
  const qMv = useMouvementsStock(livreurId, filtresMouvements);
  const vendus = useMemo(() => produitsVendus(qMv.data ?? [], jour), [qMv.data, jour]);
  const receptions = useMemo(
    () => receptionsParFournisseur(qMv.data ?? [], jour),
    [qMv.data, jour],
  );

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

  // Clochette = nombre de commandes à réceptionner pour l'utilisateur courant.
  const notifCount = qARecep.data?.length ?? 0;

  const onRefresh = () => {
    qARecep.refetch();
    qLiv.refetch();
    qEnc.refetch();
    qEncours.refetch();
    qStock.refetch();
    qMv.refetch();
  };

  return (
    <PendingValidationGate>
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
              onPress={() => router.push('/(livreur)/cash/commandes/a-receptionner' as never)}
              accessibilityRole="button"
              accessibilityLabel="Commandes à réceptionner"
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
              onPress={() => router.push('/(livreur)/profil/infos' as never)}
              accessibilityRole="button"
              accessibilityLabel="Modifier mes infos"
              className="active:opacity-70"
            >
              <Avatar prenom={user.prenom} nom={user.nom} photoUrl={user.photoUrl} size={40} />
            </Pressable>
          </View>
        </View>

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

          <View className="flex-row gap-2 mt-3">
            <View className="flex-1 bg-white/15 rounded-xl px-3 py-2">
              <Text className="text-[10px] uppercase font-bold tracking-wider text-white/90">
                Livraisons
              </Text>
              <Text className="text-white font-extrabold text-lg">{computed.duJour.length}</Text>
            </View>
          </View>
        </View>

        {/* Stat cards — Stock + À encaisser */}
        <View className="flex-row gap-2 mt-3">
          <Pressable
            onPress={() => router.push('/(livreur)/stock' as never)}
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
            onPress={() => router.push('/(livreur)/clients' as never)}
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
            onPress={() => router.push('/(livreur)/stock' as never)}
          />
          <ActionCard
            icon={Truck}
            label="Livrer"
            onPress={() => router.push('/(livreur)/livraisons/nouvelle' as never, { withAnchor: true })}
          />
          <ActionCard
            icon={Banknote}
            label="Encaisser"
            onPress={() => router.push('/(livreur)/livraisons' as never)}
          />
          <ActionCard
            icon={RotateCcw}
            label="Retour produit"
            onPress={() => router.push('/(livreur)/cash/retour-client' as never, { withAnchor: true })}
          />
        </View>

        {/* Produits vendus aujourd'hui (livré seulement, retours non déduits) */}
        <BlocJour
          titre="Produits vendus"
          icon={ShoppingBag}
          isLoading={qMv.isLoading}
          erreur={qMv.isError ? extractApiErrorMessage(qMv.error, 'Ventes indisponibles') : null}
          vide={vendus.length === 0}
          messageVide="Aucune vente aujourd'hui"
        >
          {vendus.map((l, i) => (
            <LigneQuantite key={l.produitId} libelle={l.designation} photoUrl={l.photoUrl} quantite={l.quantite} premiere={i === 0} />
          ))}
        </BlocJour>

        {/* Réceptions du jour, groupées par fournisseur */}
        <BlocJour
          titre="Réceptions"
          icon={PackageCheck}
          isLoading={qMv.isLoading}
          erreur={qMv.isError ? extractApiErrorMessage(qMv.error, 'Réceptions indisponibles') : null}
          vide={receptions.length === 0}
          messageVide="Aucune réception aujourd'hui"
        >
          {receptions.map((g, gi) => (
            <View key={g.fournisseur} className={gi > 0 ? 'mt-3' : ''}>
              <Text className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                {g.fournisseur}
              </Text>
              {g.produits.map((l, i) => (
                <LigneQuantite key={l.produitId} libelle={l.designation} photoUrl={l.photoUrl} quantite={l.quantite} premiere={i === 0} />
              ))}
            </View>
          ))}
        </BlocJour>

        {/* Tournée du jour */}
        <View className="flex-row items-center justify-between mt-5 mb-2">
          <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
            Ma tournée · aujourd'hui
          </Text>
          <Pressable
            onPress={() => router.push('/(livreur)/livraisons' as never)}
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
    </PendingValidationGate>
  );
}

function BlocJour({
  titre,
  icon: Icon,
  isLoading,
  erreur,
  vide,
  messageVide,
  children,
}: {
  titre: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  isLoading: boolean;
  erreur: string | null;
  vide: boolean;
  messageVide: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <View className="flex-row items-center gap-1.5 mb-2">
        <Icon color="#64748b" size={13} />
        <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
          {titre} · aujourd'hui
        </Text>
      </View>
      <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
        {isLoading ? (
          <View className="py-2 items-center">
            <ActivityIndicator color="#10b981" />
          </View>
        ) : erreur ? (
          <Text className="text-[12px] text-red-600 dark:text-red-400 py-1">{erreur}</Text>
        ) : vide ? (
          <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-1">
            {messageVide}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

function LigneQuantite({
  libelle,
  photoUrl,
  quantite,
  premiere,
}: {
  libelle: string;
  photoUrl?: string;
  quantite: number;
  premiere: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-1.5 ${
        premiere ? '' : 'border-t border-slate-100 dark:border-slate-800'
      }`}
    >
      <View className="mr-2">
        <ProduitVignette designation={libelle} photoUrl={photoUrl} size={28} />
      </View>
      <Text className="flex-1 text-[13px] text-slate-800 dark:text-slate-200 pr-2" numberOfLines={2}>
        {libelle}
      </Text>
      <Text className="text-[13px] font-extrabold text-slate-900 dark:text-white">{quantite}</Text>
    </View>
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
