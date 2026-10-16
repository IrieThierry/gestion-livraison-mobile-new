import { EcranChangerMotDePasse } from '../../(livreur)/profil/password';

/** F2, Moi : « Changer le mot de passe » (même écran que le livreur). */
export default function ChangerMotDePasseFournisseur() {
  return <EcranChangerMotDePasse retour="/fournisseur/moi" />;
}
