import { View, Text, Pressable } from 'react-native';
import { Clock, LogOut } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';

/**
 * Écran « Compte en attente de validation » — réplique 1:1 du
 * `PendingValidationGuard` du portail web.
 *
 * Affiché à la place du contenu de tous les onglets métier (Tournée,
 * Clients, Livraisons, Cash, Stock) tant que `user.statut === 'EN_ATTENTE_VALIDATION'`.
 * L'onglet « Moi » reste accessible afin que le livreur puisse changer
 * son mot de passe pendant l'attente.
 *
 * Wired up dans `app/(livreur)/_layout.tsx` via une superposition (overlay)
 * absolue qui couvre la zone de contenu tout en laissant la barre
 * d'onglets visible et utilisable.
 */
export function PendingValidationScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950 items-center justify-center px-4">
      <View
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-10 items-center w-full max-w-md"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        {/* Icône horloge ambre */}
        <View className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-500/15 items-center justify-center mb-4">
          <Clock color="#d97706" size={28} />
        </View>

        {/* Titre */}
        <Text className="text-xl font-extrabold text-slate-900 dark:text-white mb-3 text-center">
          Compte en attente de validation
        </Text>

        {/* Message principal */}
        <Text className="text-sm text-slate-600 dark:text-slate-400 text-center leading-5 mb-3">
          Bonjour {user?.prenom ?? ''}, ton inscription a bien été
          enregistrée. Un administrateur doit valider ton compte avant que
          tu puisses accéder à l'application.
        </Text>

        {/* Sous-message — accès profil */}
        <Text className="text-sm text-slate-600 dark:text-slate-400 text-center leading-5">
          Tu peux toujours mettre à jour ton mot de passe depuis ton profil.
        </Text>

        {/* Bouton déconnexion */}
        <Pressable
          onPress={logout}
          className="mt-6 flex-row items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 active:opacity-70"
          accessibilityLabel="Se déconnecter"
        >
          <LogOut color="#475569" size={16} />
          <Text className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Se déconnecter
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
