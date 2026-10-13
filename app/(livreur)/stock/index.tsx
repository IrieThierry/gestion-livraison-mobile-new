import { useState } from 'react';
import { trierParProduit } from '../../../lib/tri';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { ArrowLeftRight, Users, ArrowRight, History, Undo2, Hourglass, ClipboardList } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SearchInput } from '../../../components/shared/SearchInput';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../../lib/recherche';
import { ProduitVignette } from '../../../components/shared/ProduitVignette';
import { MiseAZeroDialog, type CibleMiseAZero } from '../../../components/livreur/MiseAZeroDialog';
import { useStockCourant, useStockEnTransit } from '../../../features/stock/hooks';
import { peutMettreAZero } from '../../../features/stock/regles';
import { useAuthStore } from '../../../stores/authStore';
import { naviguer } from '../../../lib/navigation-app';
import { estCommercial, estResponsable, vocabulaire } from '../../../features/organisation/regles';

/**
 * Écran "Mon stock" — affiche le **stock courant livreur** Plan D
 * (table `stock_courant_livreur`), c'est-à-dire la quantité réellement
 * vendable APRÈS prise en compte des livraisons et des retours.
 *
 * Source : `GET /stock-livreur/me/courant` qui renvoie une ligne par
 * produit avec `qteVendable` (= achats − livraisons + retours sur la
 * période). C'est ce que le portail web montre aussi sur sa page Stock.
 *
 * NB : on n'utilise plus `useStockActuel` (= ventilation par achat ×
 * fournisseur, qui ne déduit pas les livraisons et donc affichait du
 * "stock à l'achat" trompeur).
 */
/**
 * Responsable (O15) : Stock n'est pas dans son espace. Montée sous ses
 * Transferts par un lien profond (`initialRouteName`), la liste ne rend rien
 * et ne lance aucune requête.
 */
export default function Stock() {
  const responsable = estResponsable(useAuthStore((s) => s.user));
  return responsable ? null : <StockCourant />;
}

