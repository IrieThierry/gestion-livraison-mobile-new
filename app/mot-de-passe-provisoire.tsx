import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { FormScreen } from '../components/shared/FormScreen';
import { authApi } from '../features/auth/api';
import { changePasswordSchema, MESSAGES_COMPTE } from '../features/auth/schemas';
import { creerVerrou, lancerUneFois } from '../features/commandes/verrou';
import { useAuthStore } from '../stores/authStore';
import { accueilDuProfil } from '../lib/navigation';
import { dialog } from '../lib/dialog';
import { extractApiErrorMessage } from '../lib/api-error';

const CHAMP =
  'h-[52px] flex-row items-center pl-3.5 pr-1.5 rounded-[14px] border border-[#d5dcd7] dark:border-slate-700 bg-[#fbfcfb] dark:bg-slate-800';

/**
 * M1 « Choisis ton nouveau mot de passe » : ouvert après la connexion avec
 * un mot de passe provisoire (`motDePasseProvisoire`). Ancien mot de passe
 * (le provisoire), nouveau et confirmation, avec les règles existantes.
 * Tant que le mot de passe n'est pas changé, aucune autre page n'est
 * accessible (`redirectionRacine`), le retour Android est bloqué ; seule la
 * déconnexion permet de sortir.
 */
export default function MotDePasseProvisoire() {
  const user = useAuthStore((s) => s.user);
  const majUtilisateur = useAuthStore((s) => s.majUtilisateur);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [voir, setVoir] = useState(false);
  const verrou = useRef(creerVerrou()).current;

  // Retour Android : bloqué (aucune autre page tant que le mot de passe n'est pas changé).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const m = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      if (user) await majUtilisateur({ ...user, motDePasseProvisoire: false });
      dialog.success('Ton mot de passe a été mis à jour.');
      router.replace(accueilDuProfil(user?.profile) as never);
    },
    onError: (e: unknown) => {
      dialog.error(
        'Erreur',
        extractApiErrorMessage(e, 'Mise à jour impossible — vérifie ton mot de passe provisoire.'),
      );
    },
  });

  const onSubmit = () => {
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      dialog.warning('Champs invalides', parsed.error.issues[0]?.message ?? 'Vérifie les informations saisies.');
      return;
    }
    lancerUneFois(verrou, (fin) =>
      m.mutate(
        { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword },
        { onSettled: fin },
      ),
    );
  };

  const onDeconnexion = () =>
    dialog.confirm({
      title: 'Se déconnecter ?',
      message: 'Tu devras te reconnecter avec ton mot de passe provisoire.',
      confirmLabel: 'Se déconnecter',
      onConfirm: async () => {
        await logout();
        router.replace('/(auth)/login' as never);
      },
    });

  return (
    <View className="flex-1 bg-[#f6f7f5] dark:bg-slate-950">
      <StatusBar style="light" />
      <FormScreen
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        className="flex-1"
      >
        <View
          className="bg-emerald-700 px-7 pb-[72px] gap-[22px]"
          style={{ paddingTop: insets.top + 40, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
        >
          <View className="w-14 h-14 rounded-2xl bg-white items-center justify-center">
            <KeyRound color="#047857" size={26} />
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="text-white text-[28px] font-extrabold tracking-tight">
              Choisis ton nouveau mot de passe
            </Text>
            <Text className="text-emerald-100 text-[15px]">
              Ton mot de passe est provisoire. Change-le pour continuer.
            </Text>
          </View>
        </View>

        <View
          className="-mt-10 mx-[18px] bg-white dark:bg-slate-900 rounded-3xl px-5 py-6 gap-4"
          style={{
            shadowColor: '#17201b',
            shadowOpacity: 0.08,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <ChampMotDePasse
            label="Mot de passe provisoire"
            value={currentPassword}
            onChange={setCurrent}
            voir={voir}
            onBasculer={() => setVoir((v) => !v)}
          />
          <ChampMotDePasse
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={setNew}
            voir={voir}
            onBasculer={() => setVoir((v) => !v)}
            aide={MESSAGES_COMPTE.motDePasse}
          />
          <ChampMotDePasse
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={setConfirm}
            voir={voir}
            onBasculer={() => setVoir((v) => !v)}
          />

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le mot de passe"
            accessibilityState={{ disabled: m.isPending, busy: m.isPending }}
            className="h-[54px] rounded-2xl bg-emerald-700 items-center justify-center active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" accessibilityLabel="Enregistrement en cours" />
            ) : (
              <Text className="text-white font-extrabold text-base">Enregistrer le mot de passe</Text>
            )}
          </Pressable>
        </View>

        <View className="flex-1 justify-end items-center px-6 pt-6">
          <Pressable onPress={onDeconnexion} accessibilityRole="button" hitSlop={6}>
            <Text className="text-sm font-bold text-[#5b665f] dark:text-slate-400">Se déconnecter</Text>
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}

function ChampMotDePasse({
  label,
  value,
  onChange,
  voir,
  onBasculer,
  aide,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  voir: boolean;
  onBasculer: () => void;
  aide?: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-[#17201b] dark:text-white">{label}</Text>
      <View className={CHAMP}>
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!voir}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          accessibilityLabel={label}
          className="flex-1 h-full text-base font-medium text-slate-900 dark:text-white"
        />
        <Pressable
          onPress={onBasculer}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={voir ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
          className="w-11 h-11 items-center justify-center active:opacity-60"
        >
          {voir ? <EyeOff color="#5b665f" size={20} /> : <Eye color="#5b665f" size={20} />}
        </Pressable>
      </View>
      {aide ? <Text className="text-xs text-[#5b665f] dark:text-slate-400">{aide}</Text> : null}
    </View>
  );
}
