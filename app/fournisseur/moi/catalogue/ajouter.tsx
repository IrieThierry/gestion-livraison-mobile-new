import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Check } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { SearchInput } from '../../../../components/shared/SearchInput';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import {
  useActiverProduitCatalogue,
  useCatalogueFournisseur,
  useCreerEtActiverProduit,
  useReactiverLigneCatalogue,
} from '../../../../features/fournisseur/hooks';
import { useProduits } from '../../../../features/produits/hooks';
import {
  MESSAGE_DOUBLON_FOURNISSEUR,
  doublonDe,
  erreurDesignation,
  etatProduit,
  lignesParProduit,
  nettoyerDesignation,
  resultatsReferentiel,
} from '../../../../features/fournisseur/catalogue';
import { lirePrixDeVente } from '../../../../features/fournisseur/gestion';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { dialog } from '../../../../lib/dialog';
import { retourParent } from '../../../../lib/navigation-app';
import { useUploadPhotoCatalogue } from '../../../../features/photos/hooks';
import { MESSAGE_PHOTO_NON_ENVOYEE, verifierPhotoProduit } from '../../../../features/produits/photo';
import { pickImage, type PickedImage } from '../../../../lib/image-picker';
import type { LigneCatalogueFournisseurResponse, ProduitResponse } from '../../../../types/api';

const LABEL = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2';
const CHAMP =
  'px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white';

type Mode = 'liste' | 'nouveau';

/**
 * F2 : ajouter un produit au catalogue, comme la fenêtre du web : le choisir
 * dans le référentiel (un produit déjà actif chez toi est grisé ; un produit
 * inactif chez toi est réactivé avec le prix saisi), ou le créer s'il
 * n'existe pas (désignation contrôlée, doublon signalé). Puis le prix de vente.
 */
