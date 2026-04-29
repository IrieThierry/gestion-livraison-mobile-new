import { z } from 'zod';

// Aligné sur le portail web : le back attend username/password.
export const loginSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;
