import { EcranChangerMotDePasse } from '../../(livreur)/profil/password';

/** Moi (commis) : « Changer le mot de passe » (même écran que le livreur et le fournisseur). */
export default function ChangerMotDePasseCommis() {
  return <EcranChangerMotDePasse retour="/commis/moi" />;
}
