import { RubriqueEnPreparation } from '../../../components/fournisseur/RubriqueEnPreparation';

/** Onglet Argent du fournisseur (F2) : écran minimal, rempli par FM3 (versements, reversements, dépenses). */
export default function ArgentFournisseur() {
  return (
    <RubriqueEnPreparation
      titre="Argent"
      contenu={[
        'Versements reçus : liste et enregistrement.',
        'Demandes de modification de versement : approuver, rejeter ou en faire une.',
        'Reversements des remises et dépenses.',
      ]}
    />
  );
}
