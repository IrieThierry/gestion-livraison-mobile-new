import { EcranNotifications } from '../../components/notifications/EcranNotifications';

/**
 * Notifications du commis (cloche des Commandes, entrée de Moi) : même écran
 * que les autres profils. Une remise refusée par un livreur ouvre la commande,
 * où la remise montre le motif (`cibleMobile`, route `commis.commandes`).
 */
export default function NotificationsCommis() {
  return <EcranNotifications aTraiter={null} aTraiterVisible={false} onRafraichir={() => undefined} />;
}
