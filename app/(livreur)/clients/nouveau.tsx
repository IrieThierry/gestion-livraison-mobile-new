import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MapPin, Check } from 'lucide-react-native';
import * as Location from 'expo-location';
import { PageHeader } from '../../../components/shared/PageHeader';
import { useEnregistrerClient } from '../../../features/clients/hooks';
import { useQuartiers } from '../../../features/lookups/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import type { CreerClientRequest } from '../../../types/api';

export default function NouveauClient() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { data: quartiers = [] } = useQuartiers();
  const m = useEnregistrerClient();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  const captureGeo = async () => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la localisation dans les Réglages iOS.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    } catch {
      Alert.alert('Erreur', 'Impossible de capturer la position');
    } finally {
      setCapturing(false);
    }
  };

  const onSubmit = () => {
    if (!user) {
      Alert.alert('Erreur', 'Session expirée');
      return;
    }
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Erreur', 'Prénom et nom requis');
      return;
    }

    // Le DTO `CreerClientRequest` du back exige tous les champs (cf.
    // schema web zod). Pour le livreur on remplit l'essentiel et on
    // pousse des valeurs neutres pour le reste : le back-office pourra
    // compléter plus tard si besoin.
    const payload: CreerClientRequest = {
      nom: nom.trim(),
      prenom: prenom.trim(),
      contact: contact.trim(),
      email: '',
      adresse: '',
      latitudeLongitude: lat != null && lng != null ? `${lat},${lng}` : '',
      quartierId: quartierId ?? '',
      categorieId: '',
      livreurId: user.id,
      prixDeVenteProduitParDefault: 0,
      avecOuSansRemise: false,
    };

    m.mutate(payload, {
      onSuccess: () => {
        router.back();
        Alert.alert('Succès', 'Client créé');
      },
      onError: (err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        Alert.alert('Erreur', e.response?.data?.message ?? 'Échec de la création');
      },
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau client" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3">
          <Field label="Prénom" value={prenom} onChange={setPrenom} placeholder="Marc" />
          <Field label="Nom" value={nom} onChange={setNom} placeholder="Konan" />
          <Field
            label="Téléphone"
            value={contact}
            onChange={setContact}
            placeholder="07 12 34 56 78"
            keyboardType="phone-pad"
          />

          {/* Quartier chip row */}
          {quartiers.length > 0 ? (
            <View>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Quartier
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {quartiers.map((q) => (
                  <Pressable
                    key={q.id}
                    onPress={() => setQuartierId(q.id === quartierId ? null : q.id)}
                    className={`px-3 py-2 rounded-md ${
                      quartierId === q.id
                        ? 'bg-emerald-500'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        quartierId === q.id ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {q.libelle}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Geoloc capture */}
          <Pressable
            onPress={captureGeo}
            disabled={capturing}
            className={`rounded-md py-3 flex-row items-center justify-center gap-2 mt-2 active:opacity-80 ${
              lat != null ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : lat != null ? (
              <>
                <Check color="#fff" size={18} />
                <Text className="text-white font-bold">Position capturée</Text>
              </>
            ) : (
              <>
                <MapPin color="#fff" size={18} />
                <Text className="text-white font-bold">Capturer ma position</Text>
              </>
            )}
          </Pressable>
          {lat != null ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              {lat.toFixed(5)}, {lng?.toFixed(5)}
            </Text>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline}
            className={`rounded-md py-3.5 mt-3 items-center ${
              !isOnline ? 'bg-slate-200 dark:bg-slate-800' : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${!isOnline ? 'text-slate-400' : 'text-white'}`}>
                {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Enregistrer'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'default';
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
        className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
      />
    </View>
  );
}
