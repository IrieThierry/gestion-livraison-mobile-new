import { useLocalSearchParams, usePathname } from 'expo-router';
import { EcranDemanderModif } from '../../../../components/versements/DemandesModifVersement';
import { useVersementsFournisseur } from '../../../../features/fournisseur/hooks';
import { useCreerDemandeModif } from '../../../../features/demandes-modif/hooks';
import { useNetworkStore } from '../../../../stores/networkStore';
import { retourParent } from '../../../../lib/navigation-app';

/**
 * F2 : le fournisseur demande la modification d'un versement reçu (mêmes
 * champs et règles que le web et que le livreur) ; le livreur doit approuver.
 */
export default function DemanderModifFournisseur() {
  const { versementId } = useLocalSearchParams<{ versementId?: string }>();
  const pathname = usePathname();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const q = useVersementsFournisseur();
  const m = useCreerDemandeModif('fournisseur');

  return (
    <EcranDemanderModif
      role="fournisseur"
      versement={(q.data ?? []).find((v) => v.id === versementId)}
      versementsQ={q}
      creer={m}
      isOnline={isOnline}
      onEnvoyee={() => retourParent(pathname)}
    />
  );
}
