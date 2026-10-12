import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { abonnementApi } from './api';

export const abonnementKeys = {
  all: ['abonnement'] as const,
  me: (userId: string) => ['abonnement', 'me', userId] as const,
};

/**
 * Abonnement effectif de l'utilisateur connecté. Relu comme les autres
 * requêtes (retour au premier plan, tirer pour rafraîchir sur l'Accueil) :
 * un abonnement repassé en ACTIF par l'admin fait disparaître le bandeau.
 */
export function useMonAbonnement() {
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  return useQuery({
    queryKey: abonnementKeys.me(userId),
    queryFn: abonnementApi.monAbonnement,
    enabled: !!userId,
  });
}
