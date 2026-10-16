import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import {
  useCatalogueFournisseur,
  useDesactiverLigneCatalogue,
  useReactiverLigneCatalogue,
} from '../../../../features/fournisseur/hooks';
import {
  FILTRES_CATALOGUE,
  TEXTE_DESACTIVATION,
  filtrerCatalogue,
  texteReactivation,
  type FiltreCatalogue,
} from '../../../../features/fournisseur/catalogue';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { dialog } from '../../../../lib/dialog';
import { formatDateLong, formatFCFA } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';
import type { LigneCatalogueFournisseurResponse } from '../../../../types/api';

/**
 * F2, Moi → « Mon catalogue » : les produits que le fournisseur propose aux
 * livreurs, avec son prix de vente (comme la page web). Filtre Actifs,
 * Inactifs, Tous ; « Ajouter », « Modifier » (désignation si renommable, prix)
 * et Désactiver ou Réactiver après confirmation. La remise livreur et les prix
 * particuliers se règlent par livreur, dans l'onglet Livreurs.
 */
export default function CatalogueFournisseur() {
  const q = useCatalogueFournisseur();
  const desactiver = useDesactiverLigneCatalogue();
  const reactiver = useReactiverLigneCatalogue();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [filtre, setFiltre] = useState<FiltreCatalogue>('actifs');
  const lignes = useMemo(() => filtrerCatalogue(q.data, filtre), [q.data, filtre]);

  const basculer = (ligne: LigneCatalogueFournisseurResponse) => {
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Réessaye une fois en ligne.');
      return;
    }
    // Action figée à l'ouverture de la confirmation (comme le web).
    const desactivation = ligne.actif;
    const nom = ligne.produit.designation;
    dialog.confirm({
      title: `${desactivation ? 'Désactiver' : 'Réactiver'} « ${nom} » ?`,
      message: desactivation ? TEXTE_DESACTIVATION : texteReactivation(ligne.prixDeVente),
      confirmLabel: desactivation ? 'Désactiver' : 'Réactiver',
      destructive: desactivation,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) => {
          const options = {
            onSettled: fin,
            onSuccess: () => dialog.success(desactivation ? 'Produit désactivé' : 'Produit réactivé'),
            onError: (e: unknown) =>
              dialog.error(
                'Erreur',
                extractApiErrorMessage(
                  e,
                  desactivation ? 'Impossible de désactiver ce produit' : 'Impossible de réactiver ce produit',
                ),
              ),
          };
          if (desactivation) desactiver.mutate(ligne.id, options);
          else reactiver.mutate({ pfId: ligne.id }, options);
        }),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mon catalogue"
        subtitle="Tes produits et ton prix de vente aux livreurs"
        right={
          <Pressable
            onPress={() => naviguer('/fournisseur/moi/catalogue/ajouter')}
            accessibilityRole="button"
            accessibilityLabel="Ajouter un produit"
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Ajouter</Text>
          </Pressable>
        }
      />

      <View className="px-4 flex-row gap-2">
        {FILTRES_CATALOGUE.map((f) => {
          const actif = filtre === f.valeur;
          return (
            <Pressable
              key={f.valeur}
              onPress={() => setFiltre(f.valeur)}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              className={`px-3 py-1.5 rounded-full border ${
                actif ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Text className={`text-[12px] font-bold ${actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {f.libelle}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={lignes}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={!!q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <EmptyState
              title="Chargement impossible"
              message={extractApiErrorMessage(q.error, 'Impossible de charger le catalogue.')}
            />
          ) : (q.data ?? []).length === 0 ? (
            <EmptyState title="Aucun produit au catalogue" message="Touche « Ajouter » pour commencer." />
          ) : (
            <Text className="text-slate-500 dark:text-slate-400 text-sm px-1 pt-4">Aucun produit pour ce filtre.</Text>
          )
        }
        ListFooterComponent={
          (q.data ?? []).length > 0 ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              La remise livreur et les prix particuliers se règlent par livreur, dans l’onglet Livreurs.
            </Text>
          ) : null
        }
        renderItem={({ item: l }) => (
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2">
            <View className="flex-row items-center gap-3">
              <ProduitVignette designation={l.produit.designation} photoUrl={l.produit.photoUrl} />
              <View className="flex-1">
                <Text className="font-extrabold text-slate-900 dark:text-white">{l.produit.designation}</Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">{l.produit.code}</Text>
              </View>
              <View className="items-end">
                <Text className="font-extrabold text-slate-900 dark:text-white">{formatFCFA(l.prixDeVente)} F</Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                  {l.nbPrixParticuliers > 0
                    ? `${l.nbPrixParticuliers} prix particulier${l.nbPrixParticuliers > 1 ? 's' : ''}`
                    : 'Aucun prix particulier'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  l.actif
                    ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {l.actif
                  ? 'Actif'
                  : l.dateDesactivation
                    ? `Inactif depuis le ${formatDateLong(l.dateDesactivation)}`
                    : 'Inactif'}
              </Text>
              <View className="flex-row gap-4">
                <Pressable
                  onPress={() => naviguer(`/fournisseur/moi/catalogue/${encodeURIComponent(l.id)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${l.produit.designation}`}
                  hitSlop={6}
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  <Pencil color="#2563eb" size={13} />
                  <Text className="text-[12px] font-bold text-blue-600 dark:text-blue-400">Modifier</Text>
                </Pressable>
                <Pressable
                  onPress={() => basculer(l)}
                  accessibilityRole="button"
                  accessibilityLabel={`${l.actif ? 'Désactiver' : 'Réactiver'} ${l.produit.designation}`}
                  hitSlop={6}
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  {l.actif ? <PowerOff color="#dc2626" size={13} /> : <Power color="#047857" size={13} />}
                  <Text
                    className={`text-[12px] font-bold ${
                      l.actif ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {l.actif ? 'Désactiver' : 'Réactiver'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
