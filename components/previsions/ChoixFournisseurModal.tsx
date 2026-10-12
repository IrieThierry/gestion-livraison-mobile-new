import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronRight, Store } from 'lucide-react-native';

export interface OptionFournisseur {
  id: string;
  label: string;
}

/** Choix du fournisseur (partenaires du livreur) avant d'ouvrir « Nouvelle commande ». */
export function ChoixFournisseurModal({
  visible,
  options,
  chargement,
  erreur,
  onFermer,
  onChoisir,
}: {
  visible: boolean;
  options: OptionFournisseur[];
  chargement: boolean;
  erreur: string | null;
  onFermer: () => void;
  onChoisir: (id: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={onFermer}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityLabel="Fermer"
        />
        <View
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 self-center w-full"
          style={{ maxWidth: 420, maxHeight: '80%' }}
        >
          <Text className="text-lg font-extrabold text-slate-900 dark:text-white">Choisir le fournisseur</Text>
          <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 mb-3">
            La commande est préremplie avec le cumul des produits qu’il propose.
          </Text>
          <ScrollView>
            {chargement ? (
              <Text className="text-slate-400 text-sm">Chargement…</Text>
            ) : erreur ? (
              <Text className="text-red-500 text-sm">{erreur}</Text>
            ) : options.length === 0 ? (
              <Text className="text-slate-400 text-sm">Aucun fournisseur partenaire.</Text>
            ) : (
              <View className="gap-2">
                {options.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => onChoisir(o.id)}
                    accessibilityRole="button"
                    className="flex-row items-center gap-3 border border-slate-200 dark:border-slate-800 rounded-lg p-3 active:opacity-70"
                  >
                    <Store color="#8b5cf6" size={18} />
                    <Text className="flex-1 font-bold text-slate-900 dark:text-white">{o.label}</Text>
                    <ChevronRight color="#94a3b8" size={16} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
          <Pressable
            onPress={onFermer}
            className="rounded-md py-3 items-center border border-slate-200 dark:border-slate-700 mt-4 active:opacity-70"
          >
            <Text className="font-bold text-slate-600 dark:text-slate-300">Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
