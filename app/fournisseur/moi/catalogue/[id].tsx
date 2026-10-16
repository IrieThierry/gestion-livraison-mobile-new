import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import {
  useCatalogueFournisseur,
  useFournisseurProfil,
  useModifierLigneCatalogue,
  useRenommerProduit,
} from '../../../../features/fournisseur/hooks';
import {
  MESSAGE_DESIGNATION_NON_MODIFIABLE,
  erreurDesignation,
  nettoyerDesignation,
} from '../../../../features/fournisseur/catalogue';
import { lirePrixDeVente } from '../../../../features/fournisseur/gestion';
import { useSupprimerPhotoCatalogue, useUploadPhotoCatalogue } from '../../../../features/photos/hooks';
import { MESSAGE_PHOTO_ADMIN, verifierPhotoProduit } from '../../../../features/produits/photo';
import { pickImage } from '../../../../lib/image-picker';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { dialog } from '../../../../lib/dialog';
import { retourParent } from '../../../../lib/navigation-app';
import type { LigneCatalogueFournisseurResponse } from '../../../../types/api';

const LABEL = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2';
const CHAMP =
  'px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white';

/**
 * F2 : « Modifier le produit » d'une ligne du catalogue, active ou non, comme
 * la fenêtre du web : désignation (si la ligne est renommable) et prix de
 * vente. En cas d'échec partiel, l'écran dit ce qui est déjà enregistré et le
 * nouvel essai ne renvoie que le reste.
 */
export default function ModifierProduitCatalogue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCatalogueFournisseur();
  const ligne = (q.data ?? []).find((l) => l.id === id);

  if (!ligne) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Modifier le produit" />
        {q.isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#047857" />
          </View>
        ) : q.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(q.error, 'Impossible de charger le catalogue.')}
          />
        ) : (
          <EmptyState title="Produit introuvable" message="Ce produit n’est plus dans ton catalogue." />
        )}
      </View>
    );
  }
  // Monté par ligne : les champs partent des valeurs de l'ouverture.
  return <Formulaire key={ligne.id} ligne={ligne} />;
}

