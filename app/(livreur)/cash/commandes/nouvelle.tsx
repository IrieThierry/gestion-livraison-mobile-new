import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { dialog } from '../../../../lib/dialog';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { SelectField } from '../../../../components/shared/SelectField';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useFournisseurs } from '../../../../features/lookups/hooks';
import {
  useCatalogueFournisseur,
  useCreerCommande,
} from '../../../../features/commandes/hooks';
import {
  construireCommande,
  lignesCommandables,
  remisePartenaire,
  type Quantites,
} from '../../../../features/commandes/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatFCFA } from '../../../../lib/format';

export default function NouvelleCommande() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isRootLivreur = !!user && !user.parentId;

  const { data: fournisseurs = [] } = useFournisseurs();
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  const [quantites, setQuantites] = useState<Quantites>({});
  const catalogue = useCatalogueFournisseur(fournisseurId ?? undefined);
  const m = useCreerCommande();
  const lignes = useMemo(() => lignesCommandables(catalogue.data ?? []), [catalogue.data]);

  const options = useMemo(
    () =>
      [...fournisseurs]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map((f) => ({ id: f.id, label: f.libelle })),
    [fournisseurs],
  );

  if (!user) return null;

  if (!isRootLivreur) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Nouvelle commande" fallback="/(livreur)/cash/commandes" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal peut passer des commandes."
        />
      </View>
    );
  }

  const changerFournisseur = (id: string | null) => {
    setFournisseurId(id);
    setQuantites({});
  };

  const onSubmit = () => {
    const resultat = construireCommande(fournisseurId ?? '', quantites);
    if (!resultat.ok) {
      dialog.warning('Commande incomplète', resultat.erreur);
      return;
    }
    m.mutate(resultat.valeur, {
      onSuccess: () => {
        setFournisseurId(null);
        setQuantites({});
        router.back();
        dialog.success('Commande envoyée');
      },
      onError: (err: unknown) =>
        dialog.error('Erreur', extractApiErrorMessage(err, "Échec de l'envoi de la commande")),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle commande" fallback="/(livreur)/cash/commandes" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="px-4">
          <SelectField
            label="Fournisseur *"
            placeholder="Choisir un fournisseur"
            value={fournisseurId}
            onChange={changerFournisseur}
            options={options}
            isLoading={fournisseurs.length === 0}
            emptyMessage="Aucun fournisseur disponible"
          />

          {fournisseurId ? (
            <>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
                Produits (prix applicable ; le prix retenu est figé à la livraison)
              </Text>
              {catalogue.isLoading ? (
                <Text className="text-slate-400 text-sm">Chargement…</Text>
              ) : catalogue.isError ? (
                <Text className="text-red-500 text-sm">
                  {extractApiErrorMessage(catalogue.error, 'Catalogue indisponible')}
                </Text>
              ) : lignes.length === 0 ? (
                <EmptyState
                  title="Catalogue vide"
                  message="Ce fournisseur n'a aucun produit au catalogue."
                />
              ) : (
                <View className="gap-2">
                  {remisePartenaire(lignes) > 0 ? (
                    <Text className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Remise livreur : {formatFCFA(remisePartenaire(lignes))} F par unité
                      (accordée par le fournisseur)
                    </Text>
                  ) : null}
                  {lignes.map((pf) => (
                    <View
                      key={pf.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                          {pf.produit.designation}
                        </Text>
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatFCFA(pf.prixDeVente)} F
                        </Text>
                        {pf.prixParticulier ? (
                          <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Prix particulier
                          </Text>
                        ) : null}
                      </View>
                      <TextInput
                        value={quantites[pf.produit.id] ?? ''}
                        onChangeText={(v) => setQuantites((q) => ({ ...q, [pf.produit.id]: v }))}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        accessibilityLabel={`Quantité de ${pf.produit.designation}`}
                        className="w-20 px-3 py-2 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white text-base"
                      />
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline || !fournisseurId}
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline || !fournisseurId
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline || !fournisseurId ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Envoyer la commande'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
