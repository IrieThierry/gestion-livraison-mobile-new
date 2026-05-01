import { z } from 'zod';

// Aligné sur le portail web : le back attend username/password.
export const loginSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Mirror du `signupSchema` du portail web. Email optionnel (peut être chaîne
 * vide). `confirmPassword` est validé au submit (refine ci-dessous).
 */
export const signupSchema = z
  .object({
    prenom: z.string().min(2, 'Prénom trop court'),
    nom: z.string().min(2, 'Nom trop court'),
    contact: z.string().regex(/^[0-9]{10}$/, 'Téléphone : 10 chiffres'),
    email: z
      .union([z.string().email('Email invalide'), z.literal('')])
      .optional()
      .transform((v) => v ?? ''),
    username: z.string().min(3, "Nom d'utilisateur min 3 caractères"),
    password: z.string().min(6, 'Mot de passe min 6 caractères'),
    confirmPassword: z.string(),
    profile: z.enum(['LIVREUR', 'FOURNISSEUR']).default('LIVREUR'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const updateProfileSchema = z.object({
  prenom: z.string().min(2, 'Prénom trop court'),
  nom: z.string().min(2, 'Nom trop court'),
  contact: z.string().regex(/^[0-9]{10}$/, 'Téléphone : 10 chiffres'),
  email: z
    .union([z.string().email('Email invalide'), z.literal('')])
    .optional()
    .transform((v) => v ?? ''),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(6, 'Nouveau mot de passe min 6 caractères'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
