import { useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useApprentis } from '../apprentis/hooks';
import { estMembreOrganisation } from '../organisation/regles';
import { optionsLivreurCloture, type OptionLivreurCloture } from './regles';

/**
 * N6 : livreurs que l'utilisateur peut clôturer (« Moi », puis ses apprentis
 * actifs s'il est livreur principal ; jamais les commerciaux d'une organisation).
 */
export function useOptionsLivreurCloture(): OptionLivreurCloture[] {
  const user = useAuthStore((s) => s.user);
  const qApprentis = useApprentis();
  const membre = estMembreOrganisation(user);
  return useMemo(
    () => optionsLivreurCloture(user, membre ? [] : qApprentis.data),
    [user, membre, qApprentis.data],
  );
}
