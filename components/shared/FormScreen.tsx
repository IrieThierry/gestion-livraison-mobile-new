import { forwardRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Marge basse par défaut : le dernier champ et le bouton restent atteignables. */
export const FORM_PADDING_BOTTOM = 120;

const IOS = Platform.OS === 'ios';

type Props = Omit<ScrollViewProps, 'contentContainerStyle'> & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Décalage vertical si un en-tête fixe est rendu au-dessus. */
  keyboardVerticalOffset?: number;
};

/**
 * Conteneur de formulaire : le clavier ne masque plus les champs du bas.
 *
 * - Android : KeyboardAvoidingView `height`. L'app est edge-to-edge (SDK 54) :
 *   la fenêtre n'est plus redimensionnée par `adjustResize`, c'est donc la vue
 *   qui se réduit de la hauteur du clavier.
 * - iOS : `automaticallyAdjustKeyboardInsets` sur le ScrollView (inset bas =
 *   hauteur du clavier + défilement jusqu'au champ actif). Le
 *   KeyboardAvoidingView (`padding`) y est désactivé : combiné à ces insets
 *   (calculés sur le cadre AVANT réduction), il doublerait l'espace.
 * - ScrollView : `keyboardShouldPersistTaps="handled"` (un appui sur un bouton
 *   n'est pas absorbé par la fermeture du clavier), `keyboardDismissMode`
 *   `on-drag`, et une marge basse pour le dernier champ + le bouton.
 *
 * L'en-tête (PageHeader) se place AVANT FormScreen, dans la vue racine.
 */
export const FormScreen = forwardRef<ScrollView, Props>(function FormScreen(
  { children, contentContainerStyle, keyboardVerticalOffset = 0, ...scrollProps },
  ref,
) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={IOS ? 'padding' : 'height'}
      enabled={!IOS}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={IOS}
        {...scrollProps}
        contentContainerStyle={[{ paddingBottom: FORM_PADDING_BOTTOM }, contentContainerStyle]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
});
