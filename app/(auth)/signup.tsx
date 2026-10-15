import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { FormScreen } from '../../components/shared/FormScreen';
import { authApi } from '../../features/auth/api';
import { inscriptionInformationsSchema, MESSAGES_COMPTE, signupSchema } from '../../features/auth/schemas';
import { extractApiErrorMessage } from '../../lib/api-error';
import { dialog } from '../../lib/dialog';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';

const VERT = '#047857';
const CHAMP =
  'h-[50px] px-3.5 rounded-[14px] border border-[#d5dcd7] dark:border-slate-700 bg-[#fbfcfb] dark:bg-slate-800 text-base font-medium text-slate-900 dark:text-white';
const OMBRE_CARTE = {
  shadowColor: '#17201b',
  shadowOpacity: 0.08,
  shadowRadius: 15,
  shadowOffset: { width: 0, height: 12 },
  elevation: 6,
};

type Etape = 1 | 2 | 3;

/** Profils proposés sur le mobile : livreur seulement (le fournisseur s'inscrit sur le portail web). */
const PROFILS = [
  {
    id: 'LIVREUR' as const,
    court: 'LIV',
    titre: 'Livreur',
    texte: 'Je livre mes clients avec mon camion, seul ou avec des apprentis.',
  },
];

const TITRES: Record<Etape, string> = {
  1: 'Créer ton compte',
  2: 'Tes informations',
  3: 'Tes accès',
};

/**
 * Inscription libre d'un livreur en trois étapes, assortie à la connexion
 * (bandeau vert) : 1. profil, 2. informations (prénom, nom, téléphone,
 * email facultatif), 3. accès (nom d'utilisateur, mot de passe,
 * confirmation) puis « Créer mon compte ». Chaque étape est vérifiée avant
 * « Continuer » ; le retour (flèche ou bouton Android) ramène à l'étape
 * précédente sans perdre la saisie, et à la connexion depuis l'étape 1.
 * Le compte est utilisable tout de suite (abonnement en essai). Règles et
 * messages A7 : `signupSchema`.
 */
