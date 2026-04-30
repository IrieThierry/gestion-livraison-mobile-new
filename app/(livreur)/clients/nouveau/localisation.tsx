import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  MapPin,
  Check,
  ChevronLeft,
  ExternalLink,
  Phone,
  Mail,
  Tag,
  Percent,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { MapPreview } from '../../../../components/livreur/MapPreview';
import { useEnregistrerClient } from '../../../../features/clients/hooks';
import { useQuartiers, useCategories } from '../../../../features/lookups/hooks';
import { useClientDraftStore } from '../../../../stores/clientDraftStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { navigateTo } from '../../../../lib/linking';
import type { CreerClientRequest } from '../../../../types/api';

export default function NouveauClientStep2() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const draft = useClientDraftStore((s) => s.draft);
  const reset = useClientDraftStore((s) => s.reset);
  const { data: quartiers = [] } = useQuartiers();
  const { data: categories = [] } = useCategories();
  const m = useEnregistrerClient();

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
    if (!user) return Alert.alert('Erreur', 'Session expirée');
    if (lat == null || lng == null) {
      return Alert.alert('Erreur', 'Capture la position avant d’enregistrer');
    }

    const prix = parseInt(draft.prixDeVenteParDefaut, 10) || 0;
    const payload: CreerClientRequest = {
      nom: draft.nom,
      prenom: draft.prenom,
      contact: draft.contact,
      email: draft.email,
      adresse: draft.adresse,
      latitudeLongitude: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      quartierId: draft.quartierId ?? '',
      categorieId: draft.categorieId ?? '',
      livreurId: user.id,
      prixDeVenteProduitParDefault: prix,
      avecOuSansRemise: draft.avecRemise,
    };

    m.mutate(payload, {
      onSuccess: () => {
        reset();
        // Pop step 2 + step 1 to land back on the clients list
        router.dismissAll();
        Alert.alert('Succès', 'Client créé');
      },
      onError: (err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        Alert.alert('Erreur', e.response?.data?.message ?? 'Échec de la création');
      },
    });
  };

  const quartierLabel = quartiers.find((q) => q.id === draft.quartierId)?.libelle;
  const categorieLabel = categories.find((c) => c.id === draft.categorieId)?.libelle;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau client" subtitle="Étape 2 / 2 — Localisation" />

      {/* Step indicator */}
      <View className="px-4 pb-2 flex-row items-center gap-2">
        <View className="flex-1 h-1.5 rounded-full bg-emerald-500" />
        <View className="flex-1 h-1.5 rounded-full bg-emerald-500" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-4">
          {/* Map area */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Position GPS du client
            </Text>
            {lat != null && lng != null ? (
              <>
                <MapPreview lat={lat} lng={lng} height={240} />
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </Text>
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    onPress={captureGeo}
                    disabled={capturing}
                    className="flex-1 bg-blue-500 rounded-md py-2.5 flex-row items-center justify-center gap-2 active:opacity-80"
                  >
                    {capturing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MapPin color="#fff" size={16} />
                        <Text className="text-white font-bold text-sm">Recapturer</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigateTo(lat, lng, `${draft.prenom} ${draft.nom}`)
                    }
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md py-2.5 flex-row items-center justify-center gap-2 active:opacity-70"
                  >
                    <ExternalLink color="#3b82f6" size={16} />
                    <Text className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                      Ouvrir dans Maps
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable
                onPress={captureGeo}
                disabled={capturing}
                className="bg-blue-500 rounded-xl py-8 items-center justify-center gap-2 active:opacity-80"
              >
                {capturing ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text className="text-white font-bold text-base">Localisation…</Text>
                  </>
                ) : (
                  <>
                    <MapPin color="#fff" size={28} />
                    <Text className="text-white font-extrabold text-base">
                      Capturer ma position
                    </Text>
                    <Text className="text-white/85 text-[11px]">
                      Tu dois être chez le client
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Recap */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Récapitulatif
            </Text>
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {/* Identity row */}
              <View className="px-4 py-3 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
                  <Text className="text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
                    {(draft.prenom[0] ?? '').toUpperCase()}
                    {(draft.nom[0] ?? '').toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    {draft.prenom} {draft.nom}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    {draft.adresse}
                  </Text>
                </View>
              </View>

              <RecapRow
                icon={Phone}
                color="#10b981"
                label="Téléphone"
                value={draft.contact}
              />
              {draft.email ? (
                <RecapRow icon={Mail} color="#6366f1" label="Email" value={draft.email} />
              ) : null}
              {quartierLabel ? (
                <RecapRow icon={Tag} color="#f59e0b" label="Quartier" value={quartierLabel} />
              ) : null}
              {categorieLabel ? (
                <RecapRow
                  icon={Tag}
                  color="#ec4899"
                  label="Catégorie"
                  value={categorieLabel}
                />
              ) : null}
              <RecapRow
                icon={Percent}
                color="#8b5cf6"
                label="Avec remise"
                value={draft.avecRemise ? 'Oui' : 'Non'}
                last
              />
            </View>

            <Pressable
              onPress={() => router.back()}
              className="mt-2 flex-row items-center gap-1 self-start active:opacity-70"
              hitSlop={6}
            >
              <ChevronLeft color="#10b981" size={14} />
              <Text className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                Modifier les informations
              </Text>
            </Pressable>
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline || lat == null}
            className={`rounded-md py-3.5 mt-2 items-center ${
              !isOnline || lat == null
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline || lat == null ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : lat == null
                    ? 'Capture la position d’abord'
                    : 'Enregistrer le client'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function RecapRow({
  icon: Icon,
  color,
  label,
  value,
  last,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`px-4 py-3 flex-row items-center gap-3 ${
        last ? '' : 'border-t border-slate-100 dark:border-slate-800'
      }`}
    >
      <Icon color={color} size={16} />
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 w-24">{label}</Text>
      <Text className="flex-1 text-right font-bold text-slate-900 dark:text-white">{value}</Text>
    </View>
  );
}
