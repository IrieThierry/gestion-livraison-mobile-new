import { useLocalSearchParams } from 'expo-router';
import { DetailCommandeFournisseur } from '../../../components/fournisseur/CommandeFournisseur';

/** F2 : détail d'une commande reçue (liste Commandes, notification « commande reçue »). */
export default function CommandeFournisseur() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DetailCommandeFournisseur id={id} />;
}
