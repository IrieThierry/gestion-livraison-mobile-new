import { EcranDepenses } from '../../../(livreur)/cash/depenses/index';

/** F2 : dépenses du fournisseur (mêmes routes `/depense` que le web), sans sélecteur d'équipe. */
export default function DepensesFournisseur() {
  return <EcranDepenses options={[]} nouvelle="/fournisseur/argent/depenses/nouvelle" />;
}
