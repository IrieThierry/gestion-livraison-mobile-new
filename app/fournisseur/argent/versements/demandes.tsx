import { EcranDemandesModif } from '../../../../components/versements/DemandesModifVersement';
import {
  useApprouverDemandeModif,
  useDemandesModif,
  useRejeterDemandeModif,
} from '../../../../features/demandes-modif/hooks';
import { useVersementsFournisseur } from '../../../../features/fournisseur/hooks';
import { useAuthStore } from '../../../../stores/authStore';

/**
 * F2 : demandes de modification de versement du fournisseur
 * (`/fournisseur/me/demandes-modif-versement`), même écran que le livreur :
 * une demande d'un livreur s'approuve, ou se rejette avec un motif ; les
 * siennes attendent la décision du livreur. Historique des demandes décidées.
 */
export default function DemandesModifFournisseur() {
  const estFournisseur = useAuthStore((s) => s.user?.profile === 'FOURNISSEUR');
  const q = useDemandesModif(estFournisseur, 'fournisseur');
  const versementsQ = useVersementsFournisseur();
  const approuver = useApprouverDemandeModif('fournisseur');
  const rejeter = useRejeterDemandeModif('fournisseur');

  return (
    <EcranDemandesModif
      role="fournisseur"
      demandesQ={q}
      versementsQ={versementsQ}
      approuver={approuver}
      rejeter={rejeter}
      messageVide="Pour corriger un versement, ouvre « Versements reçus » et touche « Demander une modification »."
    />
  );
}
