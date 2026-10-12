import { ScrollView, View, Text, Pressable } from 'react-native';
import { ChevronRight, Truck, Banknote, Package, Store, Wallet } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { famillesVisibles, type FamilleEtat } from '../../../../features/etats/acces';
import { useAuthStore } from '../../../../stores/authStore';
import { naviguer } from '../../../../lib/navigation-app';

const ICONES: Record<FamilleEtat, { icon: React.ComponentType<{ color: string; size: number }>; color: string }> = {
  ventes: { icon: Truck, color: '#10b981' },
  encaissements: { icon: Banknote, color: '#3b82f6' },
  stock: { icon: Package, color: '#f59e0b' },
  fournisseurs: { icon: Store, color: '#8b5cf6' },
  depenses: { icon: Wallet, color: '#ef4444' },
};

/**
 * Menu « États » : une carte par famille. L'apprenti n'a pas la carte
 * « Fournisseurs et versements ». Chaque carte ouvre l'aperçu de l'état.
 */
export default function Etats() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const familles = famillesVisibles(user);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="États" subtitle="Aperçu et PDF à partager" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3 gap-2">
          {familles.map((f) => {
            const { icon: Icon, color } = ICONES[f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => naviguer(`/(livreur)/profil/etats/${f.key}`)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
                  <Icon color={color} size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-white">{f.titre}</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">{f.description}</Text>
                </View>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