export default function Signup() {
  const insets = useSafeAreaInsets();
  const [etape, setEtape] = useState<Etape>(1);
  const [profil, setProfil] = useState<'LIVREUR'>('LIVREUR');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  // Double appui avant que isPending ne s'affiche : un seul envoi.
  const verrou = useRef(creerVerrou()).current;

  const precedent = () => {
    if (etape === 1) router.back();
    else setEtape((e) => (e - 1) as Etape);
  };

  // Retour Android : étape précédente (à l'étape 1, comportement normal : connexion).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (etape === 1) return false;
      setEtape((e) => (e - 1) as Etape);
      return true;
    });
    return () => sub.remove();
  }, [etape]);

  const m = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      dialog.success('Compte créé', MESSAGES_COMPTE.inscriptionReussie, {
        autoDismissMs: 0,
        actions: [
          {
            label: 'Se connecter',
            style: 'primary',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
      });
    },
    onError: (err: unknown) => {
      dialog.error('Erreur', extractApiErrorMessage(err, 'Création impossible'));
    },
  });

  const avertir = (message?: string) =>
    dialog.warning('Champs invalides', message ?? 'Vérifie les informations saisies.');

  const continuer = () => {
    if (etape === 1) {
      setEtape(2);
      return;
    }
    const infos = inscriptionInformationsSchema.safeParse({ prenom, nom, contact, email });
    if (!infos.success) {
      avertir(infos.error.issues[0]?.message);
      return;
    }
    setEtape(3);
  };

  const onSubmit = () => {
    const parsed = signupSchema.safeParse({
      prenom,
      nom,
      contact,
      email,
      username,
      password,
      confirmPassword,
      profile: profil,
    });
    if (!parsed.success) {
      avertir(parsed.error.issues[0]?.message);
      return;
    }
    lancerUneFois(verrou, (fin) => m.mutate(parsed.data, { onSettled: fin }));
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
          testID="bandeau-inscription"
          className="bg-emerald-700 px-6 pb-16 gap-4"
          style={{ paddingTop: insets.top + 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={precedent}
              accessibilityRole="button"
              accessibilityLabel={etape === 1 ? 'Retour à la connexion' : 'Étape précédente'}
              hitSlop={6}
              className="w-11 h-11 rounded-[14px] bg-white/15 items-center justify-center active:opacity-70"
            >
              <ChevronLeft color="#fff" size={22} />
            </Pressable>
            <Text className="text-[13px] font-bold text-emerald-100">
              {`Étape ${etape} sur 3${etape > 1 ? ' · Livreur' : ''}`}
            </Text>
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="text-white text-[28px] font-extrabold tracking-tight">
              {TITRES[etape]}
            </Text>
            {etape === 1 ? (
              <Text className="text-emerald-100 text-[15px]">Commence par choisir ton profil.</Text>
            ) : null}
          </View>
          <View className="flex-row gap-1.5" accessibilityLabel={`Étape ${etape} sur 3`}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                testID={`progression-${i}`}
                className={`flex-1 h-[5px] rounded-full ${i <= etape ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </View>
        </View>

        {etape === 1 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Profil" className="-mt-9 mx-4 gap-3">
            {PROFILS.map((p) => {
              const choisi = p.id === profil;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setProfil(p.id)}
                  accessibilityRole="radio"
                  accessibilityLabel={p.titre}
                  accessibilityState={{ checked: choisi }}
                  className="bg-white dark:bg-slate-900 rounded-[20px] p-4 flex-row items-center gap-3.5"
                  style={{
                    borderWidth: 2,
                    borderColor: choisi ? VERT : '#e3e8e5',
                    shadowColor: '#17201b',
                    shadowOpacity: 0.06,
                    shadowRadius: 11,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 3,
                  }}
                >
                  <View
                    className={`w-12 h-12 rounded-[14px] items-center justify-center ${
                      choisi ? 'bg-emerald-700' : 'bg-[#eef2ef]'
                    }`}
                  >
                    <Text className={`font-extrabold text-[13px] ${choisi ? 'text-white' : 'text-[#3d4741]'}`}>
                      {p.court}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-extrabold text-base text-[#17201b] dark:text-white">{p.titre}</Text>
                    <Text className="text-[13px] leading-[18px] text-[#5b665f] dark:text-slate-400">{p.texte}</Text>
                  </View>
                  <View
                    className="w-[22px] h-[22px] rounded-full items-center justify-center"
                    style={{ borderWidth: 2, borderColor: choisi ? VERT : '#e3e8e5' }}
                  >
                    {choisi ? <View className="w-3 h-3 rounded-full bg-emerald-700" /> : null}
                  </View>
                </Pressable>
              );
            })}
            <Text className="text-[13px] text-[#5b665f] dark:text-slate-400 text-center mt-1">
              Fournisseur ? Inscris-toi sur le portail web.
            </Text>
          </View>
        ) : (
          <View
            className="-mt-9 mx-4 bg-white dark:bg-slate-900 rounded-3xl px-[18px] py-[22px] gap-3.5"
            style={OMBRE_CARTE}
          >
            {etape === 2 ? (
              <>
                <Champ label="Prénom" value={prenom} onChange={setPrenom} placeholder="Marc" />
                <Champ label="Nom" value={nom} onChange={setNom} placeholder="Konan" />
                <Champ
                  label="Téléphone"
                  value={contact}
                  onChange={setContact}
                  placeholder="0712345678"
                  keyboardType="phone-pad"
                  aide="10 chiffres, commence par 01, 05 ou 07"
                />
                <Champ
                  label="Email (facultatif)"
                  value={email}
                  onChange={setEmail}
                  placeholder="marc@…"
                  keyboardType="email-address"
                />
              </>
            ) : (
              <>
                <Champ
                  label="Nom d'utilisateur"
                  value={username}
                  onChange={setUsername}
                  placeholder="marc"
                  autoCapitalize="none"
                  aide="3 caractères au moins, sans espaces"
                />
                <ChampMotDePasse
                  label="Mot de passe"
                  value={password}
                  onChange={setPassword}
                  placeholder="Min 6 caractères"
                  voir={showPwd}
                  onBasculer={() => setShowPwd((v) => !v)}
                />
                <ChampMotDePasse
                  label="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-tape le mot de passe"
                  voir={showPwd}
                />
              </>
            )}
          </View>
        )}

        {/* Pied : action de l'étape */}
        <View className="flex-1 justify-end gap-3.5 px-4 pt-5">
          {etape < 3 ? (
            <Pressable
              onPress={continuer}
              accessibilityRole="button"
              className="h-[54px] rounded-2xl bg-emerald-700 items-center justify-center active:opacity-80"
            >
              <Text className="text-white font-extrabold text-base">Continuer</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onSubmit}
              disabled={m.isPending}
              accessibilityRole="button"
              accessibilityLabel="Créer mon compte"
              accessibilityState={{ disabled: m.isPending, busy: m.isPending }}
              className="h-[54px] rounded-2xl bg-emerald-700 items-center justify-center active:opacity-80"
            >
              {m.isPending ? (
                <ActivityIndicator color="#fff" accessibilityLabel="Création en cours" />
              ) : (
                <Text className="text-white font-extrabold text-base">Créer mon compte</Text>
              )}
            </Pressable>
          )}
          {etape === 1 ? (
            <Pressable onPress={() => router.replace('/(auth)/login' as never)} accessibilityRole="link">
              <Text className="text-center text-sm text-[#5b665f] dark:text-slate-400">
                Déjà un compte ?{' '}
                <Text className="font-extrabold text-emerald-700 dark:text-emerald-400">Se connecter</Text>
              </Text>
            </Pressable>
          ) : etape === 2 ? (
            <Text className="text-center text-[13px] text-[#5b665f] dark:text-slate-400">
              Étape suivante : ton nom d'utilisateur et ton mot de passe.
            </Text>
          ) : null}
        </View>
      </FormScreen>
    </View>
  );
}

function Champ({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  aide,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  aide?: string;
}) {
  return (
    <View className="gap-[7px]">
      <Text className="text-sm font-bold text-[#17201b] dark:text-white">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? 'default'}
        maxLength={keyboardType === 'phone-pad' ? 10 : undefined}
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
        autoCorrect={false}
        accessibilityLabel={label}
        className={CHAMP}
      />
      {aide ? <Text className="text-xs font-medium text-[#5b665f] dark:text-slate-400">{aide}</Text> : null}
    </View>
  );
}

function ChampMotDePasse({
  label,
  value,
  onChange,
  placeholder,
  voir,
  onBasculer,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  voir: boolean;
  /** Absent : pas de bouton afficher / masquer (il agit sur les deux champs). */
  onBasculer?: () => void;
}) {
  return (
    <View className="gap-[7px]">
      <Text className="text-sm font-bold text-[#17201b] dark:text-white">{label}</Text>
      <View className="h-[50px] flex-row items-center pl-3.5 pr-1.5 rounded-[14px] border border-[#d5dcd7] dark:border-slate-700 bg-[#fbfcfb] dark:bg-slate-800">
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!voir}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={label}
          className="flex-1 h-full text-base font-medium text-slate-900 dark:text-white"
        />
        {onBasculer ? (
          <Pressable
            onPress={onBasculer}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="w-11 h-11 items-center justify-center active:opacity-60"
          >
            {voir ? <EyeOff color="#5b665f" size={20} /> : <Eye color="#5b665f" size={20} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
