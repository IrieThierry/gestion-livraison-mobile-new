import { useEffect, useState } from 'react';

/** Cadence de rafraîchissement de « maintenant » (expirations affichées, boutons réactivés). */
export const INTERVALLE_MAINTENANT_MS = 30_000;

/**
 * Heure courante rafraîchie toutes les 30 s : une demande « en attente » dont l'heure d'expiration
 * passe redevient « Sans réponse » et « Redemander » se réactive, même sans relecture (socket connecté).
 */
export function useMaintenant(): Date {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), INTERVALLE_MAINTENANT_MS);
    return () => clearInterval(t);
  }, []);
  return maintenant;
}
