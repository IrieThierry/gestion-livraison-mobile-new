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
import { useQuartiers, useCategories } from '../../../features/lookups/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { formatFCFA } from '../../../lib/format';
import type { CreerClientRequest } from '../../../types/api';

export default function NouveauClient() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { data: quartiers = [] } = useQuartiers();
  const { data: categories = [] } = useCategories();
  const m = useEnregistrerClient();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [categorieId, setCategorieId] = useState<string | null>(null);
  const [prixDeVenteParDefaut, setPrixDeVenteParDefaut] = useState('0');
  const [avecRemise, setAvecRemise] = useState(false);
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
    // Mirror the web schema's required fields (clients/schemas.ts)
    if (!prenom.trim()) return Alert.alert('Erreur', 'Prénom requis');
    if (!nom.trim()) return Alert.alert('Erreur', 'Nom requis');
    if (!contact.trim()) return Alert.alert('Erreur', 'Téléphone requis');
    if (!adresse.trim()) return Alert.alert('Erreur', 'Adresse requise');
    if (lat == null || lng == null) {
      return Alert.alert(
        'Erreur',
        'Capture la géolocalisation avant d’enregistrer (bouton « Capturer ma position »)',
      );
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Alert.alert('Erreur', 'Email invalide');
    }
    const prix = parseInt(prixDeVenteParDefaut, 10);
    if (Number.isNaN(prix) || prix < 0) {
      return Alert.alert('Erreur', 'Le prix doit être un nombre positif');
    }

    // Match the web's CreerClientRequest payload exactly
    const payload: CreerClientRequest = {
      nom: nom.trim(),
      prenom: prenom.trim(),
      contact: contact.trim(),
      email: email.trim(),
      adresse: adresse.trim(),
      latitudeLongitude: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      quartierId: quartierId ?? '',
      categorieId: categorieId ?? '',
      livreurId: user.id,
      prixDeVenteProduitParDefault: prix,
      avecOuSansRemise: avecRemise,
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

  const Pill = ({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className={`px-3 py-2 rounded-md ${
        active
          ? 'bg-emerald-500'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text
        className={`text-sm font-bold ${
          active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau client" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3">
          {/* Identity */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Prénom *" value={prenom} onChange={setPrenom} placeholder="Marc" />
            </View>
            <View className="flex-1">
              <Field label="Nom *" value={nom} onChange={setNom} placeholder="Konan" />
            </View>
          </View>

          {/* Contact */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Téléphone *"
                value={contact}
                onChange={setContact}
                placeholder="07 12 34 56 78"
                keyboardType="phone-pad"
              />
            </View>
            <View className="flex-1">
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="marc@…"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Adresse */}
          <Field
            label="Adresse *"
            value={adresse}
            onChange={setAdresse}
            placeholder="Rue, immeuble, repère…"
          />

          {/* Geoloc */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Géolocalisation *
            </Text>
            <Pressable
              onPress={captureGeo}
              disabled={capturing}
              className={`rounded-md py-3 flex-row items-center justify-center gap-2 active:opacity-80 ${
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
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-1">
                {lat.toFixed(5)}, {lng?.toFixed(5)}
              </Text>
            ) : null}
          </View>

          {/* Quartier */}
          {quartiers.length > 0 ? (
            <View>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Quartier
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {quartiers.map((q) => (
                  <Pill
                    key={q.id}
                    active={quartierId === q.id}
                    label={q.libelle}
                    onPress={() => setQuartierId(q.id === quartierId ? null : q.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Catégorie */}
          {categories.length > 0 ? (
            <View>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Catégorie
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {categories.map((c) => (
                  <Pill
                    key={c.id}
                    active={categorieId === c.id}
                    label={c.libelle}
                    onPress={() => setCategorieId(c.id === categorieId ? null : c.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Pricing */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Prix de vente par défaut (FCFA)
            </Text>
            <TextInput
              value={prixDeVenteParDefaut}
              onChangeText={setPrixDeVenteParDefaut}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
            />
            {parseInt(prixDeVenteParDefaut, 10) > 0 ? (
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Pré-rempli sur les nouvelles livraisons :{' '}
                {formatFCFA(parseInt(prixDeVenteParDefaut, 10))} FCFA
              </Text>
            ) : null}
          </View>

          {/* Avec remise — toggle */}
          <Pressable
            onPress={() => setAvecRemise((v) => !v)}
            className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-3.5 active:opacity-70"
          >
            <View className="flex-1 pr-3">
              <Text className="font-extrabold text-slate-900 dark:text-white">Avec remise</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Ce client bénéficie de remises spéciales
              </Text>
            </View>
            <View
              className={`w-12 h-7 rounded-full justify-center px-0.5 ${
                avecRemise ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${avecRemise ? 'self-end' : 'self-start'}`}
              />
            </View>
          </Pressable>

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

          <Text className="text-[10px] text-slate-400 text-center mt-1">
            * Champs obligatoires. Le livreur est défini automatiquement (toi).
          </Text>
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
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
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
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
      />
    </View>
  );
}