function StockCourant() {
  const user = useAuthStore((s) => s.user);
  const q = useStockCourant();
  // Transferts en attente (hors reprises) : sortant et entrant par produit.
  const qTransit = useStockEnTransit(user?.id);
  const [recherche, setRecherche] = useState('');
  const [cible, setCible] = useState<CibleMiseAZero | null>(null);
  // Tri stable alphabétique par désignation produit
  const items = trierParProduit(q.data);

  const itemsAffiches = filtrerRecherche(items, recherche, (s) => [
    s.produit?.designation,
    s.produit?.code,
  ]);

  if (!user) return null;

  // Produits en transit (au moins une quantité envoyée ou à recevoir).
  const transit = (qTransit.data?.lignes ?? []).filter((l) => l.sortant > 0 || l.entrant > 0);

  // Organisation : « Rendre au dépôt » (O9) et demandes de chargement (O8) du commercial.
  const v = vocabulaire(user);
  const commercial = estCommercial(user);

  // « Mettre à zéro » : livreur principal seulement (jamais l'apprenti).
  const miseAZeroPossible = peutMettreAZero(user, user.id);

  // Total unités vendables sur tout le stock (somme des qteVendable).
  const totalUnites = items.reduce((acc, s) => acc + (s.qteVendable ?? 0), 0);

  // Total des retours cumulés sur la période — informatif.
  const totalRetours = items.reduce(
    (acc, s) => acc + (s.qteRetourneeSurPeriode ?? 0),
    0,
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mon stock"
        subtitle={`${items.length} produit${items.length > 1 ? 's' : ''}`}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          {/* Carte hero — total vendable */}
          <View className="bg-emerald-500 rounded-lg p-4 shadow-md">
            <Text className="text-[10px] font-semibold uppercase text-white/90">
              Vendable maintenant
            </Text>
            <Text className="text-3xl font-extrabold text-white mt-1">
              {totalUnites} <Text className="text-sm">unités</Text>
            </Text>
            <Text className="text-xs text-white/90 mt-1">
              {items.length} produit{items.length > 1 ? 's' : ''}
              {totalRetours > 0 ? ` · ${totalRetours} retours produits sur période` : ''}
            </Text>
          </View>

          {/* Mouvements (journal du stock) : racine et apprenti */}
          <Pressable
            onPress={() => naviguer('/(livreur)/stock/mouvements')}
            className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex-row items-center justify-between px-4 py-3 active:opacity-70"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <History color="#10b981" size={20} />
              <View className="flex-1">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  Mouvements
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Réceptions, transferts, livraisons, retours, ajustements
                </Text>
              </View>
            </View>
            <ArrowRight color="#94a3b8" size={16} />
          </Pressable>

          {/* En transit : transferts envoyés ou à recevoir, en attente d'acceptation (hors reprises). */}
          {transit.length > 0 ? (
            <Pressable
              onPress={() => naviguer('/(livreur)/stock/transferts')}
              accessibilityRole="button"
              className="mt-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-3 active:opacity-70"
            >
              <View className="flex-row items-center gap-2">
                <Hourglass color="#d97706" size={16} />
                <Text className="flex-1 font-extrabold text-amber-900 dark:text-amber-200">En transit</Text>
                <ArrowRight color="#94a3b8" size={16} />
              </View>
              {transit.map((l) => (
                <View key={l.produit?.id} className="flex-row items-start justify-between mt-1.5 gap-2">
                  <Text className="flex-1 text-[12px] font-bold text-slate-800 dark:text-slate-200">
                    {l.produit?.designation ?? '—'}
                  </Text>
                  <View className="items-end">
                    {l.sortant > 0 ? (
                      <Text className="text-[11px] text-amber-800 dark:text-amber-300">
                        {`${l.sortant} envoyé(s), en attente d’acceptation`}
                      </Text>
                    ) : null}
                    {l.entrant > 0 ? (
                      <Text className="text-[11px] text-emerald-700 dark:text-emerald-400">{`${l.entrant} à recevoir`}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Pressable>
          ) : null}

          {/* Transferts (tous) ; « Rendre du stock » (apprenti) ; « Stock équipe » (principal) */}
          <View className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {commercial ? (
              <Pressable
                onPress={() => naviguer('/(livreur)/stock/demandes')}
                accessibilityRole="button"
                className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <ClipboardList color="#0ea5e9" size={20} />
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">Demandes de chargement</Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Demande du stock au dépôt, suis et annule tes demandes
                    </Text>
                  </View>
                </View>
                <ArrowRight color="#94a3b8" size={16} />
              </Pressable>
            ) : null}
            {user.parentId ? (
              <Pressable
                onPress={() => naviguer('/(livreur)/stock/transferts/nouveau')}
                accessibilityRole="button"
                className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <Undo2 color="#10b981" size={20} />
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">{v.rendreStock}</Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      {v.rendreStockAide}
                    </Text>
                  </View>
                </View>
                <ArrowRight color="#94a3b8" size={16} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => naviguer('/(livreur)/stock/transferts')}
              accessibilityRole="button"
              className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <ArrowLeftRight color="#3b82f6" size={20} />
                <View className="flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    {commercial ? 'Mes bons de transfert' : 'Transferts'}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    {commercial
                      ? 'Chargements reçus et retours au dépôt'
                      : user.parentId
                        ? `Avec ${v.tonPrincipal}`
                        : `Vers / depuis tes ${v.apprentis}`}
                  </Text>
                </View>
              </View>
              <ArrowRight color="#94a3b8" size={16} />
            </Pressable>
            {!user.parentId ? (
              <Pressable
                onPress={() => naviguer('/(livreur)/stock/equipe')}
                className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <Users color="#8b5cf6" size={20} />
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      Stock équipe
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Vue agrégée toi + apprentis
                    </Text>
                  </View>
                </View>
                <ArrowRight color="#94a3b8" size={16} />
              </Pressable>
            ) : null}
          </View>

          {/* Liste */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Par produit
          </Text>
          {items.length > 0 ? (
            <SearchInput
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher un produit…"
              className="mb-2"
            />
          ) : null}

          {q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : items.length === 0 ? (
            <EmptyState
              title="Stock vide"
              message="Le stock entre par la réception d'une commande, un transfert ou un retour remis en stock."
            />
          ) : itemsAffiches.length === 0 ? (
            <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
              {AUCUN_RESULTAT}
            </Text>
          ) : (
            <View className="gap-2">
              {itemsAffiches.map((it) => {
                const designation = it.produit?.designation ?? '—';
                const code = it.produit?.code ?? '';
                const qte = it.qteVendable ?? 0;
                const retours = it.qteRetourneeSurPeriode ?? 0;
                const lowStock = qte < 5;
                const outOfStock = qte === 0;
                const borderColor = outOfStock
                  ? 'border-l-red-500'
                  : lowStock
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500';
                return (
                  <View
                    key={it.produit?.id ?? code}
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${borderColor} rounded-lg p-3 flex-row items-start justify-between`}
                  >
                    <View className="mr-3">
                      <ProduitVignette
                        designation={it.produit?.designation}
                        photoUrl={it.produit?.photoUrl}
                        size={40}
                      />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {designation}
                      </Text>
                      {code ? (
                        <Text className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {code}
                        </Text>
                      ) : null}
                      {retours > 0 ? (
                        <Text className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                          {retours} retour{retours > 1 ? 's' : ''} sur la période
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-2xl font-extrabold ${
                          outOfStock
                            ? 'text-red-600 dark:text-red-400'
                            : lowStock
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {qte}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                        unité{qte > 1 ? 's' : ''}
                      </Text>
                      {miseAZeroPossible && qte > 0 && it.produit ? (
                        <Pressable
                          onPress={() =>
                            setCible({ livreurId: user.id, produit: it.produit, quantite: qte })
                          }
                          hitSlop={6}
                          accessibilityLabel={`Mettre à zéro ${designation}`}
                          className="mt-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-500/10 active:opacity-70"
                        >
                          <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">
                            Mettre à zéro
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <MiseAZeroDialog
        key={cible ? `${cible.livreurId}-${cible.produit.id}` : 'aucune'}
        cible={cible}
        onClose={() => setCible(null)}
      />
    </View>
  );
}
