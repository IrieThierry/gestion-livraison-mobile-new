import { changePasswordSchema, loginSchema, signupSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    const result = loginSchema.safeParse({ username: 'marc.k', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ username: 'marc.k', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects when fields are missing', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('signupSchema (règles A7, profil LIVREUR imposé)', () => {
  const valide = {
    prenom: 'Awa',
    nom: 'Koné',
    contact: '0712345678',
    email: '',
    username: 'awa',
    password: 'secret1',
    confirmPassword: 'secret1',
  };
  const message = (patch: Record<string, unknown>) => {
    const r = signupSchema.safeParse({ ...valide, ...patch });
    return r.success ? null : r.error.issues[0]?.message;
  };

  it('accepte un livreur valide et impose le profil LIVREUR', () => {
    const r = signupSchema.safeParse({ ...valide, profile: 'FOURNISSEUR' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.profile).toBe('LIVREUR');
  });

  it('mot de passe trop court : message de la spec', () => {
    expect(message({ password: '12345', confirmPassword: '12345' })).toBe(
      'Le mot de passe doit contenir au moins 6 caractères.',
    );
  });

  it('téléphone sans 10 chiffres : message de la spec', () => {
    expect(message({ contact: '071234567' })).toBe('Le numéro doit contenir 10 chiffres.');
    expect(message({ contact: '07 12 34 56 78' })).toBe('Le numéro doit contenir 10 chiffres.');
  });

  it('nom et prénom : 2 à 50 caractères, lettres seulement', () => {
    expect(message({ nom: 'K' })).toBe('Le nom doit contenir entre 2 et 50 caractères.');
    expect(message({ prenom: 'x'.repeat(51) })).toBe('Le prénom doit contenir entre 2 et 50 caractères.');
    expect(message({ nom: 'Kone2' })).toBe(
      'Le nom ne doit contenir que des lettres, espaces, tirets, apostrophes ou points.',
    );
    expect(message({ prenom: "Marie-Ange d'Or" })).toBeNull();
  });

  it('username : 3 à 50 caractères', () => {
    expect(message({ username: 'ab' })).toBe("Le nom d'utilisateur doit contenir entre 3 et 50 caractères.");
    expect(message({ username: 'a'.repeat(51) })).toBe(
      "Le nom d'utilisateur doit contenir entre 3 et 50 caractères.",
    );
  });

  it('email facultatif, format vérifié s’il est saisi', () => {
    expect(message({ email: '' })).toBeNull();
    expect(message({ email: 'pas-un-email' })).toBe('Email invalide');
  });

  it('confirmation différente : refusée', () => {
    expect(message({ confirmPassword: 'autre12' })).toBe('Les mots de passe ne correspondent pas');
  });
});

describe('changePasswordSchema', () => {
  it('nouveau mot de passe trop court : message de la spec', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: '123', confirmPassword: '123' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Le mot de passe doit contenir au moins 6 caractères.');
  });
});
