import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Monitor, LogOut } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';

/**
 * Écran d'un compte ADMIN ou FOURNISSEUR connecté sur le mobile : l'app est
 * réservée aux livreurs, ces comptes travaillent sur le portail web. Remplace
 * les onglets livreur (routage : `redirectionRacine` de lib/navigation).
 */
export default function PortailWeb() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-4">
        <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-10 items-center w-full max-w-md">
          <View className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center mb-4">
            <Monitor color="#059669" size={28} />
          </View>
          <Text className="text-xl font-extrabold text-slate-900 dark:text-white mb-3 text-center">
            Utilisez le portail web
          </Text>
          <Text className="text-sm text-slate-600 dark:text-slate-400 text-center leading-5">
            {user?.prenom ? `Bonjour ${user.prenom}, l` : 'L'}'application mobile est réservée aux livreurs.
            Connectez-vous au portail web pour gérer votre compte.
          </Text>
          <Pressable
            onPress={() => void logout()}
            accessibilityRole="button"
            className="mt-6 flex-row items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 active:opacity-70"
          >
            <LogOut color="#475569" size={16} />
            <Text className="text-sm font-bold text-slate-700 dark:text-slate-300">Se déconnecter</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
