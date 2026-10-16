import { usePathname } from 'expo-router';
import { EcranNouvelleDepense } from '../../../(livreur)/cash/depenses/nouvelle';
import { retourParent } from '../../../../lib/navigation-app';

/** F2 : nouvelle dépense du fournisseur ; retour à sa liste après l'enregistrement. */
export default function NouvelleDepenseFournisseur() {
  const pathname = usePathname();
  return <EcranNouvelleDepense onEnregistree={() => retourParent(pathname)} />;
}
