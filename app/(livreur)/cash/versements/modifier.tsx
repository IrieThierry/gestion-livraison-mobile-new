import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { EcranDemanderModif } from '../../../../components/versements/DemandesModifVersement';
import { useVersementsLivreur } from '../../../../features/versements/hooks';
import { useCreerDemandeModif } from '../../../../features/demandes-modif/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { useRetourListe } from '../../../../lib/useRetourListe';

/**
 * N7 : « Demander une modification » d'un versement (mêmes champs que le web) :
 * nouvelle date de versement, nouveau montant, nouveau commentaire ; un champ
 * laissé vide ne change pas. Motif obligatoire. Le fournisseur doit approuver.
 */
export default function DemanderModificationVersement() {
  const { versementId } = useLocalSearchParams<{ versementId?: string }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const estPrincipal = !!user && !user.parentId;
  const q = useVersementsLivreur(estPrincipal ? user?.id : undefined);
  const m = useCreerDemandeModif();
  const retourListe = useRetourListe('/(livreur)/cash/versements/demandes');

  if (!user) return null;

  if (!estPrincipal) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Demander une modification" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal gère les versements aux fournisseurs."
        />
      </View>
    );
  }

  return (
    <EcranDemanderModif
      role="livreur"
      versement={(q.data ?? []).find((v) => v.id === versementId)}
      versementsQ={q}
      creer={m}
      isOnline={isOnline}
      onEnvoyee={retourListe}
    />
  );
}
