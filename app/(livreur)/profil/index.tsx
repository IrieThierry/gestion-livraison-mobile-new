import { ScrollView, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { dialog } from '../../../lib/dialog';
import {
  LogOut,
  Moon,
  Sun,
  Smartphone,
  Check,
  ChevronRight,
  Camera,
  UserCog,
  KeyRound,
  DollarSign,
  UsersRound,
  CalendarClock,
  ClipboardCheck,
  History,
  Store,
  FileText,
  Receipt,
  HandCoins,
  FileStack,
} from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { Avatar } from '../../../components/shared/Avatar';
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore, type Theme } from '../../../stores/themeStore';
import { naviguer } from '../../../lib/navigation-app';
import { estCommercial, estMembreOrganisation, vocabulaire } from '../../../features/organisation/regles';

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

  // Organisation B2B : vocabulaire (O4), pas de fournisseurs, factures du commercial (O17).
  const v = vocabulaire(user);
  const membre = estMembreOrganisation(user);
  const commercial = estCommercial(user);

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

  // Tap sur l'avatar → ouvre la page de modification d'infos où la photo
  // est gérée (upload + delete via expo-image-picker + photosApi).
  const onPhotoTap = () => naviguer('/(livreur)/profil/infos');

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Profil" showBack={false} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          {/* User card */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 items-center">
            <Pressable onPress={onPhotoTap} hitSlop={6} className="active:opacity-70">
              <Avatar
                prenom={user.prenom}
                nom={user.nom}
                photoUrl={user.photoUrl}
                size={80}
                textClassName="text-2xl"
              />
              <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-500 items-center justify-center border-2 border-white dark:border-slate-900">
                <Camera color="#fff" size={14} />
              </View>
            </Pressable>
            <Text className="font-extrabold text-slate-900 dark:text-white mt-3 text-base">
              {user.prenom} {user.nom}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {user.username}
              {v.role ? ` · ${v.role}` : user.profile ? ` · ${user.profile}` : ''}
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
              onPress={() => naviguer('/(livreur)/profil/infos')}
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
              onPress={() => naviguer('/(livreur)/profil/password')}
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
              onPress={() => naviguer('/(livreur)/profil/prix')}
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
            {/* Fournisseurs : fermés aux organisations (le dépôt est approvisionné par le responsable). */}
            {!membre ? (
            <Pressable
              onPress={() => naviguer('/(livreur)/profil/fournisseurs')}
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <Store color="#f59e0b" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Mes fournisseurs
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Invite un fournisseur pour pouvoir lui commander
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            ) : null}
            {/* Mes apprentis — visible pour les livreurs racines uniquement.
                Un apprenti (parentId défini) ne peut pas avoir lui-même
                des sous-apprentis dans la hiérarchie actuelle. On ne filtre
                que sur `parentId` : ça gère aussi les sessions legacy où
                le back ne renvoyait pas `role` (la version la plus
                permissive — un admin sera de toute façon bloqué côté API). */}
            {!user.parentId ? (
              <Pressable
                onPress={() =>
                  naviguer('/(livreur)/profil/apprentis')
                }
                className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3">
                  <UsersRound color="#8b5cf6" size={20} />
                  <View>
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      {v.mesApprentis}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      {membre ? 'Crée et gère les comptes de tes commerciaux' : 'Crée et gère les comptes de tes apprentis livreurs'}
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            ) : null}
          </View>

          {/* Activité — pages métier accessibles aussi via tournée */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Activité
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {commercial ? (
              <Pressable
                onPress={() => naviguer('/(livreur)/profil/factures')}
                accessibilityRole="button"
                className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3">
                  <FileStack color="#0ea5e9" size={20} />
                  <View>
                    <Text className="font-extrabold text-slate-900 dark:text-white">Mes factures</Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Factures et avoirs de tes ventes, en PDF à partager
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => naviguer('/(livreur)/profil/etats')}
              className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <FileText color="#10b981" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    États
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ventes, encaissements, stock : aperçu et PDF à partager
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            <Pressable
              onPress={() => naviguer('/(livreur)/previsions')}
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <CalendarClock color="#3b82f6" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Prévisions
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Liste, cumul commande et nouvelle prévision
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            <Pressable
              onPress={() => naviguer('/(livreur)/clotures')}
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <ClipboardCheck color="#f59e0b" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Clôtures journalières
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Récap fin de journée + écart de caisse
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            <Pressable
              onPress={() =>
                naviguer('/(livreur)/cash/reversements')
              }
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <History color="#059669" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Mes reversements
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Synthèse : fournisseurs me doivent · clients à payer
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            <Pressable
              onPress={() => naviguer('/(livreur)/cash/depenses')}
              className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <Receipt color="#dc2626" size={20} />
                <View>
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    Dépenses
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Carburant, entretien, autre
                  </Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={18} />
            </Pressable>
            {/* Remises d'argent : l'apprenti déclare, le principal confirme ou conteste. */}
            {user.parentId ? (
              <Pressable
                onPress={() => naviguer('/(livreur)/profil/remises')}
                className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3">
                  <HandCoins color="#0d9488" size={20} />
                  <View>
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      Mes remises
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Argent remis à {v.tonPrincipalCourt}
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            ) : null}
            {!user.parentId ? (
              <Pressable
                onPress={() => naviguer('/(livreur)/profil/remises-apprentis')}
                className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3">
                  <HandCoins color="#0d9488" size={20} />
                  <View>
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      Remises des {v.apprentis}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Confirme ou conteste l’argent remis
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            ) : null}
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
