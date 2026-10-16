import { EcranModifierInfos } from '../../(livreur)/profil/infos';

/** F2, Moi : « Modifier mes infos » (même écran que le livreur : infos, téléphone 01/05/07, photo). */
export default function ModifierInfosFournisseur() {
  return <EcranModifierInfos retour="/fournisseur/moi" />;
}
