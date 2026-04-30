import { useEffect, useState } from 'react';
import { View, Pressable, Text, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, router } from 'expo-router';
import {
  TrendingUp,
  Truck,
  Banknote,
  User,
  Plus,
  Package,
  RotateCcw,
  X,
} from 'lucide-react-native';
import { OfflineBanner } from '../../components/shared/OfflineBanner';
import { useNetworkStore } from '../../stores/networkStore';

function FabSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable
          onPress={() => {}}
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl p-6 pb-10"
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Action rapide
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X color="#64748b" size={20} />
            </Pressable>
          </View>
          <View className="gap-2">
            <Pressable
              onPress={() => go('/(livreur)/livraisons/nouvelle')}
              className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg active:opacity-70"
            >
              <Truck color="#10b981" size={22} />
              <Text className="font-bold text-slate-900 dark:text-white">Nouvelle livraison</Text>
            </Pressable>
            <Pressable
              onPress={() => go('/(livreur)/cash/retour-client')}
              className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg active:opacity-70"
            >
              <RotateCcw color="#3b82f6" size={22} />
              <Text className="font-bold text-slate-900 dark:text-white">Retour client</Text>
            </Pressable>
            <Pressable
              onPress={() => go('/(livreur)/stock/declarer')}
              className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg active:opacity-70"
            >
              <Package color="#10b981" size={22} />
              <Text className="font-bold text-slate-900 dark:text-white">Déclarer stock</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function LivreurLayout() {
  const [fabOpen, setFabOpen] = useState(false);
  const startWatching = useNetworkStore((s) => s.startWatching);

  useEffect(() => {
    startWatching();
  }, []);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <View className="flex-1">
        <Tabs
          initialRouteName="index"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#10b981',
            tabBarInactiveTintColor: '#94a3b8',
            tabBarStyle: { borderTopWidth: 1, borderTopColor: '#e2e8f0', height: 60 },
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
            tabBarItemStyle: { paddingVertical: 4 },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Tournée',
              tabBarIcon: ({ color }) => <TrendingUp color={color} size={22} />,
            }}
          />
          <Tabs.Screen
            name="livraisons"
            options={{
              title: 'Livraisons',
              tabBarIcon: ({ color }) => <Truck color={color} size={22} />,
            }}
          />
          <Tabs.Screen
            name="stock"
            options={{
              title: 'Stock',
              tabBarIcon: ({ color }) => <Package color={color} size={22} />,
            }}
          />
          <Tabs.Screen
            name="cash"
            options={{
              title: 'Cash',
              tabBarIcon: ({ color }) => <Banknote color={color} size={22} />,
            }}
          />
          <Tabs.Screen
            name="profil"
            options={{
              title: 'Profil',
              tabBarIcon: ({ color }) => <User color={color} size={22} />,
            }}
          />
          <Tabs.Screen name="clients" options={{ href: null }} />
        </Tabs>

        {/* Floating FAB above the tab bar */}
        <Pressable
          onPress={() => setFabOpen(true)}
          className="absolute right-5 bottom-20 w-14 h-14 rounded-full bg-emerald-500 items-center justify-center active:opacity-80"
          style={{
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
          }}
          hitSlop={6}
        >
          <Plus color="#fff" size={28} strokeWidth={2.5} />
        </Pressable>
      </View>
      <FabSheet open={fabOpen} onClose={() => setFabOpen(false)} />
    </SafeAreaView>
  );
}
