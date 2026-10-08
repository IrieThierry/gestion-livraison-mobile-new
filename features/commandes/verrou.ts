/**
 * Verrou synchrone contre le double envoi (double tap avant le rendu qui
 * affiche `isPending`) : un seul envoi à la fois, libéré à la fin.
 */
export interface Verrou {
  enCours: boolean;
}

export const creerVerrou = (): Verrou => ({ enCours: false });

/**
 * Lance `demarrer` si le verrou est libre. `demarrer` reçoit `fin`, à appeler
 * quand l'envoi est terminé (succès ou échec). Renvoie faux si ignoré.
 */
export function lancerUneFois(verrou: Verrou, demarrer: (fin: () => void) => void): boolean {
  if (verrou.enCours) return false;
  verrou.enCours = true;
  demarrer(() => {
    verrou.enCours = false;
  });
  return true;
}
