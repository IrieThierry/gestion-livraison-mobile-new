import { useLocalSearchParams } from 'expo-router';
import { DetailCommandeFournisseur } from '../../../../../components/fournisseur/CommandeFournisseur';

/** F2 : détail d'une commande ouverte depuis les commandes d'un livreur (mêmes actions que l'onglet Commandes). */
export default function CommandeDuLivreur() {
  const { commandeId } = useLocalSearchParams<{ commandeId: string }>();
  return <DetailCommandeFournisseur id={commandeId} />;
}
