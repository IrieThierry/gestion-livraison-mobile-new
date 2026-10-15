import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, Tabs, useNavigationContainerRef, useSegments } from 'expo-router';
import {
  ACCUEIL_LIVREUR,
  estProfilPortailWeb,
  GROUPE_LIVREUR,
  ongletVisible,
  PORTAIL_WEB,
  redirectionRacine,
} from '../../lib/navigation';
import { estResponsable } from '../../features/organisation/regles';
import { TrendingUp, Truck, User, Plus, Users, LayoutDashboard, Bell } from 'lucide-react-native';
import { OfflineBanner } from '../../components/shared/OfflineBanner';
import { PreparationRecuBanner } from '../../components/shared/PreparationRecuBanner';
import { FabSheet } from '../../components/livreur/FabSheet';
import { useNetworkStore } from '../../stores/networkStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
// Un appui sur un onglet (actif ou non) ouvre toujours sa page principale
// (cf. lib/onglets.ts) : Accueil → avatar → Mes infos, puis onglet Accueil,
// puis onglet Moi ⇒ menu Moi.
import { listenersRacineOnglet } from '../../lib/onglets';
// Règle unique du retour (parent logique, lib/navigation.ts) : flèche
// d'en-tête, bouton et geste retour Android ; ouverture des listes sur une
// pile propre depuis le menu +, l'Accueil et les menus.
import {
  brancherNavigation,
  useRetourMateriel,
  type RefNavigation,
} from '../../lib/navigation-app';

export default function LivreurLayout() {
  const [fabOpen, setFabOpen] = useState(false);
  const startWatching = useNetworkStore((s) => s.startWatching);
  const user = useAuthStore((s) => s.user);
  const effective = useThemeStore((s) => s.effective);
  const isDark = effective === 'dark';
  // Responsable (O15) : espace sans onglets de vente (tableau de bord, Notifications, Moi).
  const responsable = estResponsable(user);
  const masque = (nom: string) => (ongletVisible(nom, responsable) ? {} : { href: null });

  // Safe-area inset bottom : sur Android avec gesture nav OU bouton home
  // virtuel, sans ce padding la TabBar se fait recouvrir par les boutons
  // système. On l'ajoute en padding (pas en height) pour que les items
  // restent à leur place et que seule la zone de bas s'agrandisse.
  const insets = useSafeAreaInsets();

  const segments = useSegments();
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    brancherNavigation(navigationRef as unknown as RefNavigation);
    return () => brancherNavigation(null);
  }, [navigationRef]);
  useRetourMateriel();

  useEffect(() => {
    startWatching();
  }, []);

  // ADMIN / FOURNISSEUR : pas d'onglets livreur (aucune requête livreur
  // lancée), écran « Utilisez le portail web » à la place.
  if (estProfilPortailWeb(user?.profile)) return <Redirect href={PORTAIL_WEB as never} />;

  // Responsable (O15) : garde au rendu. Un écran hors de son espace (lien
  // profond vers une vente…) n'est jamais monté : retour à son Accueil avant
  // toute requête (la redirection de la pile racine arrive après le rendu).
  if (user && redirectionRacine(user, GROUPE_LIVREUR, segments) === ACCUEIL_LIVREUR) {
    return <Redirect href={ACCUEIL_LIVREUR as never} />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <PreparationRecuBanner />
      <Tabs
        initialRouteName="index"
        // Retour depuis la racine d'un onglet = Accueil (le retour matériel
        // est de toute façon pris en charge par useRetourMateriel).
        backBehavior="firstRoute"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#047857',
          // Slate-400 light / Slate-500 dark (légèrement plus contrasté sur fond sombre)
          tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
          tabBarStyle: {
            borderTopWidth: 1,
            // Slate-200 light / Slate-800 dark
            borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
            // Bg : blanc light / Slate-900 dark, comme les cards de l'app
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            // Hauteur fixe + padding bottom = inset système (boutons nav).
            // Total : 70 + inset.bottom — la zone des items reste à 70.
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -3 },
          tabBarItemStyle: { paddingVertical: 6 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: responsable ? 'Tableau de bord' : 'Tournée',
            tabBarIcon: ({ color }) =>
              responsable ? (
                <LayoutDashboard color={color} size={23} strokeWidth={2.2} />
              ) : (
                <TrendingUp color={color} size={23} strokeWidth={2.2} />
              ),
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: 'Clients',
            ...masque('clients'),
            tabBarIcon: ({ color }) => <Users color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="fab"
          options={{
            title: '',
            tabBarShowLabel: false,
            ...masque('fab'),
            tabBarIcon: () => (
              <View
                className="bg-emerald-700 -mt-6 w-14 h-14 rounded-full items-center justify-center"
                style={{
                  shadowColor: '#047857',
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
              setFabOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="livraisons"
          options={{
            title: 'Livraisons',
            ...masque('livraisons'),
            tabBarIcon: ({ color }) => <Truck color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            ...masque('notifications'),
            tabBarIcon: ({ color }) => <Bell color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        <Tabs.Screen
          name="profil"
          options={{
            title: 'Moi',
            tabBarIcon: ({ color }) => <User color={color} size={23} strokeWidth={2.2} />,
          }}
          listeners={listenersRacineOnglet()}
        />
        {/* Hidden routes — accessible via le menu « Accéder à » (FAB), stat cards, links, or programmatic push */}
        <Tabs.Screen name="cash" options={{ href: null }} />
        <Tabs.Screen name="stock" options={{ href: null }} />
        <Tabs.Screen name="previsions" options={{ href: null }} />
        <Tabs.Screen name="clotures" options={{ href: null }} />
      </Tabs>
      {!responsable ? <FabSheet open={fabOpen} onClose={() => setFabOpen(false)} /> : null}
    </SafeAreaView>
  );
}
