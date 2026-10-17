import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Check } from 'lucide-react-native';
import { PageHeader } from '../shared/PageHeader';
import { FormScreen } from '../shared/FormScreen';
import { ChampTexte } from './ChampTexte';
import {
  erreurClient,
  useCreerClientFournisseur,
  useModifierClientFournisseur,
} from '../../features/fournisseur/clients';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { useNetworkStore } from '../../stores/networkStore';
import { dialog } from '../../lib/dialog';
import { extractApiErrorMessage } from '../../lib/api-error';
import { retourParent } from '../../lib/navigation-app';
import type { ClientFournisseurResponse } from '../../types/api';

/**
 * Création (sans `client`) ou modification d'un client du guichet : nom,
 * téléphone facultatif et, en modification, actif ou inactif. Mêmes règles que
 * le portail web.
 */
export function FormulaireClient({ client }: { client?: ClientFournisseurResponse }) {
  const pathname = usePathname();
  const creer = useCreerClientFournisseur();
  const modifier = useModifierClientFournisseur();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [nom, setNom] = useState(client?.nom ?? '');
  const [contact, setContact] = useState(client?.contact ?? '');
  const [actif, setActif] = useState(client?.actif ?? true);
  const [erreurs, setErreurs] = useState<{ nom?: string; contact?: string } | null>(null);
  const enCours = creer.isPending || modifier.isPending;

  const envoyer = () => {
    const e = erreurClient(nom, contact);
    setErreurs(e);
    if (e) {
      dialog.warning('Champ invalide', e.nom ?? e.contact);
      return;
    }
    const corps = { nom: nom.trim(), contact: contact.trim() };
    const apres = {
      onSuccess: () => {
        retourParent(pathname);
        dialog.success(client ? 'Client mis à jour' : 'Client créé');
      },
      onError: (err: unknown) => dialog.error('Enregistrement impossible', extractApiErrorMessage(err, 'Le client n’a pas pu être enregistré.')),
    };
    lancerUneFois(verrou, (fin) =>
      client
        ? modifier.mutate({ id: client.id, ...corps, actif }, { ...apres, onSettled: fin })
        : creer.mutate(corps, { ...apres, onSettled: fin }),
    );
  };

  const peutEnvoyer = isOnline && !enCours;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={client ? `Modifier ${client.nom}` : 'Nouveau client'} subtitle="Client du guichet" />
      <FormScreen>
        <View className="px-4 pt-3 gap-3">
          <ChampTexte
            label="Nom du client"
            value={nom}
            onChangeText={(t) => {
              setNom(t);
              if (erreurs?.nom) setErreurs({ ...erreurs, nom: undefined });
            }}
            maxLength={100}
            autoCapitalize="characters"
            erreur={erreurs?.nom}
          />
          <ChampTexte
            label="Téléphone (optionnel)"
            value={contact}
            onChangeText={(t) => {
              setContact(t);
              if (erreurs?.contact) setErreurs({ ...erreurs, contact: undefined });
            }}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="0712345678"
            aide="10 chiffres, commence par 01, 05 ou 07"
            erreur={erreurs?.contact}
          />
          {client ? (
            <View className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-extrabold text-slate-900 dark:text-white">Client actif</Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Un client inactif n’apparaît plus parmi ceux que le commis peut servir.
                </Text>
              </View>
              <Switch value={actif} onValueChange={setActif} accessibilityLabel="Client actif" />
            </View>
          ) : null}
          <Pressable
            onPress={envoyer}
            disabled={!peutEnvoyer}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le client"
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${peutEnvoyer ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-300 dark:bg-slate-800'}`}
          >
            {enCours ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Check color="#fff" size={16} />
                <Text className="text-white font-bold text-base">Enregistrer</Text>
              </>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
