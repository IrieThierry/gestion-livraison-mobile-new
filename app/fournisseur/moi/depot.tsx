import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { FormScreen } from '../../../components/shared/FormScreen';
import { MapPreview } from '../../../components/livreur/MapPreview';
import { useDepot, useEnregistrerDepot, useRetirerDepot } from '../../../features/depot/hooks';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { dialog } from '../../../lib/dialog';
import { lirePosition, formaterPosition } from '../../../lib/position';
import { revenirApresEnregistrement } from '../../../lib/navigation-app';

const NOM_PAR_DEFAUT = 'Dépôt principal';
const LABEL = 'text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 mt-3';
const CHAMP =
  'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2.5 text-slate-900 dark:text-white';

/**
 * Moi › « Mon dépôt » : position GPS (lue sur demande, jamais au montage), nom, adresse,
 * aperçu sur la mini-carte, enregistrement et retrait.
 */
export default function DepotFournisseur() {
  const q = useDepot();
  const enregistrer = useEnregistrerDepot();
  const retirer = useRetirerDepot();
  const [nom, setNom] = useState(NOM_PAR_DEFAUT);
  const [adresse, setAdresse] = useState('');
  const [position, setPosition] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [refus, setRefus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setNom(q.data.nom);
      setAdresse(q.data.adresse ?? '');
      setPosition(q.data.position);
    }
  }, [q.data]);

  const utiliserMaPosition = async () => {
    setLecture(true);
    setRefus(false);
    setErreur(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setRefus(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition(formaterPosition(pos.coords.latitude, pos.coords.longitude));
    } catch {
      setErreur('Impossible de lire ta position.');
    } finally {
      setLecture(false);
    }
  };

  const point = lirePosition(position);
  const nomNet = nom.trim();

  const onEnregistrer = () => {
    if (!point || !position) return;
    setErreur(null);
    enregistrer.mutate(
      { nom: nomNet, position, adresse: adresse.trim() || null },
      {
        onSuccess: () => {
          dialog.success('Dépôt enregistré');
          revenirApresEnregistrement('/fournisseur/moi');
        },
        onError: (e: unknown) => setErreur(extractApiErrorMessage(e, "Impossible d'enregistrer le dépôt.")),
      },
    );
  };

  const onRetirer = () => {
    dialog.confirm({
      title: 'Retirer le dépôt ?',
      message: 'Tes livreurs ne verront plus ce dépôt ni son itinéraire.',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () =>
        retirer.mutate(undefined, {
          onSuccess: () => {
            setNom(NOM_PAR_DEFAUT);
            setAdresse('');
            setPosition(null);
          },
          onError: (e: unknown) => setErreur(extractApiErrorMessage(e, 'Impossible de retirer le dépôt.')),
        }),
    });
  };

  if (q.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#047857" />
      </View>
    );
  }

  const peutEnregistrer = !!point && nomNet.length > 0 && !enregistrer.isPending;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Mon dépôt" />
      <FormScreen>
        <View className="px-4">
          <Pressable
            onPress={utiliserMaPosition}
            disabled={lecture}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-md py-3 bg-emerald-700 active:opacity-80"
          >
            {lecture ? <ActivityIndicator color="#fff" /> : <LocateFixed color="#fff" size={16} />}
            <Text className="text-white font-bold">Utiliser ma position actuelle</Text>
          </Pressable>
          {refus ? (
            <Text className="text-[12px] text-red-600 dark:text-red-400 mt-2">
              Autorise la localisation pour utiliser ta position
            </Text>
          ) : null}

          {point ? (
            <View className="mt-3">
              <MapPreview lat={point.lat} lng={point.lng} height={200} />
            </View>
          ) : null}

          <Text className={LABEL}>Nom du dépôt</Text>
          <TextInput
            value={nom}
            onChangeText={setNom}
            maxLength={60}
            accessibilityLabel="Nom du dépôt"
            placeholder={NOM_PAR_DEFAUT}
            placeholderTextColor="#94a3b8"
            className={CHAMP}
          />
          <Text className={LABEL}>Adresse (facultative)</Text>
          <TextInput
            value={adresse}
            onChangeText={setAdresse}
            maxLength={200}
            accessibilityLabel="Adresse du dépôt"
            placeholder="Rue, quartier, repère…"
            placeholderTextColor="#94a3b8"
            className={CHAMP}
          />

          {erreur ? <Text className="text-[12px] text-red-600 dark:text-red-400 mt-3">{erreur}</Text> : null}

          <Pressable
            onPress={onEnregistrer}
            disabled={!peutEnregistrer}
            accessibilityRole="button"
            className={`rounded-md py-3.5 mt-5 items-center ${
              peutEnregistrer ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          >
            <Text className={`font-bold ${peutEnregistrer ? 'text-white' : 'text-slate-400'}`}>Enregistrer</Text>
          </Pressable>

          {q.data ? (
            <Pressable
              onPress={onRetirer}
              disabled={retirer.isPending}
              accessibilityRole="button"
              className="rounded-md py-3.5 mt-3 items-center border border-red-300 dark:border-red-500/40 active:opacity-70"
            >
              <Text className="font-bold text-red-600 dark:text-red-400">Retirer le dépôt</Text>
            </Pressable>
          ) : null}
        </View>
      </FormScreen>
    </View>
  );
}
