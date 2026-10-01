import { create } from 'zustand';

export type DialogVariant = 'success' | 'error' | 'warning' | 'info';

export interface DialogAction {
  label: string;
  /**
   * Style du bouton :
   *  - `primary`   : bouton plein, couleur de la variante (vert/rouge/etc.)
   *  - `secondary` : bouton outline neutre, label gris
   *  - `destructive` : bouton plein rouge (pour confirmations destructives)
   */
  style?: 'primary' | 'secondary' | 'destructive';
  /** Callback exécuté avant la fermeture du modal. */
  onPress?: () => void;
}

export interface ShowDialogParams {
  variant: DialogVariant;
  title: string;
  message?: string;
  /**
   * Boutons à afficher en bas. Si vide ou non renseigné, on met un bouton
   * « OK » primaire qui ferme simplement le dialog.
   */
  actions?: DialogAction[];
  /**
   * Si true (défaut) le dialog se ferme tout seul après quelques secondes.
   * Pratique pour les success transitoires. Mettre à false pour les
   * dialogs qui requièrent une action utilisateur.
   */
  autoDismissMs?: number;
}

interface DialogState extends Partial<ShowDialogParams> {
  open: boolean;
  show: (params: ShowDialogParams) => void;
  hide: () => void;
}

/**
 * Store ZUstand pilotant le dialog modal global de l'app. Le composant
 * `<AppDialog />` (monté dans `app/_layout.tsx`) écoute ce store et rend
 * un modal centré avec icône + titre + message + boutons.
 *
 * On préfère un store global plutôt qu'un Provider/Context : ça permet
 * d'appeler `dialog.success(...)` depuis n'importe où (callbacks,
 * mutations TanStack Query, etc.) sans avoir à dériver le hook `useContext`.
 */
export const useDialogStore = create<DialogState>((set) => ({
  open: false,
  show: (params) => set({ ...params, open: true }),
  hide: () => set({ open: false }),
}));
