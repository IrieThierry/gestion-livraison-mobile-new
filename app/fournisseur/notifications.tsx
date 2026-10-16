import { EcranNotifications } from '../../components/notifications/EcranNotifications';
import { ListeATraiter, useATraiterFournisseur } from '../../components/fournisseur/ATraiterFournisseur';
import { ouvrir } from '../../lib/navigation-app';

/**
 * F2 : Notifications du fournisseur (cloche de l'Accueil, entrée de Moi) :
 * même écran que le livreur (N8, fil façon Facebook), avec en « À traiter »
 * ses commandes à confirmer, ses invitations et ses demandes de modification
 * de versement. Un appui sur une notification ouvre l'écran de l'espace
 * fournisseur (`cibleMobile`, routes `fournisseur.*`).
 */
export default function NotificationsFournisseur() {
  const aTraiter = useATraiterFournisseur();
  const visible = aTraiter.taches.length > 0 || aTraiter.erreurs.length > 0;
  return (
    <EcranNotifications
      onRafraichir={aTraiter.relire}
      aTraiterVisible={visible}
      aTraiterEnChargement={aTraiter.enChargement}
      aTraiter={<ListeATraiter taches={aTraiter.taches} erreurs={aTraiter.erreurs} onOuvrir={(t) => ouvrir(t.lien)} />}
    />
  );
}