function Formulaire({ ligne }: { ligne: LigneCatalogueFournisseurResponse }) {
  const pathname = usePathname();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const renommer = useRenommerProduit();
  const modifier = useModifierLigneCatalogue();
  const verrou = useRef(creerVerrou()).current;
  // Valeurs déjà enregistrées : celles de l'ouverture, puis chaque écriture réussie.
  const [enregistre, setEnregistre] = useState({ designation: ligne.produit.designation, prix: ligne.prixDeVente });
  const [designation, setDesignation] = useState(ligne.produit.designation);
  const [prix, setPrix] = useState(String(ligne.prixDeVente));
  const [tente, setTente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const erreurNom = ligne.renommable ? erreurDesignation(designation) : null;
  const lecture = lirePrixDeVente(prix);
  const enCours = renommer.isPending || modifier.isPending;

  const enregistrer = () => {
    setTente(true);
    if (erreurNom || !lecture.ok) return;
    const nouvelle = nettoyerDesignation(designation);
    const designationChangee = ligne.renommable && nouvelle !== enregistre.designation;
    const prixChange = lecture.valeur !== enregistre.prix;
    if (!designationChangee && !prixChange) {
      retourParent(pathname);
      return;
    }
    // Un seul envoi à la fois (double appui avant le rendu qui affiche l'envoi).
    lancerUneFois(verrou, (fin) => void envoyer(nouvelle, designationChangee, prixChange, lecture.valeur).finally(fin));
  };

  const envoyer = async (nouvelle: string, designationChangee: boolean, prixChange: boolean, prixDeVente: number) => {
    setErreur(null);
    let renomme = false;
    if (designationChangee) {
      try {
        await renommer.mutateAsync({ produitId: ligne.produit.id, designation: nouvelle });
      } catch (e) {
        setErreur(`Désignation refusée : ${extractApiErrorMessage(e, 'renommage impossible')}`);
        return;
      }
      setEnregistre((v) => ({ ...v, designation: nouvelle }));
      renomme = true;
    }
    if (prixChange) {
      try {
        await modifier.mutateAsync({ pfId: ligne.id, prixDeVente });
      } catch (e) {
        const motif = extractApiErrorMessage(e, 'modification impossible');
        setErreur(renomme ? `Désignation enregistrée ; prix refusé : ${motif}` : `Prix refusé : ${motif}`);
        return;
      }
      setEnregistre((v) => ({ ...v, prix: prixDeVente }));
    }
    dialog.success('Catalogue mis à jour');
    retourParent(pathname);
  };

  const desactive = enCours || !isOnline;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Modifier le produit" subtitle={`${ligne.produit.code} · ${ligne.produit.designation}`} />
      <FormScreen>
        <View className="px-4 pt-3 gap-3">
          <PhotoDuProduit ligne={ligne} />
          {!ligne.actif ? (
            <Text className="text-[12px] text-amber-700 dark:text-amber-400">
              Produit inactif : ce prix s’appliquera à la réactivation.
            </Text>
          ) : null}

          <View>
            <Text className={LABEL}>Désignation</Text>
            {ligne.renommable ? (
              <>
                <TextInput
                  value={designation}
                  onChangeText={setDesignation}
                  accessibilityLabel="Désignation"
                  placeholderTextColor="#94a3b8"
                  className={CHAMP}
                />
                {tente && erreurNom ? (
                  <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{erreurNom}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text className={`${CHAMP} text-slate-500 dark:text-slate-400`}>{ligne.produit.designation}</Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {MESSAGE_DESIGNATION_NON_MODIFIABLE}
                </Text>
              </>
            )}
          </View>

          <View>
            <Text className={LABEL}>Prix de vente au livreur (FCFA)</Text>
            <TextInput
              value={prix}
              onChangeText={setPrix}
              keyboardType="decimal-pad"
              accessibilityLabel="Prix de vente au livreur"
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className={CHAMP}
            />
            {tente && !lecture.ok ? (
              <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{lecture.erreur}</Text>
            ) : null}
          </View>

          {erreur ? (
            <Text accessibilityRole="alert" className="text-[13px] text-red-600 dark:text-red-400">
              {erreur}
            </Text>
          ) : null}

          <Pressable
            onPress={enregistrer}
            disabled={desactive}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer"
            className={`rounded-md py-3.5 mt-2 items-center ${
              !isOnline ? 'bg-slate-200 dark:bg-slate-800' : 'bg-emerald-700 active:opacity-80'
            }`}
          >
            {enCours ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${!isOnline ? 'text-slate-400' : 'text-white'}`}>
                {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Enregistrer'}
              </Text>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}

/**
 * Photo du produit, enregistrée dès le choix (comme le web) : modifiable seulement pour un produit
 * créé par ce fournisseur (le back refuse les autres, 403) ; sinon « gérée par l'administrateur ».
 * Profil pas encore lu : rien à côté de la vignette.
 */
function PhotoDuProduit({ ligne }: { ligne: LigneCatalogueFournisseurResponse }) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const profil = useFournisseurProfil().data;
  const envoyer = useUploadPhotoCatalogue();
  const supprimer = useSupprimerPhotoCatalogue();
  const verrou = useRef(creerVerrou()).current;
  const [erreur, setErreur] = useState<string | null>(null);
  const aUnePhoto = !!ligne.produit.photoUrl;
  const modifiable = profil ? ligne.produit.creeParFournisseurId === profil.id : null;
  const enCours = envoyer.isPending || supprimer.isPending;
  const actif = isOnline && !enCours;

  const choisir = async () => {
    const photo = await pickImage({ aspect: [1, 1] });
    if (!photo) return;
    const refus = verifierPhotoProduit(photo);
    if (refus) {
      setErreur(refus);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      envoyer.mutate(
        { ligneId: ligne.id, uri: photo.uri, name: photo.name },
        {
          onSuccess: () => dialog.success('Photo du produit mise à jour'),
          onError: (e: unknown) => setErreur(extractApiErrorMessage(e, 'Envoi de la photo impossible')),
          onSettled: fin,
        },
      ),
    );
  };

  const retirer = () =>
    dialog.confirm({
      title: 'Supprimer la photo ?',
      message: 'Le produit retombera sur son initiale.',
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) => {
          setErreur(null);
          supprimer.mutate(ligne.id, {
            onSuccess: () => dialog.success('Photo supprimée'),
            onError: (e: unknown) => setErreur(extractApiErrorMessage(e, 'Suppression de la photo impossible')),
            onSettled: fin,
          });
        }),
    });

  return (
    <View className="flex-row items-center gap-3">
      <ProduitVignette designation={ligne.produit.designation} photoUrl={ligne.produit.photoUrl} size={56} />
      {modifiable === null ? null : modifiable ? (
        <View className="flex-1 gap-1">
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            JPEG ou PNG, 10 Mo au plus. Enregistrée dès le choix.
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <Pressable
              onPress={() => void choisir()}
              disabled={!actif}
              accessibilityRole="button"
              accessibilityLabel={aUnePhoto ? 'Changer la photo' : 'Choisir une photo'}
              className={actif ? 'active:opacity-70' : 'opacity-40'}
            >
              {envoyer.isPending ? (
                <ActivityIndicator color="#047857" size="small" />
              ) : (
                <Text className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                  {aUnePhoto ? 'Changer la photo' : 'Choisir une photo'}
                </Text>
              )}
            </Pressable>
            {aUnePhoto ? (
              <Pressable
                onPress={retirer}
                disabled={!actif}
                accessibilityRole="button"
                accessibilityLabel="Supprimer la photo"
                className={actif ? 'active:opacity-70' : 'opacity-40'}
              >
                <Text className="text-[12px] font-bold text-red-600 dark:text-red-400">Supprimer la photo</Text>
              </Pressable>
            ) : null}
          </View>
          {erreur ? (
            <Text accessibilityRole="alert" className="text-[12px] text-red-600 dark:text-red-400">
              {erreur}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text className="flex-1 text-[11px] text-slate-500 dark:text-slate-400">{MESSAGE_PHOTO_ADMIN}</Text>
      )}
    </View>
  );
}
