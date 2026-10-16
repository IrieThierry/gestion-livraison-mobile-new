import { View } from 'react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { EcranDemandesModif } from '../../../../components/versements/DemandesModifVersement';
import {
  useApprouverDemandeModif,
  useDemandesModif,
  useRejeterDemandeModif,
} from '../../../../features/demandes-modif/hooks';
import { useVersementsLivreur } from '../../../../features/versements/hooks';
import { useAuthStore } from '../../../../stores/authStore';

/**
 * N7 : « Demandes de modification » de versement du livreur principal
 * (`/livreur/me/demandes-modif-versement`). En attente : avant → après de
 * chaque champ demandé ; une demande du fournisseur s'approuve, ou se rejette
 * avec un motif obligatoire. Historique des demandes décidées. Écran partagé
 * avec le fournisseur (components/versements/DemandesModifVersement).
 */
export default function DemandesModification() {
  const user = useAuthStore((s) => s.user);
  const estPrincipal = !!user && !user.parentId;
  const q = useDemandesModif(estPrincipal);
  const qVersements = useVersementsLivreur(estPrincipal ? user?.id : undefined);
  const approuver = useApprouverDemandeModif();
  const rejeter = useRejeterDemandeModif();

  if (!user) return null;

  if (!estPrincipal) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Demandes de modification" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal gère les versements aux fournisseurs."
        />
      </View>
    );
  }

  return (
    <EcranDemandesModif
      role="livreur"
      demandesQ={q}
      versementsQ={qVersements}
      approuver={approuver}
      rejeter={rejeter}
      messageVide="Pour corriger un versement, ouvre « Mes versements » et touche « Demander une modification »."
    />
  );
}
