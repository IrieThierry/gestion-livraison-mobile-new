import { useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, Tabs } from 'expo-router';
import { ClipboardList, Coins, LayoutDashboard, User, UsersRound } from 'lucide-react-native';
import { accueilDuProfil, estProfilFournisseur } from '../../lib/navigation';
import { useRetourMateriel } from '../../lib/navigation-app';
import { listenersRacineOnglet } from '../../lib/onglets';
import { OfflineBanner } from '../../components/shared/OfflineBanner';
import { PreparationRecuBanner } from '../../components/shared/PreparationRecuBanner';
import { useATraiterFournisseur } from '../../components/fournisseur/ATraiterFournisseur';
import { useNetworkStore } from '../../stores/networkStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';

/** Badge d'un onglet : le nombre d'actions de sa rubrique, rien à zéro. */
const badge = (n: number | undefined) => (n ? { tabBarBadge: n > 99 ? '99+' : n } : {});

/**
 * F1, F2 : espace du fournisseur sur le mobile, onglets du bas dans le
 * même style que l'espace livreur : Accueil (synthèse et « À traiter »),
 * Commandes, Livreurs (et invitations), Argent (versements, reversements,
 * dépenses), Moi. Notifications : écran de l'espace hors barre (cloche de
 * l'Accueil, entrée de Moi). Un autre profil n'y entre jamais (aucune
 * requête fournisseur lancée) : il est renvoyé à son propre accueil.
 */
export default function FournisseurLayout() {
  const user = useAuthStore((s) => s.user);
  const startWatching = useNetworkStore((s) => s.startWatching);
  const isDark = useThemeStore((s) => s.effective) === 'dark';
  const insets = useSafeAreaInsets();
  // Retour matériel Android : parent logique (lib/navigation, ROUTES_FOURNISSEUR).
  useRetourMateriel();

  useEffect(() => {
    startWatching();
  }, []);

  if (user && !estProfilFournisseur(user.profile)) return <Redirect href={accueilDuProfil(user.profile) as never} />;
  if (!user) return null;
  return <Onglets isDark={isDark} insetBas={insets.bottom} />;
}

function Onglets({ isDark, insetBas }: { isDark: boolean; insetBas: number }) {
  const aTraiter = useATraiterFournisseur();
  const nb = (code: string) => aTraiter.taches.find((t) => t.code === code)?.nombre;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      {/* Reçu de reversement en préparation (Argent → Reversements). */}
      <PreparationRecuBanner />
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
            title: 'Accueil',
            tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="commandes"
          options={{
            title: 'Commandes',
            ...badge(nb('CMD')),
            tabBarIcon: ({ color }) => <ClipboardList color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="livreurs"
          options={{
            title: 'Livreurs',
            ...badge(nb('INV')),
            tabBarIcon: ({ color }) => <UsersRound color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="argent"
          options={{
            title: 'Argent',
            ...badge(nb('VER')),
            tabBarIcon: ({ color }) => <Coins color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="moi"
          options={{
            title: 'Moi',
            tabBarIcon: ({ color }) => <User color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        {/* Hors barre : cloche de l'Accueil, entrée « Notifications » de Moi. */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
