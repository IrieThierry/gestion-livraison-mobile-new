import type { ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, Camera, Check, ChevronRight, KeyRound, LogOut, Moon, Smartphone, Sun, UserCog } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { Avatar } from '../../../components/shared/Avatar';
import { InterrupteurBiometrie } from '../../../components/profil/InterrupteurBiometrie';
import { useFournisseurProfil } from '../../../features/fournisseur/hooks';
import { useNombreNonLues } from '../../../features/notifications/hooks';
import { badgeNonLues } from '../../../features/notifications/regles';
import { NOTIFICATIONS_FOURNISSEUR } from '../../../lib/navigation';
import { naviguer, ouvrir } from '../../../lib/navigation-app';
import { dialog } from '../../../lib/dialog';
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore, type Theme } from '../../../stores/themeStore';

const THEMES: Array<{ key: Theme; label: string; icon: ComponentType<{ color: string; size: number }> }> = [
  { key: 'light', label: 'Clair', icon: Sun },
  { key: 'dark', label: 'Sombre', icon: Moon },
  { key: 'system', label: 'Système', icon: Smartphone },
];

const TITRE = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden';

/**
 * F2, onglet 5 « Moi » du fournisseur : son entreprise et son compte
 * (informations, téléphone, photo, mot de passe, biométrie), les
 * Notifications, le thème et la déconnexion. Le catalogue s'y ajoute (FM3).
 */
export default function MoiFournisseur() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const profilQ = useFournisseurProfil();
  const nonLues = useNombreNonLues(!!user).data ?? 0;

  if (!user) return null;

  const onLogout = () => {
    dialog.confirm({
      title: 'Déconnexion',
      message: 'Tu veux te déconnecter de l’app ?',
      confirmLabel: 'Se déconnecter',
      destructive: true,
      onConfirm: async () => {
        await logout();
        router.replace('/(auth)/login');
      },
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Moi" showBack={false} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          <View className={`${CARTE} p-5 items-center`}>
            <Pressable
              onPress={() => naviguer('/fournisseur/moi/infos')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Changer ma photo"
              className="active:opacity-70"
            >
              <Avatar prenom={user.prenom} nom={user.nom} photoUrl={user.photoUrl} size={80} textClassName="text-2xl" />
              <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-700 items-center justify-center border-2 border-white dark:border-slate-900">
                <Camera color="#fff" size={14} />
              </View>
            </Pressable>
            {profilQ.data?.libelle ? (
              <Text className="font-extrabold text-emerald-700 dark:text-emerald-400 mt-3 text-base text-center">
                {profilQ.data.libelle}
              </Text>
            ) : null}
            <Text className={`font-extrabold text-slate-900 dark:text-white text-base ${profilQ.data?.libelle ? 'mt-0.5' : 'mt-3'}`}>
              {user.prenom} {user.nom}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{`${user.username} · Fournisseur`}</Text>
            {user.contact ? (
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{user.contact}</Text>
            ) : null}
          </View>

          <Text className={TITRE}>Mon compte</Text>
          <View className={CARTE}>
            <Ligne
              Icone={UserCog}
              couleur="#047857"
              titre="Modifier mes infos"
              detail="Nom, prénom, téléphone, email, photo"
              onPress={() => naviguer('/fournisseur/moi/infos')}
              premiere
            />
            <Ligne
              Icone={KeyRound}
              couleur="#3b82f6"
              titre="Changer le mot de passe"
              detail="Sécurise ton compte"
              onPress={() => naviguer('/fournisseur/moi/password')}
            />
            {/* S4 : déverrouillage biométrique (appareil compatible seulement). */}
            {user.username ? <InterrupteurBiometrie username={user.username} /> : null}
          </View>

          <Text className={TITRE}>Activité</Text>
          <View className={CARTE}>
            <Ligne
              Icone={Bell}
              couleur="#2563eb"
              titre="Notifications"
              detail={nonLues > 0 ? `${badgeNonLues(nonLues)} non lue${nonLues > 1 ? 's' : ''}` : 'Commandes, invitations, versements'}
              onPress={() => ouvrir(NOTIFICATIONS_FOURNISSEUR)}
              premiere
            />
          </View>

          <Text className={TITRE}>Apparence</Text>
          <View className={CARTE}>
            {THEMES.map(({ key, label, icon: Icon }, i) => (
              <Pressable
                key={key}
                onPress={() => setTheme(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: theme === key }}
                className={`flex-row items-center justify-between px-4 py-3 active:opacity-70 ${
                  i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Icon color={key === 'light' ? '#f59e0b' : key === 'dark' ? '#6366f1' : '#64748b'} size={18} />
                  <Text className="text-slate-900 dark:text-white">{label}</Text>
                </View>
                {theme === key ? <Check color="#047857" size={18} /> : null}
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onLogout}
            accessibilityRole="button"
            className="bg-red-500 rounded-lg py-3.5 mt-6 flex-row items-center justify-center gap-2 active:opacity-80"
          >
            <LogOut color="#fff" size={18} />
            <Text className="text-white font-bold text-base">Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Ligne({
  Icone,
  couleur,
  titre,
  detail,
  onPress,
  premiere = false,
}: {
  Icone: ComponentType<{ color: string; size: number }>;
  couleur: string;
  titre: string;
  detail: string;
  onPress: () => void;
  premiere?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titre}
      className={`flex-row items-center justify-between px-4 py-3 active:opacity-70 ${
        premiere ? '' : 'border-t border-slate-100 dark:border-slate-800'
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Icone color={couleur} size={20} />
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">{titre}</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">{detail}</Text>
        </View>
      </View>
      <ChevronRight color="#94a3b8" size={18} />
    </Pressable>
  );
}
