import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import { FormScreen } from '../../components/shared/FormScreen';
import { authApi } from '../../features/auth/api';
import {
  MESSAGES_COMPTE,
  MESSAGE_DEMANDE_MOT_DE_PASSE,
  motDePasseOublieSchema,
} from '../../features/auth/schemas';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { extractApiErrorMessage } from '../../lib/api-error';
import { dialog } from '../../lib/dialog';

const CHAMP =
  'h-[52px] px-3.5 rounded-[14px] border border-[#d5dcd7] dark:border-slate-700 bg-[#fbfcfb] dark:bg-slate-800 text-base font-medium text-slate-900 dark:text-white';

const retourConnexion = () => {
  if (router.canGoBack?.()) router.back();
  else router.replace('/(auth)/login' as never);
};

/**
 * M1 « Mot de passe oublié » (écran public) : identifiant + numéro du compte.
 * La demande part au responsable du compte (livreur principal d'un apprenti,
 * responsable d'un commercial, admin sinon), qui donne un mot de passe
 * provisoire. Le message affiché est toujours le même, que le compte existe
 * ou non. Même habillage que la connexion (bandeau vert).
 */
export default function MotDePasseOublie() {
  const [username, setUsername] = useState('');
  const [contact, setContact] = useState('');
  const insets = useSafeAreaInsets();
  const verrou = useRef(creerVerrou()).current;

  const mutation = useMutation({
    mutationFn: authApi.motDePasseOublie,
    onSuccess: (data) => {
      dialog.success('Demande envoyée', data?.message || MESSAGE_DEMANDE_MOT_DE_PASSE, {
        autoDismissMs: 0,
        actions: [{ label: 'OK', style: 'primary', onPress: retourConnexion }],
      });
    },
    onError: (e: unknown) => {
      dialog.error('Envoi impossible', extractApiErrorMessage(e, 'La demande n’a pas pu être envoyée. Réessaie.'));
    },
  });

  const onSubmit = () => {
    const parsed = motDePasseOublieSchema.safeParse({ username, contact });
    if (!parsed.success) {
      dialog.warning('Champs invalides', parsed.error.issues[0]?.message ?? 'Vérifie les informations saisies.');
      return;
    }
    lancerUneFois(verrou, (fin) => mutation.mutate(parsed.data, { onSettled: fin }));
  };

  return (
    <View className="flex-1 bg-[#f6f7f5] dark:bg-slate-950">
      <StatusBar style="light" />
      <FormScreen
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        className="flex-1"
      >
        {/* Bandeau vert */}
        <View
          testID="bandeau-mot-de-passe-oublie"
          className="bg-emerald-700 px-7 pb-[72px] gap-[22px]"
          style={{ paddingTop: insets.top + 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
        >
          <Pressable
            onPress={retourConnexion}
            accessibilityRole="button"
            accessibilityLabel="Retour à la connexion"
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-white/15 items-center justify-center active:opacity-70"
          >
            <ArrowLeft color="#fff" size={20} />
          </Pressable>
          <View className="w-14 h-14 rounded-2xl bg-white items-center justify-center">
            <KeyRound color="#047857" size={26} />
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="text-white text-[30px] font-extrabold tracking-tight">
              Mot de passe oublié
            </Text>
            <Text className="text-emerald-100 text-[15px]">
              Ton responsable recevra ta demande et te donnera un mot de passe provisoire.
            </Text>
          </View>
        </View>

        {/* Carte du formulaire */}
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
          <View className="gap-2">
            <Text className="text-sm font-bold text-[#17201b] dark:text-white">Nom d'utilisateur</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ton.identifiant"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Nom d'utilisateur"
              className={CHAMP}
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-[#17201b] dark:text-white">Numéro de téléphone</Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="07XXXXXXXX"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Numéro de téléphone"
              className={CHAMP}
            />
            <Text className="text-xs text-[#5b665f] dark:text-slate-400">{MESSAGES_COMPTE.contact}</Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={mutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Envoyer la demande"
            accessibilityState={{ disabled: mutation.isPending, busy: mutation.isPending }}
            className="h-[54px] rounded-2xl bg-emerald-700 items-center justify-center active:opacity-80"
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" accessibilityLabel="Envoi en cours" />
            ) : (
              <Text className="text-white font-extrabold text-base">Envoyer la demande</Text>
            )}
          </Pressable>
        </View>

        <View className="flex-1 justify-end items-center px-6 pt-6">
          <Pressable onPress={retourConnexion} accessibilityRole="link">
            <Text className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
              Retour à la connexion
            </Text>
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
