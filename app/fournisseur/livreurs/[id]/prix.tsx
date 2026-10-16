import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  useEnregistrerPrixParticulier,
  useLivreursPartenaires,
  usePrixParticuliersLivreur,
  useSupprimerPrixParticulier,
} from '../../../../features/fournisseur/hooks';
import { lirePrixParticulier, nomLivreur } from '../../../../features/fournisseur/gestion';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatMontant } from '../../../../lib/format';
import type { PrixParticulierLivreurResponse, UUID } from '../../../../types/api';

/**
 * F2 : prix particuliers d'un livreur, produit par produit, sur les produits
 * actifs du catalogue. Chaque ligne s'enregistre ou se retire seule, avec son
 * propre verrou d'envoi. La remise livreur ne change pas.
 */
export default function PrixParticuliersLivreur() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = usePrixParticuliersLivreur(id);
  const partenaire = useLivreursPartenaires().data?.find((p) => p.livreur.id === id);
  const nom = partenaire ? nomLivreur(partenaire.livreur) : undefined;
  const lignes = q.data ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={nom ? `Prix particuliers de ${nom}` : 'Prix particuliers'}
        subtitle="Remplace le prix de base pour ce livreur"
      />
      <FormScreen
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
      >
        <View className="px-4 gap-2">
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            Un prix particulier remplace le prix de base de ce produit pour ce livreur. La remise livreur ne change pas.
          </Text>
          {partenaire?.bloque ? (
            <EmptyState title="Livreur bloqué" message="Débloque-le pour gérer ses prix particuliers." />
          ) : q.isLoading ? (
            <Text className="text-slate-400 text-sm pt-2">Chargement…</Text>
          ) : q.isError ? (
            <View className="pt-2 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {extractApiErrorMessage(q.error, 'Prix particuliers indisponibles')}
              </Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : lignes.length === 0 ? (
            <EmptyState title="Aucun produit actif dans ton catalogue." />
          ) : (
            lignes.map((l) => (
              // Clé sur la valeur enregistrée : la liste relue remonte la ligne, qui repart de la nouvelle valeur.
              <LignePrix key={`${l.produitFournisseurId}-${l.prixParticulier ?? ''}`} ligne={l} livreurId={id!} />
            ))
          )}
        </View>
      </FormScreen>
    </View>
  );
}

function LignePrix({ ligne, livreurId }: { ligne: PrixParticulierLivreurResponse; livreurId: UUID }) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const mEnregistrer = useEnregistrerPrixParticulier();
  const mSupprimer = useSupprimerPrixParticulier();
  const verrou = useRef(creerVerrou()).current;
  // Dernier prix confirmé par le back : un double appui traité avant la liste relue ne renvoie pas le même prix.
  const confirme = useRef<number | null>(ligne.prixParticulier);
  const [prixConfirme, setPrixConfirme] = useState<number | null>(ligne.prixParticulier);
  const [saisie, setSaisie] = useState(ligne.prixParticulier === null ? '' : String(ligne.prixParticulier));
  const [erreur, setErreur] = useState<string | null>(null);
  const nom = ligne.produit.designation;
  const enCours = mEnregistrer.isPending || mSupprimer.isPending;
  const actif = isOnline && !enCours;
  // Rien à enregistrer tant que la saisie vaut le prix déjà enregistré (« 120,0 » compris).
  const inchange =
    saisie.trim() === (prixConfirme === null ? '' : String(prixConfirme)) ||
    (prixConfirme !== null && Number(saisie.trim().replace(',', '.')) === prixConfirme);

  const enregistrer = () => {
    if (inchange) return;
    const lecture = lirePrixParticulier(saisie);
    if (!lecture.ok) {
      setErreur(lecture.erreur);
      return;
    }
    setErreur(null);
    if (lecture.valeur === confirme.current) return;
    const valeur = lecture.valeur;
    lancerUneFois(verrou, (fin) =>
      mEnregistrer.mutate(
        { pfId: ligne.produitFournisseurId, livreurId, prix: valeur },
        {
          onSuccess: () => {
            confirme.current = valeur;
            setPrixConfirme(valeur);
            dialog.success('Prix particulier enregistré');
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, "Impossible d'enregistrer ce prix particulier")),
          onSettled: fin,
        },
      ),
    );
  };

  const retirer = () => {
    setErreur(null);
    if (confirme.current === null) return;
    lancerUneFois(verrou, (fin) =>
      mSupprimer.mutate(
        { pfId: ligne.produitFournisseurId, livreurId },
        {
          onSuccess: () => {
            confirme.current = null;
            setPrixConfirme(null);
            setSaisie('');
            dialog.success('Prix particulier supprimé');
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, 'Impossible de supprimer ce prix particulier')),
          onSettled: fin,
        },
      ),
    );
  };

  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <View className="flex-row justify-between items-start gap-2">
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{nom}</Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400">{ligne.produit.code}</Text>
        </View>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
          Prix de base : <Text className="font-bold">{formatMontant(ligne.prixDeBase)} F</Text>
        </Text>
      </View>
      <View className="flex-row items-center gap-2 mt-2">
        <TextInput
          value={saisie}
          onChangeText={(t) => {
            setSaisie(t);
            if (erreur) setErreur(null);
          }}
          onSubmitEditing={enregistrer}
          keyboardType="decimal-pad"
          accessibilityLabel={`Prix particulier de ${nom}`}
          placeholder={String(ligne.prixDeBase)}
          placeholderTextColor="#94a3b8"
          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-right font-bold"
        />
        <Pressable
          onPress={enregistrer}
          disabled={!actif || inchange}
          accessibilityRole="button"
          accessibilityLabel={`Enregistrer le prix de ${nom}`}
          className={`rounded-md px-3 py-2.5 ${actif && !inchange ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'}`}
        >
          {mEnregistrer.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className={`font-bold text-[12px] ${actif && !inchange ? 'text-white' : 'text-slate-400'}`}>
              Enregistrer
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={retirer}
          disabled={!actif || prixConfirme === null}
          accessibilityRole="button"
          accessibilityLabel={`Retirer le prix de ${nom}`}
          className="rounded-md px-3 py-2.5 border border-slate-300 dark:border-slate-700 active:opacity-70"
        >
          <Text
            className={`font-bold text-[12px] ${
              actif && prixConfirme !== null ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'
            }`}
          >
            Retirer
          </Text>
        </Pressable>
      </View>
      {erreur ? <Text className="text-red-600 dark:text-red-400 text-[12px] mt-1">{erreur}</Text> : null}
    </View>
  );
}
