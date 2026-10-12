import { create } from 'zustand';

/**
 * Reçu de reversement en préparation (lecture du détail de la période et
 * génération du PDF) : identifiant du reversement, ou null. Lu par le bandeau
 * « Préparation du reçu… » et par le bouton « Reçu » de l'historique.
 */
interface RecuState {
  preparation: string | null;
  setPreparation: (id: string | null) => void;
}

export const useRecuStore = create<RecuState>()((set) => ({
  preparation: null,
  setPreparation: (id) => set({ preparation: id }),
}));
