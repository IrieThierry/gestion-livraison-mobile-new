import { z } from 'zod';

// Aligné sur le portail web : le back attend username/password.
export const loginSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Règles A7 d'un compte, alignées sur le back (`ReglesCompte`) et le web,
 * avec les messages de la spec « Inscription libre et abonnement ».
 */
export const MESSAGES_COMPTE = {
  motDePasse: 'Le mot de passe doit contenir au moins 6 caractères.',
  contact: 'Le numéro doit contenir 10 chiffres.',
  nomLongueur: 'Le nom doit contenir entre 2 et 50 caractères.',
  prenomLongueur: 'Le prénom doit contenir entre 2 et 50 caractères.',
  nomFormat: 'Le nom ne doit contenir que des lettres, espaces, tirets, apostrophes ou points.',
  prenomFormat: 'Le prénom ne doit contenir que des lettres, espaces, tirets, apostrophes ou points.',
  usernameLongueur: "Le nom d'utilisateur doit contenir entre 3 et 50 caractères.",
  inscriptionReussie: 'Compte créé. Vous pouvez vous connecter.',
} as const;

/** Règle existante des noms côté back : lettres, espaces, apostrophes, points, tirets. */
const FORMAT_NOM = /^[\p{L}\s'’.-]*$/u;

const nomPersonne = (longueur: string, format: string) =>
  z
    .string()
    .trim()
    .min(2, longueur)
    .max(50, longueur)
    .regex(FORMAT_NOM, format);

const contact = z.string().trim().regex(/^[0-9]{10}$/, MESSAGES_COMPTE.contact);
const motDePasse = z.string().refine((v) => v.trim().length > 0 && v.length >= 6, MESSAGES_COMPTE.motDePasse);
const email = z
  .union([z.string().trim().email('Email invalide'), z.literal('')])
  .optional()
  .transform((v) => v ?? '');

/**
 * Inscription libre depuis le mobile : livreur seulement (le fournisseur
 * s'inscrit sur le portail web). Le profil envoyé est toujours LIVREUR, même
 * si une autre valeur est passée. `confirmPassword` est vérifié au submit.
 */
export const signupSchema = z
  .object({
    prenom: nomPersonne(MESSAGES_COMPTE.prenomLongueur, MESSAGES_COMPTE.prenomFormat),
    nom: nomPersonne(MESSAGES_COMPTE.nomLongueur, MESSAGES_COMPTE.nomFormat),
    contact,
    email,
    username: z.string().trim().min(3, MESSAGES_COMPTE.usernameLongueur).max(50, MESSAGES_COMPTE.usernameLongueur),
    password: motDePasse,
    confirmPassword: z.string(),
    profile: z.unknown().transform((): 'LIVREUR' => 'LIVREUR'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const updateProfileSchema = z.object({
  prenom: nomPersonne(MESSAGES_COMPTE.prenomLongueur, MESSAGES_COMPTE.prenomFormat),
  nom: nomPersonne(MESSAGES_COMPTE.nomLongueur, MESSAGES_COMPTE.nomFormat),
  contact,
  email,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: motDePasse,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
