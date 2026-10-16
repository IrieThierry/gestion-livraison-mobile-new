import { Pressable, Text } from 'react-native';
import { Navigation } from 'lucide-react-native';
import { ouvrirItineraire } from '../../lib/linking';
import { lirePosition } from '../../lib/position';

/** Bouton « Itinéraire » : Google Maps ou Waze vers une position `"lat,lng"`. Rien si la position est invalide. */
export function BoutonItineraire({ position }: { position: string | null | undefined }) {
  if (!lirePosition(position)) return null;
  return (
    <Pressable
      onPress={() => ouvrirItineraire(position as string)}
      accessibilityRole="button"
      accessibilityLabel="Itinéraire"
      className="flex-row items-center justify-center gap-1.5 rounded-md px-3 py-2 border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 active:opacity-70"
    >
      <Navigation color="#3b82f6" size={14} />
      <Text className="font-bold text-[12px] text-blue-700 dark:text-blue-400">Itinéraire</Text>
    </Pressable>
  );
}
