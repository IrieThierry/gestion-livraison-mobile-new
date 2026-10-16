import { useLocalSearchParams } from 'expo-router';
import { FormulaireVersementRecu } from '../../../../components/fournisseur/FormulaireVersementRecu';

/** F2 : versement reçu de ce livreur (fiche du livreur partenaire). */
export default function VersementRecu() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FormulaireVersementRecu livreurIdFixe={id} />;
}
