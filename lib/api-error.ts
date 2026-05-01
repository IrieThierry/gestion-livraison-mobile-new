/**
 * Convertit une erreur backend en message lisible côté UI.
 *
 * Le back renvoie souvent des messages techniques (stacktrace, SQL
 * brut), surtout pour les violations de contrainte d'unicité Postgres.
 * On détecte ces patterns et on les traduit en français clair.
 *
 * Fallback : on tente d'extraire `response.data.message`, sinon on
 * renvoie `defaultMsg`.
 */
export function extractApiErrorMessage(
  err: unknown,
  defaultMsg = 'Une erreur est survenue',
): string {
  const e = err as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };

  const raw =
    e?.response?.data?.message ??
    e?.response?.data?.error ??
    e?.message ??
    '';

  // Pattern PostgreSQL : duplicate key value violates unique constraint
  // Détail : `Key (X)=(value) already exists.`
  const dupMatch = raw.match(
    /duplicate key.+constraint\s+"([^"]+)".+Key \(([^)]+)\)=\(([^)]+)\)/i,
  );
  if (dupMatch) {
    const [, constraint, field, value] = dupMatch;
    // Mapping des contraintes connues vers messages français
    if (constraint.includes('username')) {
      return `Le nom d'utilisateur "${value}" est déjà pris. Choisis-en un autre.`;
    }
    if (constraint.includes('email')) {
      return `L'email "${value}" est déjà utilisé.`;
    }
    if (constraint.includes('contact')) {
      return `Ce numéro de téléphone est déjà utilisé.`;
    }
    return `La valeur "${value}" pour ${field} existe déjà.`;
  }

  // Pattern : violation de clé étrangère
  if (raw.includes('foreign key constraint')) {
    return 'Référence introuvable. Recharge l\'app et réessaye.';
  }

  // Pattern : NOT NULL violation
  const nullMatch = raw.match(/null value in column "([^"]+)"/i);
  if (nullMatch) {
    return `Le champ "${nullMatch[1]}" est obligatoire.`;
  }

  // Pas de pattern reconnu → on garde le message s'il est court (probablement
  // un message métier propre du back), sinon on renvoie le défaut
  if (raw && raw.length < 200) {
    return raw;
  }
  return defaultMsg;
}
