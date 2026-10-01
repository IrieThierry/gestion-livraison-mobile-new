import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react-native';
import { useDialogStore, type DialogVariant } from '../../stores/dialogStore';

/**
 * Catalogue visuel par variante.
 * - icon       : composant lucide à afficher dans la pastille
 * - color      : couleur principale (icône + bouton primaire)
 * - iconBg     : fond de la pastille en mode clair
 * - iconBgDark : fond de la pastille en mode sombre
 */
const VARIANTS: Record<
  DialogVariant,
  {
    Icon: typeof CheckCircle2;
    color: string;
    iconBg: string;
    iconBgDark: string;
  }
> = {
  success: {
    Icon: CheckCircle2,
    color: '#10b981',
    iconBg: '#d1fae5',
    iconBgDark: 'rgba(16, 185, 129, 0.15)',
  },
  error: {
    Icon: XCircle,
    color: '#ef4444',
    iconBg: '#fee2e2',
    iconBgDark: 'rgba(239, 68, 68, 0.15)',
  },
  warning: {
    Icon: AlertTriangle,
    color: '#f59e0b',
    iconBg: '#fef3c7',
    iconBgDark: 'rgba(245, 158, 11, 0.15)',
  },
  info: {
    Icon: Info,
    color: '#3b82f6',
    iconBg: '#dbeafe',
    iconBgDark: 'rgba(59, 130, 246, 0.15)',
  },
};

/**
 * Modal de notification réutilisable, contrôlé par `useDialogStore`.
 *
 * À monter UNE fois au plus haut niveau de l'arbre (ex : `app/_layout.tsx`),
 * puis utiliser le helper `dialog.success(...)` / `dialog.error(...)` /
 * `dialog.confirm(...)` depuis n'importe où.
 *
 * Visuel :
 *  - overlay sombre + carte centrée
 *  - pastille colorée + icône lucide en haut
 *  - titre gras, message gris
 *  - boutons en bas (1 ou 2)
 *  - animation fade + scale à l'ouverture / fermeture
 *  - auto-dismiss optionnel après N ms
 */
export function AppDialog() {
  const { open, variant, title, message, actions, autoDismissMs, hide } =
    useDialogStore();

  // Animations
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset pour la prochaine ouverture
      fade.setValue(0);
      scale.setValue(0.9);
    }
  }, [open, fade, scale]);

  // Auto-dismiss : ferme automatiquement le dialog après le délai indiqué.
  useEffect(() => {
    if (!open || !autoDismissMs || autoDismissMs <= 0) return;
    const t = setTimeout(() => hide(), autoDismissMs);
    return () => clearTimeout(t);
  }, [open, autoDismissMs, hide]);

  if (!variant) return null;
  const v = VARIANTS[variant];
  const Icon = v.Icon;

  // Boutons : si pas d'actions fournies, on affiche un seul OK primaire qui ferme.
  const buttons =
    actions && actions.length > 0
      ? actions
      : [{ label: 'OK', style: 'primary' as const }];

  const handlePress = (idx: number) => () => {
    const action = buttons[idx];
    // On ferme d'abord pour que le store soit propre quand le callback s'exécute.
    hide();
    // setTimeout 0 pour laisser React rerendre avant d'exécuter l'action
    // (utile si l'action ouvre un autre dialog à la suite).
    setTimeout(() => action?.onPress?.(), 0);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={hide}
      statusBarTranslucent
    >
      {/* Overlay : tap pour fermer (sauf si on a des actions explicites) */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          opacity: fade,
        }}
      >
        <Pressable
          // Si l'utilisateur tape l'overlay → ferme (uniquement si pas
          // d'actions explicites — un confirm doit forcer une décision).
          onPress={() => {
            if (!actions || actions.length === 0) hide();
          }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <Animated.View
          style={{
            transform: [{ scale }],
            width: '100%',
            maxWidth: 380,
          }}
          // bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl
          className="bg-white dark:bg-slate-900 rounded-2xl px-6 pt-6 pb-5 shadow-2xl"
        >
          {/* Pastille icône */}
          <View className="items-center mb-4">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: v.iconBg }}
            >
              <Icon color={v.color} size={32} strokeWidth={2.4} />
            </View>
          </View>

          {/* Titre */}
          <Text className="text-xl font-extrabold text-slate-900 dark:text-white text-center">
            {title}
          </Text>

          {/* Message */}
          {message ? (
            <Text className="text-sm text-slate-600 dark:text-slate-400 text-center mt-2 leading-5">
              {message}
            </Text>
          ) : null}

          {/* Boutons */}
          <View
            className={`mt-5 ${
              buttons.length > 1 ? 'flex-row gap-2' : ''
            }`}
          >
            {buttons.map((b, idx) => {
              const isPrimary = (b.style ?? 'primary') === 'primary';
              const isDestructive = b.style === 'destructive';
              const isSecondary = b.style === 'secondary';

              const bgColor = isDestructive
                ? '#ef4444'
                : isPrimary
                ? v.color
                : undefined; // secondary : pas de bg, juste border

              return (
                <Pressable
                  key={`${b.label}-${idx}`}
                  onPress={handlePress(idx)}
                  className={`flex-1 py-3 rounded-xl items-center active:opacity-80 ${
                    isSecondary
                      ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                      : ''
                  }`}
                  style={
                    bgColor
                      ? {
                          backgroundColor: bgColor,
                          shadowColor: bgColor,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 6,
                          elevation: 4,
                        }
                      : undefined
                  }
                >
                  <Text
                    className={`font-extrabold text-[15px] ${
                      isSecondary
                        ? 'text-slate-700 dark:text-slate-200'
                        : 'text-white'
                    }`}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
