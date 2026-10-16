import { RubriqueEnPreparation } from '../../../components/fournisseur/RubriqueEnPreparation';

/** Onglet Commandes du fournisseur (F2) : écran minimal, rempli par FM2 (liste, détail, actions). */
export default function CommandesFournisseur() {
  return (
    <RubriqueEnPreparation
      titre="Commandes"
      contenu={[
        'Commandes de tes livreurs, filtrées par statut et période.',
        'Confirmer, refuser (avec un motif) ou livrer selon le statut.',
        'Montant estimé, puis montant livré.',
      ]}
    />
  );
}
