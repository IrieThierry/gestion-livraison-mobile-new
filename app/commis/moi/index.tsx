import type { ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, Check, ChevronRight, KeyRound, LogOut, Moon, Smartphone, Sun } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { Avatar } from '../../../components/shared/Avatar';
import { InterrupteurBiometrie } from '../../../components/profil/InterrupteurBiometrie';
import { useNombreNonLues } from '../../../features/notifications/hooks';
import { badgeNonLues } from '../../../features/notifications/regles';
import { NOTIFICATIONS_COMMIS } from '../../../lib/navigation';
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
 * Onglet Moi du commis : son compte (mot de passe, biométrie), les
 * Notifications, le thème et la déconnexion (mêmes écrans partagés que le
 * fournisseur). Ses informations sont gérées par son fournisseur.
 */
export default function MoiCommis() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
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
            <Avatar prenom={user.prenom} nom={user.nom} photoUrl={user.photoUrl} size={80} textClassName="text-2xl" />
            <Text className="font-extrabold text-slate-900 dark:text-white text-base mt-3">
              {user.prenom} {user.nom}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{`${user.username} · Commis`}</Text>
            {user.contact ? <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{user.contact}</Text> : null}
          </View>

          <Text className={TITRE}>Mon compte</Text>
          <View className={CARTE}>
            <Ligne
              Icone={KeyRound}
              couleur="#3b82f6"
              titre="Changer le mot de passe"
              detail="Sécurise ton compte"
              onPress={() => naviguer('/commis/moi/password')}
              premiere
            />
            {/* Déverrouillage biométrique (appareil compatible seulement). */}
            {user.username ? <InterrupteurBiometrie username={user.username} /> : null}
            <Ligne
              Icone={Bell}
              couleur="#2563eb"
              titre="Notifications"
              detail={nonLues > 0 ? `${badgeNonLues(nonLues)} non lue${nonLues > 1 ? 's' : ''}` : 'Remises refusées par les livreurs'}
              onPress={() => ouvrir(NOTIFICATIONS_COMMIS)}
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