export default function AjouterProduitCatalogue() {
  const pathname = usePathname();
  const estFournisseur = useAuthStore((s) => s.user?.profile === 'FOURNISSEUR');
  const isOnline = useNetworkStore((s) => s.isOnline);
  const produitsQ = useProduits(estFournisseur);
  const catalogueQ = useCatalogueFournisseur();
  const activer = useActiverProduitCatalogue();
  const creer = useCreerEtActiverProduit();
  const reactiver = useReactiverLigneCatalogue();
  const verrou = useRef(creerVerrou()).current;

  const [mode, setMode] = useState<Mode>('liste');
  const [recherche, setRecherche] = useState('');
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [designation, setDesignation] = useState('');
  const [prix, setPrix] = useState('');
  const [tente, setTente] = useState(false);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const envoyerPhoto = useUploadPhotoCatalogue();

  const choisirPhoto = async () => {
    const choisie = await pickImage({ aspect: [1, 1] });
    if (!choisie) return;
    const refus = verifierPhotoProduit(choisie);
    setErreurPhoto(refus);
    if (!refus) setPhoto(choisie);
  };

  const lignes = useMemo(() => lignesParProduit(catalogueQ.data), [catalogueQ.data]);
  const resultats = useMemo(
    () => resultatsReferentiel(produitsQ.data, lignes, recherche),
    [produitsQ.data, lignes, recherche],
  );
  const selection = selectionId ? ((produitsQ.data ?? []).find((p) => p.id === selectionId) ?? null) : null;
  const ligneInactive = selection && etatProduit(selection, lignes) === 'inactif' ? lignes.get(selection.id) : undefined;
  const doublon = mode === 'nouveau' ? doublonDe(produitsQ.data, designation) : null;
  const lecturePrix = lirePrixDeVente(prix);
  const erreurNom = erreurDesignation(designation);
  const enCours = activer.isPending || creer.isPending || reactiver.isPending || envoyerPhoto.isPending;
  const aucunSelectionnable = resultats.length > 0 && resultats.every((p) => etatProduit(p, lignes) === 'deja');

  const choisir = (p: ProduitResponse) => {
    if (etatProduit(p, lignes) === 'deja') return;
    setSelectionId(p.id);
    // Réactivation : on part du prix de la ligne, que le fournisseur peut changer.
    const ligne = lignes.get(p.id);
    if (ligne) setPrix(String(ligne.prixDeVente));
  };

  const choisirDoublon = (p: ProduitResponse) => {
    setMode('liste');
    setRecherche(p.designation);
    choisir(p);
  };

  const enregistrer = () => {
    setTente(true);
    if (!lecturePrix.ok) return;
    const prixDeVente = lecturePrix.valeur;
    const options = {
      onSuccess: () => {
        dialog.success(
          mode === 'nouveau'
            ? 'Produit créé et ajouté à ton catalogue'
            : ligneInactive
              ? 'Produit réactivé'
              : 'Produit ajouté à ton catalogue',
        );
        retourParent(pathname);
      },
      onError: (e: unknown) =>
        dialog.error(
          'Erreur',
          extractApiErrorMessage(
            e,
            mode === 'nouveau'
              ? 'Impossible de créer ce produit'
              : ligneInactive
                ? 'Impossible de réactiver ce produit'
                : "Impossible d'ajouter ce produit",
          ),
        ),
    };
    if (mode === 'nouveau') {
      if (erreurNom || doublon) return;
      const fichier = photo;
      lancerUneFois(verrou, (fin) =>
        creer.mutate(
          { designation: nettoyerDesignation(designation), prixDeVente },
          {
            onSuccess: (ligneCreee?: LigneCatalogueFournisseurResponse) => {
              if (!fichier || !ligneCreee) {
                options.onSuccess();
                fin();
                return;
              }
              // Le produit est créé : un échec de la photo ne l'annule pas, elle s'ajoute ensuite depuis Modifier.
              envoyerPhoto.mutate(
                { ligneId: ligneCreee.id, uri: fichier.uri, name: fichier.name },
                {
                  onSuccess: options.onSuccess,
                  onError: () => {
                    dialog.warning('Photo non envoyée', MESSAGE_PHOTO_NON_ENVOYEE);
                    retourParent(pathname);
                  },
                  onSettled: fin,
                },
              );
            },
            onError: (e: unknown) => {
              options.onError(e);
              fin();
            },
          },
        ),
      );
      return;
    }
    if (!selection) return;
    lancerUneFois(verrou, (fin) => {
      if (ligneInactive) reactiver.mutate({ pfId: ligneInactive.id, prixDeVente }, { ...options, onSettled: fin });
      else activer.mutate({ produitId: selection.id, prixDeVente }, { ...options, onSettled: fin });
    });
  };

  const peutEnregistrer = (mode === 'nouveau' ? !doublon : !!selection) && !enCours && isOnline;
  const libelleBouton = !isOnline
    ? 'Hors ligne — réessaye en ligne'
    : mode === 'nouveau'
      ? 'Créer'
      : ligneInactive
        ? 'Réactiver'
        : 'Ajouter';
  const rechercheSaisie = recherche.trim();

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Ajouter un produit" subtitle="À ton catalogue" />
      <FormScreen>
        <View className="px-4 pt-2 gap-3">
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            Cherche le produit dans la liste ; s’il n’existe pas encore, crée-le. Renseigne ensuite ton prix de vente.
            La remise livreur se règle par livreur, dans l’onglet Livreurs.
          </Text>

          <View className="flex-row gap-2">
            {(
              [
                ['liste', 'Choisir dans la liste'],
                ['nouveau', 'Créer un nouveau produit'],
              ] as const
            ).map(([valeur, libelle]) => {
              const actif = mode === valeur;
              return (
                <Pressable
                  key={valeur}
                  onPress={() => setMode(valeur)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  className={`flex-1 px-2 py-2 rounded-md border items-center ${
                    actif ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Text className={`text-[12px] font-bold ${actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {libelle}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'liste' ? (
            <View className="gap-2">
              <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Rechercher un produit" />
              {resultats.length === 0 ? (
                <Text className="text-[12px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
                  {produitsQ.isLoading
                    ? 'Chargement des produits…'
                    : produitsQ.isError
                      ? extractApiErrorMessage(produitsQ.error, 'Impossible de charger les produits.')
                      : rechercheSaisie
                        ? `Aucun produit ne correspond à « ${rechercheSaisie} ». Vérifie l’orthographe, ou crée-le avec « Créer un nouveau produit ».`
                        : 'Le référentiel ne contient encore aucun produit : crée le tien avec « Créer un nouveau produit ».'}
                </Text>
              ) : (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                  {resultats.map((p, i) => {
                    const etat = etatProduit(p, lignes);
                    const choisi = p.id === selectionId;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => choisir(p)}
                        disabled={etat === 'deja'}
                        accessibilityRole="button"
                        accessibilityLabel={`Choisir ${p.designation}`}
                        accessibilityState={{ selected: choisi, disabled: etat === 'deja' }}
                        className={`flex-row items-center gap-3 px-3 py-2.5 ${
                          i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                        } ${etat === 'deja' ? 'opacity-50' : 'active:opacity-70'} ${
                          choisi ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''
                        }`}
                      >
                        <ProduitVignette designation={p.designation} photoUrl={p.photoUrl} size={32} />
                        <View className="flex-1">
                          <Text className="font-bold text-slate-900 dark:text-white text-[13px]" numberOfLines={1}>
                            {p.designation}
                          </Text>
                          <Text className="text-[10px] text-slate-500 dark:text-slate-400">{p.code}</Text>
                        </View>
                        {choisi ? (
                          <View className="flex-row items-center gap-1">
                            <Check color="#047857" size={14} />
                            <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Sélectionné</Text>
                          </View>
                        ) : etat === 'deja' ? (
                          <Text className="text-[10px] text-slate-500 dark:text-slate-400">Déjà dans ton catalogue</Text>
                        ) : etat === 'inactif' ? (
                          <Text className="text-[10px] text-amber-700 dark:text-amber-400">Inactif chez toi</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {aucunSelectionnable ? (
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ces produits sont déjà dans ton catalogue. Cherches-en un autre, ou crée-le avec « Créer un nouveau
                  produit ».
                </Text>
              ) : null}
              {ligneInactive ? (
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ce produit est inactif dans ton catalogue : il sera réactivé avec le prix ci-dessous.
                </Text>
              ) : null}
            </View>
          ) : (
            <View>
              <Text className={LABEL}>Désignation *</Text>
              <TextInput
                value={designation}
                onChangeText={setDesignation}
                accessibilityLabel="Désignation"
                placeholder="Ex : Pain maison"
                placeholderTextColor="#94a3b8"
                className={CHAMP}
              />
              {doublon ? (
                <View className="mt-2 gap-2">
                  <Text className="text-[12px] text-red-600 dark:text-red-400">{MESSAGE_DOUBLON_FOURNISSEUR}</Text>
                  <View className="flex-row items-center justify-between gap-2 border border-emerald-600/40 rounded-md px-3 py-2">
                    <Text className="flex-1 text-[13px] text-slate-900 dark:text-white">
                      {doublon.designation} <Text className="text-[10px] text-slate-500">{doublon.code}</Text>
                    </Text>
                    {etatProduit(doublon, lignes) === 'deja' ? (
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">Déjà dans ton catalogue</Text>
                    ) : (
                      <Pressable
                        onPress={() => choisirDoublon(doublon)}
                        accessibilityRole="button"
                        className="border border-emerald-600 rounded-md px-2 py-1 active:opacity-70"
                      >
                        <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          {etatProduit(doublon, lignes) === 'inactif' ? 'Réactiver ce produit' : 'Choisir ce produit'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : tente && erreurNom ? (
                <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{erreurNom}</Text>
              ) : null}

              <Text className={`${LABEL} mt-4`}>Photo (facultative)</Text>
              <View className="flex-row items-center gap-3">
                <ProduitVignette designation={designation} photoUrl={photo?.uri} size={48} />
                <View className="flex-1 gap-1">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">JPEG ou PNG, 10 Mo au plus.</Text>
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => void choisirPhoto()}
                      accessibilityRole="button"
                      accessibilityLabel={photo ? 'Changer la photo' : 'Choisir une photo'}
                      className="active:opacity-70"
                    >
                      <Text className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                        {photo ? 'Changer la photo' : 'Choisir une photo'}
                      </Text>
                    </Pressable>
                    {photo ? (
                      <Pressable
                        onPress={() => {
                          setPhoto(null);
                          setErreurPhoto(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Retirer la photo"
                        className="active:opacity-70"
                      >
                        <Text className="text-[12px] font-bold text-red-600 dark:text-red-400">Retirer la photo</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {erreurPhoto ? (
                    <Text accessibilityRole="alert" className="text-[12px] text-red-600 dark:text-red-400">
                      {erreurPhoto}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {mode === 'nouveau' || selection ? (
            <View>
              <Text className={LABEL}>Prix de vente au livreur (FCFA) *</Text>
              <TextInput
                value={prix}
                onChangeText={setPrix}
                keyboardType="decimal-pad"
                accessibilityLabel="Prix de vente au livreur"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                className={CHAMP}
              />
              {tente && !lecturePrix.ok ? (
                <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{lecturePrix.erreur}</Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={enregistrer}
            disabled={!peutEnregistrer}
            accessibilityRole="button"
            accessibilityLabel={libelleBouton}
            className={`rounded-md py-3.5 mt-2 items-center ${
              peutEnregistrer || enCours ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          >
            {enCours ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${peutEnregistrer ? 'text-white' : 'text-slate-400'}`}>
                {libelleBouton}
              </Text>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
