import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  Eye,
  EyeOff,
  UserPlus,
  AtSign,
  Lock,
  Phone,
  Mail,
  User,
  IdCard,
} from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { useCreerApprenti } from '../../../../features/apprentis/hooks';
import { extractApiErrorMessage } from '../../../../lib/api-error';

/**
 * Formulaire de création d'un apprenti. Mirror simplifié de
 * `ApprentiFormSheet` du portail web. Le `parentId` est ajouté côté hook
 * via `useCreerApprenti` à partir de l'utilisateur connecté.
 *
 * UX :
 *  - Icônes lucide à gauche de chaque champ pour identifier rapidement
 *  - Œil sur le champ mot de passe pour basculer visible/masqué
 *  - KeyboardAvoidingView + keyboardShouldPersistTaps pour que le clavier
 *    ne masque pas le champ en cours d'édition (ex : password en bas)
 */
export default function NouveauApprenti() {
  const m = useCreerApprenti();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = () => {
    if (prenom.trim().length < 2) {
      Alert.alert('Erreur', 'Prénom trop court');
      return;
    }
    if (nom.trim().length < 2) {
      Alert.alert('Erreur', 'Nom trop court');
      return;
    }
    if (!/^[0-9]{10}$/.test(contact.trim())) {
      Alert.alert('Erreur', 'Téléphone : 10 chiffres requis');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Erreur', 'Email invalide');
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert('Erreur', "Nom d'utilisateur min 3 caractères");
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Mot de passe min 6 caractères');
      return;
    }

    m.mutate(
      {
        prenom: prenom.trim(),
        nom: nom.trim(),
        contact: contact.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
      },
      {
        onSuccess: () => {
          Alert.alert(
            'Apprenti créé',
            `${prenom} ${nom} peut maintenant se connecter avec son nom d'utilisateur et le mot de passe que tu lui as fourni.`,
          );
          router.back();
        },
        onError: (err: unknown) => {
          Alert.alert(
            'Erreur',
            extractApiErrorMessage(err, 'Création impossible'),
          );
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvel apprenti" subtitle="Crée un compte rattaché à toi" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        // Sur Android, soustrait la hauteur du header pour que le clavier
        // calcule correctement. iOS gère ça via le SafeAreaView au-dessus.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-4 pt-3 gap-3">
            {/* Identité */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FieldWithIcon
                  label="Prénom *"
                  value={prenom}
                  onChange={setPrenom}
                  placeholder="Paul"
                  icon={User}
                />
              </View>
              <View className="flex-1">
                <FieldWithIcon
                  label="Nom *"
                  value={nom}
                  onChange={setNom}
                  placeholder="Diallo"
                  icon={IdCard}
                />
              </View>
            </View>

            {/* Contact */}
            <FieldWithIcon
              label="Téléphone *"
              value={contact}
              onChange={setContact}
              placeholder="0712345678"
              keyboardType="phone-pad"
              hint="10 chiffres, sans espaces"
              icon={Phone}
            />

            <FieldWithIcon
              label="Email (optionnel)"
              value={email}
              onChange={setEmail}
              placeholder="paul@…"
              keyboardType="email-address"
              icon={Mail}
            />

            {/* Identifiants */}
            <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mt-3">
              <Text className="text-[12px] font-bold text-amber-700 dark:text-amber-400 mb-1">
                Identifiants de connexion
              </Text>
              <Text className="text-[11px] text-amber-700 dark:text-amber-400">
                Communique-les à ton apprenti — il pourra changer son mot de
                passe après sa première connexion depuis Profil.
              </Text>
            </View>

            <FieldWithIcon
              label="Nom d'utilisateur *"
              value={username}
              onChange={setUsername}
              placeholder="paul"
              autoCapitalize="none"
              hint="Min 3 caractères, sans espaces"
              icon={AtSign}
            />

            {/* Mot de passe — input à droite avec œil + icône cadenas à gauche */}
            <View>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Mot de passe initial *
              </Text>
              <View className="flex-row items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
                <View className="pl-3.5">
                  <Lock color="#64748b" size={16} />
                </View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min 6 caractères"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  className="flex-1 px-3 py-3.5 text-slate-900 dark:text-white text-base"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  className="px-3 py-3.5 active:opacity-60"
                >
                  {showPassword ? (
                    <EyeOff color="#64748b" size={18} />
                  ) : (
                    <Eye color="#64748b" size={18} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Submit */}
            <Pressable
              onPress={onSubmit}
              disabled={m.isPending}
              className="bg-emerald-500 rounded-md py-3.5 mt-4 flex-row items-center justify-center gap-2 active:opacity-80"
            >
              {m.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <UserPlus color="#fff" size={16} />
                  <Text className="text-white font-bold text-base">
                    Créer l'apprenti
                  </Text>
                </>
              )}
            </Pressable>

            <Text className="text-[10px] text-slate-400 text-center mt-1">
              * Champs obligatoires
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Field avec icône à gauche. Toutes les inputs du form (sauf le mot
 * de passe) passent par ce composant pour rester cohérent visuellement.
 */
function FieldWithIcon({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  hint?: string;
  icon: React.ComponentType<{ color: string; size: number }>;
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>
      <View className="flex-row items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
        <View className="pl-3.5">
          <Icon color="#64748b" size={16} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={
            autoCapitalize ??
            (keyboardType === 'email-address' ? 'none' : 'sentences')
          }
          autoCorrect={false}
          className="flex-1 px-3 py-3.5 text-slate-900 dark:text-white text-base"
        />
      </View>
      {hint ? (
        <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
