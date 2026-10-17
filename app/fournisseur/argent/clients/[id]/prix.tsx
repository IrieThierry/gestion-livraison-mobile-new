import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../../components/shared/FormScreen';
import { EmptyState } from '../../../../../components/shared/EmptyState';
import { ProduitVignette } from '../../../../../components/shared/ProduitVignette';
import {
  lirePrixClient,
  useClientsFournisseur,
  useFixerPrixClient,
  usePrixClient,
  useRetirerPrixClient,
} from '../../../../../features/fournisseur/clients';
import { creerVerrou, lancerUneFois } from '../../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../../stores/networkStore';
import { dialog } from '../../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../../lib/api-error';
import { formatMontant } from '../../../../../lib/format';
import type { PrixClientResponse, UUID } from '../../../../../types/api';

/**
 * Argent → Mes clients → Prix du client : un prix par produit actif du
 * catalogue. Un produit sans prix propre prend le prix de vente du catalogue
 * (signalé sur la ligne). Chaque ligne s'enregistre ou se retire seule.
 */
export default function PrixDuClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = usePrixClient(id);
  const client = useClientsFournisseur().data?.find((c) => c.id === id);
  const lignes = q.data ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={client ? `Prix de ${client.nom}` : 'Prix du client'} subtitle="Remplace le prix du catalogue pour ce client" />
      <FormScreen
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />}
      >
        <View className="px-4 gap-2">
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            Sans prix propre, le prix de vente du catalogue s’applique à ce client. Le prix est figé au moment de chaque sortie.
          </Text>
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm pt-2">Chargement…</Text>
          ) : q.isError ? (
            <View className="pt-2 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(q.error, 'Prix indisponibles')}</Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : lignes.length === 0 ? (
            <EmptyState title="Aucun produit actif dans ton catalogue." />
          ) : (
            lignes.map((l) => <LignePrix key={l.produitFournisseurId} ligne={l} clientId={id!} />)
          )}
        </View>
      </FormScreen>
    </View>
  );
}

function LignePrix({ ligne, clientId }: { ligne: PrixClientResponse; clientId: UUID }) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const mFixer = useFixerPrixClient();
  const mRetirer = useRetirerPrixClient();
  const verrou = useRef(creerVerrou()).current;
  // Dernier prix confirmé par le back : un double appui traité avant la relecture ne renvoie pas le même prix.
  const confirme = useRef<number | null>(ligne.prixClient);
  const [prixConfirme, setPrixConfirme] = useState<number | null>(ligne.prixClient);
  const [saisie, setSaisie] = useState(ligne.prixClient === null ? '' : String(ligne.prixClient));
  const [erreur, setErreur] = useState<string | null>(null);
  const nom = ligne.designation;
  const enCours = mFixer.isPending || mRetirer.isPending;
  const actif = isOnline && !enCours;
  const inchange =
    saisie.trim() === (prixConfirme === null ? '' : String(prixConfirme)) ||
    (prixConfirme !== null && Number(saisie.trim().replace(',', '.')) === prixConfirme);

  const enregistrer = () => {
    if (inchange) return;
    const lecture = lirePrixClient(saisie);
    if (!lecture.ok) {
      setErreur(lecture.erreur);
      return;
    }
    setErreur(null);
    if (lecture.valeur === confirme.current) return;
    const valeur = lecture.valeur;
    lancerUneFois(verrou, (fin) =>
      mFixer.mutate(
        { clientId, pfId: ligne.produitFournisseurId, prix: valeur },
        {
          onSuccess: () => {
            confirme.current = valeur;
            setPrixConfirme(valeur);
            dialog.success('Prix du client enregistré');
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, "Impossible d'enregistrer ce prix")),
          onSettled: fin,
        },
      ),
    );
  };

  const retirer = () => {
    setErreur(null);
    if (confirme.current === null) return;
    lancerUneFois(verrou, (fin) =>
      mRetirer.mutate(
        { clientId, pfId: ligne.produitFournisseurId },
        {
          onSuccess: () => {
            confirme.current = null;
            setPrixConfirme(null);
            setSaisie('');
            dialog.success('Prix du client retiré');
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, 'Impossible de retirer ce prix')),
          onSettled: fin,
        },
      ),
    );
  };

  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <View className="flex-row items-center gap-3">
        <ProduitVignette designation={nom} photoUrl={ligne.photoUrl} size={36} />
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{nom}</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            {prixConfirme === null ? 'Prix du catalogue appliqué' : 'Prix propre à ce client'}
          </Text>
        </View>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">{`Catalogue : ${formatMontant(ligne.prixCatalogue)} F`}</Text>
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
          accessibilityLabel={`Prix de ${nom} pour ce client`}
          placeholder={String(ligne.prixCatalogue)}
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
          {mFixer.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className={`font-bold text-[12px] ${actif && !inchange ? 'text-white' : 'text-slate-400'}`}>Enregistrer</Text>
          )}
        </Pressable>
        <Pressable
          onPress={retirer}
          disabled={!actif || prixConfirme === null}
          accessibilityRole="button"
          accessibilityLabel={`Retirer le prix de ${nom}`}
          className="rounded-md px-3 py-2.5 border border-slate-300 dark:border-slate-700 active:opacity-70"
        >
          <Text className={`font-bold text-[12px] ${actif && prixConfirme !== null ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
            Retirer
          </Text>
        </Pressable>
      </View>
      {erreur ? <Text className="text-red-600 dark:text-red-400 text-[12px] mt-1">{erreur}</Text> : null}
    </View>
  );
}
