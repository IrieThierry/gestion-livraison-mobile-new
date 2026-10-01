import { useDialogStore, type DialogAction } from '../stores/dialogStore';

/**
 * Helper de plus haut niveau pour ouvrir le dialog modal global de l'app.
 *
 * Préférer ces helpers au lieu de `Alert.alert(...)` :
 *  - rendu cohérent en dark/light mode
 *  - icône colorée par variante
 *  - boutons stylisés (primary / secondary / destructive)
 *  - auto-dismiss optionnel pour les success transitoires
 *
 * Exemples :
 *
 *   dialog.success('Livraison enregistrée')
 *   dialog.error('Échec', 'Stock insuffisant pour Pain de mie')
 *   dialog.confirm({
 *     title: 'Supprimer ?',
 *     message: 'Cette action est irréversible.',
 *     confirmLabel: 'Supprimer',
 *     destructive: true,
 *     onConfirm: () => mut.mutate(...),
 *   })
 */
export const dialog = {
  /** Notification de succès. Auto-dismiss 1.8 s par défaut. */
  success(title: string, message?: string, opts?: { autoDismissMs?: number; actions?: DialogAction[] }) {
    useDialogStore.getState().show({
      variant: 'success',
      title,
      message,
      autoDismissMs: opts?.autoDismissMs ?? 1800,
      actions: opts?.actions,
    });
  },

  /** Erreur. Reste affiché jusqu'à ce que l'utilisateur tape OK. */
  error(title: string, message?: string, opts?: { actions?: DialogAction[] }) {
    useDialogStore.getState().show({
      variant: 'error',
      title,
      message,
      actions: opts?.actions,
    });
  },

  /** Avertissement non bloquant (ex : « stock bientôt épuisé »). */
  warning(title: string, message?: string, opts?: { autoDismissMs?: number; actions?: DialogAction[] }) {
    useDialogStore.getState().show({
      variant: 'warning',
      title,
      message,
      autoDismissMs: opts?.autoDismissMs,
      actions: opts?.actions,
    });
  },

  /** Info pédagogique sans danger. */
  info(title: string, message?: string, opts?: { autoDismissMs?: number; actions?: DialogAction[] }) {
    useDialogStore.getState().show({
      variant: 'info',
      title,
      message,
      autoDismissMs: opts?.autoDismissMs,
      actions: opts?.actions,
    });
  },

  /**
   * Boîte de confirmation type « Annuler / Confirmer » avec callback.
   * Remplace les `Alert.alert(t, m, [{ ... }, { ... }])` typiques.
   */
  confirm(params: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }) {
    useDialogStore.getState().show({
      variant: params.destructive ? 'error' : 'warning',
      title: params.title,
      message: params.message,
      actions: [
        {
          label: params.cancelLabel ?? 'Annuler',
          style: 'secondary',
          onPress: params.onCancel,
        },
        {
          label: params.confirmLabel ?? 'Confirmer',
          style: params.destructive ? 'destructive' : 'primary',
          onPress: params.onConfirm,
        },
      ],
    });
  },

  /** Ferme le dialog manuellement. */
  hide() {
    useDialogStore.getState().hide();
  },
};
