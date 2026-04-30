import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { PendingValidationScreen } from './PendingValidationScreen';

/**
 * Wrapper qui remplace le contenu de l'enfant par l'écran « Compte en
 * attente de validation » lorsque `user.statut === 'EN_ATTENTE_VALIDATION'`.
 *
 * Utilisé sur chaque sous-arbre métier livreur (Tournée, Clients,
 * Livraisons, Cash, Stock) — la page Profil n'est volontairement pas
 * gardée pour permettre le changement de mot de passe pendant l'attente.
 *
 * Pourquoi un gate plutôt qu'un overlay absolu ? L'overlay couvrait la
 * portion du FAB qui dépasse au-dessus de la tab bar (`-mt-6`). Le gate
 * remplace seulement le contenu de l'onglet, laissant la barre intacte.
 */
export function PendingValidationGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.statut === 'EN_ATTENTE_VALIDATION') {
    return <PendingValidationScreen />;
  }
  return <>{children}</>;
}
