import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { dialog } from '../../../../lib/dialog';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { SelectField } from '../../../../components/shared/SelectField';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import { ApprentiAffecteField } from '../../../../components/livreur/ApprentiAffecteField';
import { useFournisseursPartenaires } from '../../../../features/lookups/hooks';
import {
  useCatalogueFournisseur,
  useCreerCommande,
} from '../../../../features/commandes/hooks';
import {
  construireCommande,
  lignesCommandables,
  montantLigneCommande,
  quantiteSaisie,
  remisePartenaire,
  totauxEstimes,
  type Quantites,
} from '../../../../features/commandes/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatFCFA } from '../../../../lib/format';
import { MESSAGE_AUCUN_PARTENAIRE, etatListePartenaires } from '../../../../features/relations/regles';
import { useRetourListe } from '../../../../lib/useRetourListe';
import { naviguer } from '../../../../lib/navigation-app';
import {
  useCommandePrefillStore,
  type PrefillCommandeSource,
} from '../../../../stores/commandePrefillStore';
import { jourCourt, prefillCommande } from '../../../../features/previsions/regles';

export default function NouvelleCommande() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isRootLivreur = !!user && !user.parentId;

  const qFournisseurs = useFournisseursPartenaires();
  const fournisseurs = useMemo(() => qFournisseurs.data ?? [], [qFournisseurs.data]);
  const etatListe = etatListePartenaires({
    isLoading: qFournisseurs.isLoading,
    isError: qFournisseurs.isError,
    nombre: fournisseurs.length,
  });
  // Commander depuis le cumul des prévisions : source passée par un store (pas d'URL),
  // prise (donc vidée) à chaque nouveau « Commander », même si l'écran est resté monté.
  const sourceEnAttente = useCommandePrefillStore((s) => s.source);
  const [prefill, setPrefill] = useState<PrefillCommandeSource | null>(null);
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  // Fournisseur pour lequel le cumul a déjà été reporté dans les quantités.
  const [prefillApplique, setPrefillApplique] = useState<string | null>(null);
  const [quantites, setQuantites] = useState<Quantites>({});
  const [apprentiId, setApprentiId] = useState<string | null>(null);
  const catalogue = useCatalogueFournisseur(fournisseurId ?? undefined);
  const m = useCreerCommande();
  const verrou = useRef(creerVerrou()).current;
  const retourListe = useRetourListe('/(livreur)/cash/commandes');
  const lignes = useMemo(() => lignesCommandables(catalogue.data ?? []), [catalogue.data]);
  const totaux = totauxEstimes(lignes, quantites);
  const prerempli = useMemo(
    () => (prefill && fournisseurId && catalogue.data ? prefillCommande(prefill.cumul, lignes) : null),
    [prefill, fournisseurId, catalogue.data, lignes],
  );

  useEffect(() => {
    if (!sourceEnAttente) return;
    const source = useCommandePrefillStore.getState().prendre();
    if (!source) return;
    // Nouveau « Commander » : le formulaire repart de cette source seulement.
    setPrefill(source);
    setFournisseurId(source.fournisseurId);
    setQuantites({});
    setApprentiId(null);
    setPrefillApplique(null);
  }, [sourceEnAttente]);

  // Quantités = cumul brut des produits proposés par ce fournisseur (modifiables).
  useEffect(() => {
    if (prerempli && fournisseurId && prefillApplique !== fournisseurId) {
      setQuantites(prerempli.quantites);
      setPrefillApplique(fournisseurId);
    }
  }, [prerempli, fournisseurId, prefillApplique]);

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
        <PageHeader title="Nouvelle commande" />
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
    // Les apprentis affectables dépendent du fournisseur (blocages).
    setApprentiId(null);
  };

  const onSubmit = () => {
    const resultat = construireCommande(fournisseurId ?? '', quantites);
    if (!resultat.ok) {
      dialog.warning('Commande incomplète', resultat.erreur);
      return;
    }
    const payload = apprentiId ? { ...resultat.valeur, apprentiId } : resultat.valeur;
    lancerUneFois(verrou, (fin) => m.mutate(payload, {
      onSettled: fin,
      onSuccess: () => {
        setFournisseurId(null);
        setQuantites({});
        setApprentiId(null);
        // Commande envoyée : le cumul n'est plus jamais réappliqué.
        setPrefill(null);
        setPrefillApplique(null);
        retourListe();
        dialog.success('Commande envoyée');
      },
      onError: (err: unknown) =>
        dialog.error('Erreur', extractApiErrorMessage(err, "Échec de l'envoi de la commande")),
    }));
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle commande" />

      <FormScreen>
        <View className="px-4">
          {etatListe === 'erreur' ? (
            <View className="items-center py-8">
              <Text className="text-red-500 text-sm text-center">
                {extractApiErrorMessage(qFournisseurs.error, 'Fournisseurs indisponibles')}
              </Text>
              <Pressable
                onPress={() => qFournisseurs.refetch()}
                className="bg-emerald-700 rounded-md px-5 py-3 mt-3 active:opacity-80"
              >
                <Text className="text-white font-bold">Réessayer</Text>
              </Pressable>
            </View>
          ) : etatListe === 'vide' ? (
            <View className="items-center">
              <EmptyState title={MESSAGE_AUCUN_PARTENAIRE} />
              <Pressable
                onPress={() => naviguer('/(livreur)/profil/fournisseurs')}
                className="bg-emerald-700 rounded-md px-5 py-3 active:opacity-80"
              >
                <Text className="text-white font-bold">Mes fournisseurs</Text>
              </Pressable>
            </View>
          ) : (
          <SelectField
            label="Fournisseur *"
            placeholder="Choisir un fournisseur"
            value={fournisseurId}
            onChange={changerFournisseur}
            options={options}
            isLoading={etatListe === 'chargement'}
            emptyMessage="Aucun fournisseur disponible"
          />
          )}

          {fournisseurId ? (
            <>
              <View className="mt-4">
                <ApprentiAffecteField
                  fournisseurId={fournisseurId}
                  value={apprentiId}
                  onChange={setApprentiId}
                />
              </View>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
                Produits (prix applicable ; le prix retenu est figé à la réception)
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
                    <Text className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-400">
                      Remise livreur : {formatFCFA(remisePartenaire(lignes))} F par unité
                      (accordée par le fournisseur)
                    </Text>
                  ) : null}
                  {lignes.map((pf) => (
                    <View
                      key={pf.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center justify-between"
                    >
                      <ProduitVignette
                        designation={pf.produit.designation}
                        photoUrl={pf.produit.photoUrl}
                        size={36}
                      />
                      <View className="flex-1 px-2">
                        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                          {pf.produit.designation}
                        </Text>
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatFCFA(pf.prixDeVente)} F
                          {(Number(pf.remiseLivreur) || 0) > 0
                            ? ` · remise ${formatFCFA(pf.remiseLivreur)} F/u`
                            : ''}
                        </Text>
                        {quantiteSaisie(quantites, pf.produit.id) > 0 ? (
                          <Text
                            testID={`montant-ligne-${pf.produit.id}`}
                            className="text-[11px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            {formatFCFA(
                              montantLigneCommande(
                                pf.prixDeVente,
                                pf.remiseLivreur,
                                quantiteSaisie(quantites, pf.produit.id),
                              ),
                            )}{' '}
                            F
                          </Text>
                        ) : null}
                        {pf.prixParticulier ? (
                          <Text className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
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
                  <Text
                    testID="detail-total-estime"
                    className="text-[12px] text-slate-500 dark:text-slate-400 mt-2 px-1"
                  >
                    {totaux.remise > 0
                      ? `Prix ${formatFCFA(totaux.prix)} F + remise ${formatFCFA(totaux.remise)} F`
                      : `Prix ${formatFCFA(totaux.prix)} F`}
                  </Text>
                  <View className="flex-row justify-between items-center px-1">
                    <Text className="text-slate-700 dark:text-slate-300 font-bold">Total estimé</Text>
                    <Text
                      testID="total-estime"
                      className="font-extrabold text-emerald-800 dark:text-emerald-400 text-base"
                    >
                      {formatFCFA(totaux.total)} F
                    </Text>
                  </View>
                </View>
              )}
              {prefill && prerempli ? (
                <View className="mt-4">
                  <Text className="text-[12px] font-semibold text-blue-700 dark:text-blue-300">
                    Prérempli depuis le cumul des prévisions du {jourCourt(prefill.jour)}
                  </Text>
                  {prerempli.nonProposes.length > 0 ? (
                    <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mt-2">
                      <Text className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300 mb-1">
                        Non proposés par ce fournisseur
                      </Text>
                      {prerempli.nonProposes.map((p) => (
                        <View key={p.produitId} className="flex-row justify-between py-0.5">
                          <Text className="text-[13px] text-amber-800 dark:text-amber-200 flex-1">{p.designation}</Text>
                          <Text className="text-[13px] font-bold text-amber-800 dark:text-amber-200">{p.qte}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline || !fournisseurId}
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline || !fournisseurId
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-700 active:opacity-80'
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
      </FormScreen>
    </View>
  );
}
