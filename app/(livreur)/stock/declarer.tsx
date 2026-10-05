import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { dialog } from '../../../lib/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../components/shared/PageHeader';
import { SelectField } from '../../../components/shared/SelectField';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import { useEnregistrerAchat } from '../../../features/stock/hooks';
import { useFournisseurs } from '../../../features/lookups/hooks';
import { produitKeys } from '../../../features/produits/keys';
import { commandeKeys } from '../../../features/commandes/keys';
import { useCatalogueFournisseur } from '../../../features/commandes/hooks';
import { prixCatalogueParProduit, produitsAchetables, totalIndicatifAchat } from '../../../features/stock/regles';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';
import type { EnregistrerStockRequest } from '../../../types/api';

export default function DeclarerAchat() {
  const user = useAuthStore((s) => s.user);
  const { data: fournisseurs = [], isLoading: loadingFournisseurs } = useFournisseurs();
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: catalogue = [],
    isLoading: loadingCatalogue,
    isError: catalogueEnErreur,
    error: catalogueErreur,
  } = useCatalogueFournisseur(fournisseurId ?? undefined);
  const produits = useMemo(() => produitsAchetables(catalogue), [catalogue]);
  const prixParProduit = useMemo(() => prixCatalogueParProduit(catalogue), [catalogue]);
  const m = useEnregistrerAchat();
  const qc = useQueryClient();

  // Pull-to-refresh : invalide les fournisseurs (lookup, staleTime 5min) et
  // le catalogue produits et celui du fournisseur choisi.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lookups', 'fournisseurs'] }),
        qc.invalidateQueries({ queryKey: produitKeys.all }),
        qc.invalidateQueries({ queryKey: commandeKeys.all }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Total indicatif : quantité × prix du catalogue du fournisseur (aide visuelle,
  // le back ne lit pas de prix dans la requête `LigneStockRequest` = { produitId, qte }).
  const totalAchat = totalIndicatifAchat(lignes, catalogue);

  // Tri stable alphabétique pour la liste déroulante
  const fournisseursOptions = useMemo(
    () =>
      [...fournisseurs]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map((f) => ({ id: f.id, label: f.libelle })),
    [fournisseurs],
  );

  const onSubmit = () => {
    if (!user) {
      dialog.error('Erreur', 'Session invalide');
      return;
    }
    if (!fournisseurId) {
      dialog.warning('Champ requis', 'Choisis un fournisseur');
      return;
    }
    const validLignes = lignes.filter((l) => l.qte > 0);
    if (validLignes.length === 0) {
      dialog.warning('Lignes invalides', 'Ajoute au moins une ligne avec une quantité > 0');
      return;
    }

    const payload: EnregistrerStockRequest = {
      livreurId: user.id,
      fournisseurId,
      lignes: validLignes.map((l) => ({
        produitId: l.produitId,
        qte: l.qte,
      })),
    };

    m.mutate(payload, {
      onSuccess: () => {
        setFournisseurId(null);
        setLignes([]);
        router.back();
        dialog.success('Achat enregistré', 'Ton stock est mis à jour');
      },
      onError: (err: unknown) => {
        dialog.error('Erreur', extractApiErrorMessage(err, "Échec de l'enregistrement"));
      },
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Déclarer un achat" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          <SelectField
            label="Fournisseur *"
            placeholder="Choisir un fournisseur"
            value={fournisseurId}
            onChange={(id) => {
              setFournisseurId(id);
              setLignes([]);
            }}
            options={fournisseursOptions}
            isLoading={loadingFournisseurs}
            emptyMessage="Aucun fournisseur disponible"
          />

          <View className="mt-5">
            {!fournisseurId ? (
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                Choisis d'abord un fournisseur
              </Text>
            ) : loadingCatalogue ? (
              <ActivityIndicator color="#10b981" />
            ) : catalogueEnErreur ? (
              <Text className="text-sm text-red-500">
                {extractApiErrorMessage(catalogueErreur, 'Catalogue indisponible')}
              </Text>
            ) : produits.length === 0 ? (
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                Ce fournisseur n'a aucun produit actif.
              </Text>
            ) : (
              <ProduitPicker
                lignes={lignes}
                onChange={setLignes}
                produits={produits}
                prixParProduit={prixParProduit}
                prixModifiable={false}
              />
            )}
          </View>

          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5 flex-row justify-between">
            <Text className="font-bold text-slate-700 dark:text-slate-300">
              Total achat
            </Text>
            <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatFCFA(totalAchat)} FCFA
            </Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            className="bg-emerald-500 rounded-md py-3.5 mt-5 items-center active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Enregistrer</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
