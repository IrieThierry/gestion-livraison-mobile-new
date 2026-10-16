import {
  changePasswordSchema,
  contactValide,
  erreurNomEntreprise,
  FORMAT_CONTACT,
  loginSchema,
  signupSchema,
} from './schemas';

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

  it('accepte un livreur valide ; un profil inconnu (ou absent) devient LIVREUR', () => {
    for (const profile of [undefined, 'LIVREUR', 'ADMIN', 'ENTREPRISE']) {
      const r = signupSchema.safeParse({ ...valide, profile });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.profile).toBe('LIVREUR');
    }
  });

  it('F1 : fournisseur avec le nom de l’entreprise (2 à 100 caractères, espaces retirés), messages du web', () => {
    const r = signupSchema.safeParse({ ...valide, profile: 'FOURNISSEUR', nomEntreprise: '  Boulangerie 2000 ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.profile).toBe('FOURNISSEUR');
      expect(r.data.nomEntreprise).toBe('Boulangerie 2000');
    }
    expect(message({ profile: 'FOURNISSEUR' })).toBe("Le nom de l'entreprise est obligatoire.");
    expect(message({ profile: 'FOURNISSEUR', nomEntreprise: ' A ' })).toBe("Le nom de l'entreprise est obligatoire.");
    expect(message({ profile: 'FOURNISSEUR', nomEntreprise: 'x'.repeat(101) })).toBe(
      "Le nom de l'entreprise ne doit pas dépasser 100 caractères.",
    );
    // Livreur : le nom de l'entreprise n'est pas vérifié.
    expect(message({ profile: 'LIVREUR', nomEntreprise: '' })).toBeNull();
    expect(erreurNomEntreprise('LIVREUR', '')).toBeNull();
    expect(erreurNomEntreprise('FOURNISSEUR', 'AB')).toBeNull();
  });

  it('mot de passe trop court : message de la spec', () => {
    expect(message({ password: '12345', confirmPassword: '12345' })).toBe(
      'Le mot de passe doit contenir au moins 6 caractères.',
    );
  });

  it('R2 : téléphone de 10 chiffres commençant par 01, 05 ou 07, message de la spec', () => {
    const msg = 'Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.';
    for (const ok of ['0112345678', '0512345678', '0712345678', ' 0712345678 ']) {
      expect(message({ contact: ok })).toBeNull();
    }
    for (const ko of ['0212345678', '071234567', '07123456789', '07 12 34 56 78', '07abcdefgh', '']) {
      expect(message({ contact: ko })).toBe(msg);
    }
  });

  it('R2 : contactValide et FORMAT_CONTACT', () => {
    expect(FORMAT_CONTACT.source).toBe('^0[157][0-9]{8}$');
    expect(contactValide('0512345678')).toBe(true);
    expect(contactValide(' 0112345678 ')).toBe(true);
    expect(contactValide('0912345678')).toBe(false);
    expect(contactValide('')).toBe(false);
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
