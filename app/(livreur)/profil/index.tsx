import { ScrollView, View, Text, Pressable, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import {
  LogOut,
  Moon,
  Sun,
  Smartphone,
  ExternalLink,
  Check,
  ChevronRight,
  Camera,
  UserCog,
  KeyRound,
  DollarSign,
} from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore, type Theme } from '../../../stores/themeStore';

const THEMES: Array<{
  key: Theme;
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
}> = [
  { key: 'light', label: 'Clair', icon: Sun },
  { key: 'dark', label: 'Sombre', icon: Moon },
  { key: 'system', label: 'Système', icon: Smartphone },
];

export default function Profil() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (!user) return null;

  const onLogout = () => {
    Alert.alert('Déconnexion', 'Tu veux te déconnecter de l’app ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const onPhotoTap = () => {
    Alert.alert(
      'Photo de profil',
      'La gestion de la photo arrivera bientôt — tu pourras choisir une photo depuis ton appareil.',
    );
  };

  const initials = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase();

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Profil" showBack={false} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          {/* User card */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 items-center">
            <Pressable onPress={onPhotoTap} hitSlop={6} className="active:opacity-70">
              <View className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
                <Text className="text-emerald-700 dark:text-emerald-400 font-extrabold text-2xl">
                  {initials || '?'}
                </Text>
              </View>
              <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-500 items-center justify-center border-2 border-white dark:border-slate-900">
                <Camera color="#fff" size={14} />
              </View>
            </Pressable>
            <Text className="font-extrabold text-slate-900 dark:text-white mt-3 text-base">
              {user.prenom} {user.nom}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {user.username}
              {user.role ? ` · ${user.role}` : ''}
            </Text>
            {user.contact ? (
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {user.contact}
              </Text>
            ) : null}
          </View>

          {/* Mon compte */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Mon compte
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <Pressable
              onPress={() => router.push('/(livreur)/profil/infos' as never)}
              className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <UserCog color="#10b981" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Modifier mes infos
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Nom, prénom, téléphone, email
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(livreur)/profil/password' as never)}
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <KeyRound color="#3b82f6" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Changer le mot de passe
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sécurise ton compte
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(livreur)/profil/prix' as never)}
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <DollarSign color="#059669" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Mes prix de vente
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Barème par défaut appliqué à toutes tes livraisons
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
          </View>

          {/* Apparence */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Apparence
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {THEMES.map(({ key, label, icon: Icon }, i) => {
              const active = theme === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTheme(key)}
                  className={`flex-row items-center justify-between px-4 py-3 active:opacity-70 ${
                    i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <Icon
                      color={
                        key === 'light' ? '#f59e0b' : key === 'dark' ? '#6366f1' : '#64748b'
                      }
                      size={18}
                    />
                    <Text className="text-slate-900 dark:text-white">{label}</Text>
                  </View>
                  {active ? <Check color="#10b981" size={18} /> : null}
                </Pressable>
              );
            })}
          </View>

          {/* Plus de fonctions */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Plus de fonctions
          </Text>
          <Pressable
            onPress={() => Linking.openURL('https://app.gestionlivraison.example.com')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3 active:opacity-70"
          >
            <ExternalLink color="#3b82f6" size={20} />
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">Portail web</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                Apprentis, prix, stock équipe, rapports
              </Text>
            </View>
          </Pressable>

          {/* Logout */}
          <Pressable
            onPress={onLogout}
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
