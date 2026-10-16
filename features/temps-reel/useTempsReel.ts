import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../../lib/api-url';
import { JetonsSession } from '../../lib/jetons-session';
import { useAuthStore } from '../../stores/authStore';
import { localisationKeys } from '../localisation/keys';
import { notificationKeys } from '../notifications/hooks';
import { ouvrirConnexion } from './connexion';

export { useTempsReelConnecte } from './connexion';

/**
 * À monter une seule fois pour l'utilisateur connecté : socket ouvert, notifications
 * poussées en direct. Arrière-plan : socket fermé ; retour au premier plan : reconnexion.
 */
export function useTempsReel(): void {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!userId) return;
    const connexion = ouvrirConnexion({
      apiBase: API_BASE_URL,
      lireToken: () => JetonsSession.get('access_token'),
      // Ce qui a été créé entre la dernière relecture et « pret » n'a été ni relu (polling) ni poussé : on relit.
      onPret: () => {
        void qc.invalidateQueries({ queryKey: notificationKeys.all });
        void qc.invalidateQueries({ queryKey: localisationKeys.all });
      },
      onNotification: ({ notificationType }) => {
        void qc.invalidateQueries({ queryKey: notificationKeys.all });
        if (notificationType.startsWith('DEMANDE_LOCALISATION') || notificationType.startsWith('LOCALISATION_')) {
          void qc.invalidateQueries({ queryKey: localisationKeys.all });
        }
      },
    });
    if (AppState.currentState === 'background') connexion.mettreEnPause();
    const abonnement = AppState.addEventListener('change', (etat: AppStateStatus) => {
      if (etat === 'background') connexion.mettreEnPause();
      else if (etat === 'active') connexion.reprendre();
    });
    return () => {
      abonnement.remove();
      connexion.fermer();
    };
  }, [userId, qc]);
}
