import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { ChampTexte } from '../../../../components/fournisseur/ChampTexte';
import { commisSchema, nomCommis, payloadCommis, useCreerCommis } from '../../../../features/fournisseur/commis';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { retourParent } from '../../../../lib/navigation-app';

/**
 * Mes commis : création d'un commis rattaché à l'entreprise. Mêmes règles que
 * le portail web (nom, prénom, téléphone 01/05/07, identifiant, mot de passe
 * provisoire). Il se connecte sur l'application et change son mot de passe à
 * sa première connexion.
 */
export default function NouveauCommis() {
  const pathname = usePathname();
  const m = useCreerCommis();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const envoyer = () => {
    const parsed = commisSchema.safeParse({ prenom, nom, contact, username, password });
    if (!parsed.success) {
      dialog.warning('Champ invalide', parsed.error.issues[0]?.message);
      return;
    }
    const payload = payloadCommis(parsed.data);
    lancerUneFois(verrou, (fin) =>
      m.mutate(payload, {
        onSuccess: () => {
          retourParent(pathname);
          dialog.success('Commis créé', `${nomCommis(payload)} peut maintenant se connecter avec son identifiant et le mot de passe provisoire.`);
        },
        onError: (e) => dialog.error('Création impossible', extractApiErrorMessage(e, 'Création impossible')),
        onSettled: fin,
      }),
    );
  };

  const actif = isOnline && !m.isPending;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau commis" subtitle="Rattaché à ton entreprise" />
      <FormScreen>
        <View className="px-4 pt-3 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <ChampTexte label="Prénom" value={prenom} onChangeText={setPrenom} autoComplete="off" />
            </View>
            <View className="flex-1">
              <ChampTexte label="Nom" value={nom} onChangeText={setNom} autoComplete="off" />
            </View>
          </View>
          <ChampTexte
            label="Téléphone"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="0712345678"
            aide="10 chiffres, commence par 01, 05 ou 07"
          />
          <ChampTexte
            label="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="off"
            aide="3 à 50 caractères, insensible à la casse"
          />
          <ChampTexte
            label="Mot de passe provisoire"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            aide="6 caractères au moins. Le commis le remplacera à sa première connexion."
          />
          <Pressable
            onPress={envoyer}
            disabled={!actif}
            accessibilityRole="button"
            accessibilityLabel="Créer le commis"
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-300 dark:bg-slate-800'}`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus color="#fff" size={16} />
                <Text className="text-white font-bold text-base">Créer le commis</Text>
              </>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
