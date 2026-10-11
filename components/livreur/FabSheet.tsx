import { View, Pressable, Text, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { entreesAccederA } from '../../lib/acceder-a';

/**
 * Feuille du bouton + de la barre d'onglets : menu « Accéder à » vers les
 * listes du livreur (`entreesAccederA`). On pousse la liste : la création se
 * fait depuis la liste (bouton « Nouveau / Nouvelle »), et le retour depuis
 * un formulaire ramène à la liste.
 */
export function FabSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable
          onPress={() => {}}
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl pt-5 pb-10 px-5"
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Accéder à
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
              <X color="#64748b" size={20} />
            </Pressable>
          </View>
          <ScrollView className="gap-2" contentContainerStyle={{ gap: 8 }}>
            {entreesAccederA(user).map((e) => (
              <FabAction
                key={e.cle}
                icon={e.icon}
                iconBg={e.iconBg}
                iconColor={e.iconColor}
                label={e.label}
                hint={e.hint}
                onPress={() => go(e.chemin)}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FabAction({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  hint,
  onPress,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  iconBg: string;
  iconColor: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl active:opacity-70"
    >
      <View
        className="w-10 h-10 rounded-lg items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Icon color={iconColor} size={20} />
      </View>
      <View className="flex-1">
        <Text className="font-extrabold text-slate-900 dark:text-white">{label}</Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</Text>
      </View>
    </Pressable>
  );
}
