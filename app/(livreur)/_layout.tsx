import { useEffect, useState } from 'react';
import { View, Pressable, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, router } from 'expo-router';
import {
  TrendingUp,
  Truck,
  User,
  Plus,
  Package,
  RotateCcw,
  Users,
  Wallet,
  X,
  Receipt,
  CalendarClock,
  ClipboardCheck,
} from 'lucide-react-native';
import { OfflineBanner } from '../../components/shared/OfflineBanner';
import { useNetworkStore } from '../../stores/networkStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';

/**
 * Quand l'utilisateur tape un onglet déjà actif, par défaut Expo Router
 * ne fait rien — on reste coincé sur la sous-route. On force ici le pop
 * jusqu'à la racine de la pile interne en redirigeant explicitement vers
 * la page racine de l'onglet.
 *
 * NB : on n'appelle plus `router.dismissAll()` à l'aveugle car ça
 * dispatche `POP_TO_TOP` au niveau du Tabs navigator (qui ne le gère
 * pas) et déclenche un warning dev "POP_TO_TOP was not handled by any
 * navigator". On utilise `canDismiss()` comme garde — qui n'existe que
 * dans Expo Router ≥ 4 — et on tombe en silence si l'API n'est pas
 * dispo.
 */
function popToTopOnReTap(path: string) {
  return ({ navigation }: { navigation: { isFocused?: () => boolean } }) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (!navigation.isFocused?.()) return;
      e.preventDefault();
      try {
        const r = router as unknown as {
          canDismiss?: () => boolean;
          dismissAll?: () => void;
        };
        if (r.canDismiss?.()) {
          r.dismissAll?.();
        }
      } catch {
        /* fail silently — `replace` ci-dessous prend le relais */
      }
      router.replace(path as never);
    },
  });
}

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
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl pt-5 pb-10 px-5"
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Créer
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X color="#64748b" size={20} />
            </Pressable>
          </View>
          <ScrollView className="gap-2" contentContainerStyle={{ gap: 8 }}>
            <FabAction
              icon={Truck}
              iconBg="#d1fae5"
              iconColor="#059669"
              label="Nouvelle livraison"
              hint="Sélectionner client + produits"
              onPress={() => go('/(livreur)/livraisons/nouvelle')}
            />
            <FabAction
              icon={Users}
              iconBg="#d1fae5"
              iconColor="#059669"
              label="Nouveau client"
              hint="Avec capture géoloc"
              onPress={() => go('/(livreur)/clients/nouveau')}
            />
            <FabAction
              icon={Wallet}
              iconBg="#fef3c7"
              iconColor="#b45309"
              label="Nouveau versement"
              hint="Verser à un fournisseur"
              onPress={() => go('/(livreur)/cash/versement')}
            />
            <FabAction
              icon={Package}
              iconBg="#dbeafe"
              iconColor="#1d4ed8"
              label="Déclarer un achat"
              hint="Stock entrant fournisseur"
              onPress={() => go('/(livreur)/stock/declarer')}
            />
            <FabAction
              icon={RotateCcw}
              iconBg="#fce7f3"
              iconColor="#be185d"
              label="Retour client"
              hint="Réincrémente stock + déduit solde"
              onPress={() => go('/(livreur)/cash/retour-client')}
            />
            <FabAction
              icon={Receipt}
              iconBg="#fee2e2"
              iconColor="#dc2626"
              label="Nouvelle dépense"
              hint="Carburant, entretien, autre"
              onPress={() => go('/(livreur)/cash/depenses/nouvelle')}
            />
            <FabAction
              icon={CalendarClock}
              iconBg="#dbeafe"
              iconColor="#3b82f6"
              label="Planifier J+1"
              hint="Prévisions multi-produits par client"
              onPress={() => go('/(livreur)/previsions/nouvelle')}
            />
            <FabAction
              icon={ClipboardCheck}
              iconBg="#fef3c7"
              iconColor="#d97706"
              label="Clôturer la journée"
              hint="Récap CA + écart de caisse"
              onPress={() => go('/(livreur)/clotures/nouvelle')}
            />
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

export default function LivreurLayout() {
  const [fabOpen, setFabOpen] = useState(false);
  const startWatching = useNetworkStore((s) => s.startWatching);
  const user = useAuthStore((s) => s.user);
  const effective = useThemeStore((s) => s.effective);
  const isDark = effective === 'dark';

  useEffect(() => {
    startWatching();
  }, []);

  // Compte en attente de validation : on neutralise le FAB. L'écran
  // d'attente est rendu PAR ONGLET via `PendingValidationGate` placé
  // dans chaque sous-layout métier (clients, livraisons, cash, stock)
  // et dans la page Tournée. La tab bar reste intacte (FAB inclus) —
  // seul le contenu est remplacé.
  const isPending = user?.statut === 'EN_ATTENTE_VALIDATION';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#10b981',
          // Slate-400 light / Slate-500 dark (légèrement plus contrasté sur fond sombre)
          tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
          tabBarStyle: {
            borderTopWidth: 1,
            // Slate-200 light / Slate-800 dark
            borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
            // Bg : blanc light / Slate-900 dark, comme les cards de l'app
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            height: 70,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -3 },
          tabBarItemStyle: { paddingVertical: 6 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Tournée',
            tabBarIcon: ({ color }) => <TrendingUp color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={popToTopOnReTap('/(livreur)')}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: 'Clients',
            tabBarIcon: ({ color }) => <Users color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={popToTopOnReTap('/(livreur)/clients')}
        />
        <Tabs.Screen
          name="fab"
          options={{
            title: '',
            tabBarShowLabel: false,
            tabBarIcon: () => (
              <View
                className="bg-emerald-500 -mt-6 w-14 h-14 rounded-full items-center justify-center"
                style={{
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 10,
                }}
              >
                <Plus color="#fff" size={28} strokeWidth={2.5} />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              // Le compte n'est pas encore validé : on neutralise le FAB.
              // Chaque onglet affiche déjà l'écran « Compte en attente »
              // via `PendingValidationGate` dans son sous-layout.
              if (isPending) return;
              setFabOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="livraisons"
          options={{
            title: 'Livraisons',
            tabBarIcon: ({ color }) => <Truck color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={popToTopOnReTap('/(livreur)/livraisons')}
        />
        <Tabs.Screen
          name="profil"
          options={{
            title: 'Moi',
            tabBarIcon: ({ color }) => <User color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={popToTopOnReTap('/(livreur)/profil')}
        />
        {/* Hidden routes — accessible via FAB sheet, stat cards, links, or programmatic push */}
        <Tabs.Screen name="cash" options={{ href: null }} />
        <Tabs.Screen name="stock" options={{ href: null }} />
        <Tabs.Screen name="previsions" options={{ href: null }} />
        <Tabs.Screen name="clotures" options={{ href: null }} />
      </Tabs>
      <FabSheet open={fabOpen} onClose={() => setFabOpen(false)} />
    </SafeAreaView>
  );
}
