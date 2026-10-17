import { useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, Tabs } from 'expo-router';
import { BarChart3, ClipboardList, Store, User } from 'lucide-react-native';
import { accueilDuProfil, estProfilCommis } from '../../lib/navigation';
import { useRetourMateriel } from '../../lib/navigation-app';
import { listenersRacineOnglet } from '../../lib/onglets';
import { OfflineBanner } from '../../components/shared/OfflineBanner';
import { useNombreNonLues } from '../../features/notifications/hooks';
import { useNetworkStore } from '../../stores/networkStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';

/**
 * Espace du commis d'un fournisseur sur le mobile, onglets du bas dans le
 * style de l'espace fournisseur : Commandes (à servir, remises, « Commande
 * terminée »), Clients (sorties), Récap (clôture du jour), Moi. Hors barre :
 * le détail d'une commande, la remise sans commande et les Notifications. Un
 * autre profil n'y entre jamais (aucune requête commis lancée) : il est
 * renvoyé à son propre accueil.
 */
export default function CommisLayout() {
  const user = useAuthStore((s) => s.user);
  const startWatching = useNetworkStore((s) => s.startWatching);
  const isDark = useThemeStore((s) => s.effective) === 'dark';
  const insets = useSafeAreaInsets();
  // Retour matériel Android : parent logique (lib/navigation, ROUTES_COMMIS).
  useRetourMateriel();

  useEffect(() => {
    startWatching();
  }, []);

  if (user && !estProfilCommis(user.profile)) return <Redirect href={accueilDuProfil(user.profile) as never} />;
  if (!user) return null;
  return <Onglets isDark={isDark} insetBas={insets.bottom} />;
}

function Onglets({ isDark, insetBas }: { isDark: boolean; insetBas: number }) {
  // Pastille de Moi : notifications non lues (remise refusée par un livreur…).
  const nonLues = useNombreNonLues(true).data ?? 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <Tabs
        initialRouteName="index"
        backBehavior="firstRoute"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#047857',
          tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            height: 70 + insetBas,
            paddingBottom: insetBas,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -3 },
          tabBarItemStyle: { paddingVertical: 6 },
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 10, fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Commandes',
            tabBarIcon: ({ color }) => <ClipboardList color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: 'Clients',
            tabBarIcon: ({ color }) => <Store color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="recapitulatif"
          options={{
            title: 'Récap',
            tabBarIcon: ({ color }) => <BarChart3 color={color} size={23} strokeWidth={2.2} />,
          }}
        />
        <Tabs.Screen
          name="moi"
          options={{
            title: 'Moi',
            ...(nonLues ? { tabBarBadge: nonLues > 99 ? '99+' : nonLues } : {}),
            tabBarIcon: ({ color }) => <User color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        {/* Hors barre : détail d'une commande et saisie d'une remise, remise sans commande, Notifications. */}
        <Tabs.Screen name="commandes" options={{ href: null }} />
        <Tabs.Screen name="remise-sans-commande" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
