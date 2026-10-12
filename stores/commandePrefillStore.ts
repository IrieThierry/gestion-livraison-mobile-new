import { create } from 'zustand';
import type { CumulProduitResponse, UUID } from '../types/api';

/**
 * Préremplissage de « Nouvelle commande » depuis le cumul des prévisions :
 * le fournisseur choisi et le cumul brut de la date affichée. Passé par ce
 * store (jamais par l'URL) et consommé une seule fois par le formulaire.
 */
export interface PrefillCommandeSource {
  fournisseurId: UUID;
  /** Jour du cumul (`yyyy-MM-dd`). */
  jour: string;
  cumul: CumulProduitResponse[];
}

interface CommandePrefillState {
  source: PrefillCommandeSource | null;
  definir: (source: PrefillCommandeSource) => void;
  /** Lit et vide la source (consommée une seule fois). */
  prendre: () => PrefillCommandeSource | null;
}

export const useCommandePrefillStore = create<CommandePrefillState>((set, get) => ({
  source: null,
  definir: (source) => set({ source }),
  prendre: () => {
    const s = get().source;
    if (s) set({ source: null });
    return s;
  },
}));
