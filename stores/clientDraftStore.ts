import { create } from 'zustand';

export interface ClientDraft {
  prenom: string;
  nom: string;
  contact: string;
  email: string;
  adresse: string;
  quartierId: string | null;
  categorieId: string | null;
  prixDeVenteParDefaut: string;
  avecRemise: boolean;
}

export const EMPTY_DRAFT: ClientDraft = {
  prenom: '',
  nom: '',
  contact: '',
  email: '',
  adresse: '',
  quartierId: null,
  categorieId: null,
  prixDeVenteParDefaut: '0',
  avecRemise: false,
};

interface ClientDraftState {
  draft: ClientDraft;
  hasDraft: boolean;
  setDraft: (next: ClientDraft) => void;
  reset: () => void;
}

/**
 * Holds the in-flight 'Nouveau client' form between step 1 (info) and
 * step 2 (geoloc + confirmation). Survives back-swipe; cleared on submit.
 */
export const useClientDraftStore = create<ClientDraftState>((set) => ({
  draft: EMPTY_DRAFT,
  hasDraft: false,
  setDraft: (next) => set({ draft: next, hasDraft: true }),
  reset: () => set({ draft: EMPTY_DRAFT, hasDraft: false }),
}));
