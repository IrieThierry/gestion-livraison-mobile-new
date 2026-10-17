import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { Save } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { ChampTexte } from '../../../../components/fournisseur/ChampTexte';
import {
  commisModificationSchema,
  nomCommis,
  payloadModificationCommis,
  useCommisFournisseur,
  useModifierCommis,
} from '../../../../features/fournisseur/commis';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { retourParent } from '../../../../lib/navigation-app';
import type { CommisResponse } from '../../../../types/api';

/**
 * Mes commis → Modifier : nom, prénom, téléphone et identifiant d'un commis.
 * Mêmes règles qu'à la création ; le mot de passe se change par
 * « Réinitialiser » depuis la liste.
 */
export default function ModifierCommis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCommisFournisseur();
  const commis = q.data?.find((c) => c.id === id);
  if (!commis) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Modifier le commis" />
        <Text className="text-slate-400 text-sm px-4 pt-2">{q.isLoading ? 'Chargement…' : 'Commis introuvable.'}</Text>
      </View>
    );
  }
  return <Formulaire key={commis.id} commis={commis} />;
}

function Formulaire({ commis }: { commis: CommisResponse }) {
  const pathname = usePathname();
  const m = useModifierCommis();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [prenom, setPrenom] = useState(commis.prenom);
  const [nom, setNom] = useState(commis.nom);
  const [contact, setContact] = useState(commis.contact ?? '');
  const [username, setUsername] = useState(commis.username);

  const envoyer = () => {
    const parsed = commisModificationSchema.safeParse({ prenom, nom, contact, username });
    if (!parsed.success) {
      dialog.warning('Champ invalide', parsed.error.issues[0]?.message);
      return;
    }
    const payload = payloadModificationCommis(parsed.data);
    lancerUneFois(verrou, (fin) =>
      m.mutate(
        { id: commis.id, payload },
        {
          onSuccess: () => {
            retourParent(pathname);
            dialog.success('Commis modifié', `Les informations de ${nomCommis(payload)} sont à jour.`);
          },
          onError: (e) => dialog.error('Modification impossible', extractApiErrorMessage(e, 'Modification impossible')),
          onSettled: fin,
        },
      ),
    );
  };

  const actif = isOnline && !m.isPending;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Modifier le commis" subtitle={nomCommis(commis)} />
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
            aide="3 à 50 caractères, insensible à la casse. Le commis se connecte ensuite avec ce nom."
          />
          <Pressable
            onPress={envoyer}
            disabled={!actif}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le commis"
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-300 dark:bg-slate-800'}`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color="#fff" size={16} />
                <Text className="text-white font-bold text-base">Enregistrer</Text>
              </>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
