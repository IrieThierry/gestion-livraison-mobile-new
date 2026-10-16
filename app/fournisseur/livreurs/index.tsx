import { RubriqueEnPreparation } from '../../../components/fournisseur/RubriqueEnPreparation';

/** Onglet Livreurs du fournisseur (F2) : écran minimal, rempli par FM2 (partenaires, fiche, invitations). */
export default function LivreursFournisseur() {
  return (
    <RubriqueEnPreparation
      titre="Livreurs"
      contenu={[
        'Tes livreurs partenaires : dû, remise par unité, remise à reverser, dernier versement.',
        'Fiche d’un livreur : commandes, remise, prix particuliers, blocage, versement reçu.',
        'Invitations des livreurs : accepter ou refuser.',
      ]}
    />
  );
}
