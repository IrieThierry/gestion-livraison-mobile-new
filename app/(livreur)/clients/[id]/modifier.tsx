import { useState, useMemo, useEffect } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { MapPin, Save, RefreshCw, User, IdCard, Phone, Mail } from 'lucide-react-native';
import * as Location from 'expo-location';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { SelectField } from '../../../../components/shared/SelectField';
import { MapPreview } from '../../../../components/livreur/MapPreview';
import {
  useClientsByLivreur,
  useModifierClient,
} from '../../../../features/clients/hooks';
import {
  useZones,
  useQuartiers,
  useCategories,
} from '../../../../features/lookups/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import type { ClientResponse, ModifierClientRequest } from '../../../../types/api';

function parseLatLng(s: string | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const [a, b] = s.split(',').map((p) => parseFloat(p.trim()));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return null;
}

/**
 * Page de modification d'un client. Pré-remplie avec ses infos actuelles ;
 * permet de mettre à jour identité, contact, quartier (avec sa zone),
 * catégorie, remise, et la position GPS (en re-capturant la position
 * actuelle ou en gardant l'existante).
 *
 * Backend : `PUT /client` avec `ModifierClientRequest`.
 */
export default function ModifierClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const qC = useClientsByLivreur(livreurId);
  const zonesQ = useZones();
  const quartiersQ = useQuartiers();
  const categoriesQ = useCategories();
  const m = useModifierClient();

  const client = useMemo<ClientResponse | undefined>(
    () => (qC.data ?? []).find((c) => c.id === id),
    [qC.data, id],
  );

  // Form state — initialisé une fois client chargé
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [categorieId, setCategorieId] = useState<string | null>(null);
  const [avecRemise, setAvecRemise] = useState(false);
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Hydrate au premier render après chargement du client + lookups
  useEffect(() => {
    if (!client) return;
    setPrenom(client.prenom ?? '');
    setNom(client.nom ?? '');
    setContact(client.contact ?? '');
    setEmail(client.email ?? '');
    setAdresse(client.adresse ?? '');
    setQuartierId(client.quartier?.id ?? null);
    setZoneId(client.quartier?.zone?.id ?? null);
    setCategorieId(client.categorie?.id ?? null);
    setAvecRemise(!!client.avecOuSansRemise);
    setLatLng(parseLatLng(client.latitudeLongitude));
  }, [client]);

  // Quartiers filtrés par zone choisie
  const quartiersOptions = useMemo(() => {
    if (!zoneId) return [];
    return (quartiersQ.data ?? [])
      .filter((q) => q.zone?.id === zoneId)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
      .map((q) => ({ id: q.id, label: q.libelle }));
  }, [quartiersQ.data, zoneId]);

  const zonesOptions = useMemo(
    () =>
      [...(zonesQ.data ?? [])]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map((z) => ({ id: z.id, label: z.libelle })),
    [zonesQ.data],
  );

  const categoriesOptions = useMemo(
    () =>
      [...(categoriesQ.data ?? [])]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map((c) => ({ id: c.id, label: c.libelle })),
    [categoriesQ.data],
  );

  const onChangeZone = (next: string | null) => {
    setZoneId(next);
    // Reset quartier si la zone change ET le quartier actuel n'est pas dans la nouvelle zone
    if (
      next &&
      quartierId &&
      (quartiersQ.data ?? []).find((q) => q.id === quartierId)?.zone?.id !== next
    ) {
      setQuartierId(null);
    }
  };

  const recapturerPosition = async () => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Active la localisation dans les Réglages pour capturer la position.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('Erreur', 'Impossible de capturer la position');
    } finally {
      setCapturing(false);
    }
  };

  const onSubmit = () => {
    if (!user || !client) return;
    if (!prenom.trim()) return Alert.alert('Erreur', 'Prénom requis');
    if (!contact.trim()) return Alert.alert('Erreur', 'Téléphone requis');
    if (!zoneId) return Alert.alert('Erreur', 'Zone requise');
    if (!quartierId) return Alert.alert('Erreur', 'Quartier requis');
    if (!categorieId) return Alert.alert('Erreur', 'Catégorie requise');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Alert.alert('Erreur', 'Email invalide');
    }

    const payload: ModifierClientRequest = {
      id: client.id,
      livreurId: user.id,
      prenom: prenom.trim(),
      nom: nom.trim(),
      contact: contact.trim(),
      email: email.trim(),
      adresse: adresse.trim(),
      latitudeLongitude: latLng ? `${latLng.lat},${latLng.lng}` : (client.latitudeLongitude ?? ''),
      quartierId,
      categorieId,
      // Plan D : marge cristallisée à la livraison ; on garde le champ
      // `prixDeVenteProduitParDefault` à 0 — la marge reverse est portée
      // par avecOuSansRemise.
      prixDeVenteProduitParDefault: 0,
      avecOuSansRemise: avecRemise,
    };

    m.mutate(payload, {
      onSuccess: () => {
        router.back();
        Alert.alert('Succès', 'Client mis à jour');
      },
      onError: (err: unknown) => {
        Alert.alert('Erreur', extractApiErrorMessage(err, 'Mise à jour impossible'));
      },
    });
  };

  if (qC.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (!user) return null;

  if (!client) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Modifier le client" />
        <View className="px-4 py-6">
          <Text className="text-slate-500 dark:text-slate-400 text-center">
            Client introuvable.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Modifier le client"
        subtitle={`${client.prenom} ${client.nom}`.trim()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
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
                <FieldWithIcon label="Prénom *" value={prenom} onChange={setPrenom} icon={User} />
              </View>
              <View className="flex-1">
                <FieldWithIcon label="Nom" value={nom} onChange={setNom} icon={IdCard} />
              </View>
            </View>

            {/* Contact */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FieldWithIcon
                  label="Téléphone *"
                  value={contact}
                  onChange={setContact}
                  keyboardType="phone-pad"
                  icon={Phone}
                />
              </View>
              <View className="flex-1">
                <FieldWithIcon
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  keyboardType="email-address"
                  icon={Mail}
                />
              </View>
            </View>

            {/* Adresse */}
            <View>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Adresse
              </Text>
              <TextInput
                value={adresse}
                onChangeText={setAdresse}
                placeholder="Rue, immeuble, repère…"
                placeholderTextColor="#94a3b8"
                className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-base"
              />
            </View>

            {/* Zone */}
            <SelectField
              label="Zone *"
              placeholder="Choisir une zone"
              value={zoneId}
              onChange={onChangeZone}
              options={zonesOptions}
              isLoading={zonesQ.isLoading}
              emptyMessage="Aucune zone configurée"
            />

            {/* Quartier filtré par zone */}
            <SelectField
              label={
                zoneId
                  ? `Quartier · ${(zonesQ.data ?? []).find((z) => z.id === zoneId)?.libelle ?? ''} *`
                  : 'Quartier *'
              }
              placeholder={zoneId ? 'Choisir un quartier' : "Choisis d'abord une zone"}
              value={quartierId}
              onChange={setQuartierId}
              options={quartiersOptions}
              isLoading={zoneId ? quartiersQ.isLoading : false}
              emptyMessage={
                !zoneId ? "Choisis d'abord une zone" : 'Aucun quartier dans cette zone'
              }
            />

            {/* Catégorie */}
            <SelectField
              label="Catégorie *"
              placeholder="Choisir une catégorie"
              value={categorieId}
              onChange={setCategorieId}
              options={categoriesOptions}
              isLoading={categoriesQ.isLoading}
              emptyMessage="Aucune catégorie configurée"
            />

            {/* Avec remise */}
            <Pressable
              onPress={() => setAvecRemise((v) => !v)}
              className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-3.5 active:opacity-70"
            >
              <View className="flex-1 pr-3">
                <Text className="font-extrabold text-slate-900 dark:text-white">Avec remise</Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Le reversement de marge ne s'applique qu'à ce client si activé
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

            {/* Localisation */}
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-2">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-1.5">
                  <MapPin color="#3b82f6" size={14} />
                  <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                    Position GPS
                  </Text>
                </View>
                <Pressable
                  onPress={recapturerPosition}
                  disabled={capturing}
                  className="flex-row items-center gap-1 bg-blue-100 dark:bg-blue-500/15 px-2.5 py-1.5 rounded-md active:opacity-70"
                >
                  {capturing ? (
                    <ActivityIndicator color="#3b82f6" size="small" />
                  ) : (
                    <RefreshCw color="#3b82f6" size={12} />
                  )}
                  <Text className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    Recapturer
                  </Text>
                </Pressable>
              </View>
              {latLng ? (
                <>
                  <MapPreview lat={latLng.lat} lng={latLng.lng} height={160} />
                  <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2 font-mono">
                    {latLng.lat.toFixed(6)}, {latLng.lng.toFixed(6)}
                  </Text>
                </>
              ) : (
                <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
                  Aucune position enregistrée — tape « Recapturer » pour ajouter.
                </Text>
              )}
            </View>

            {/* Submit */}
            <Pressable
              onPress={onSubmit}
              disabled={m.isPending}
              className="bg-emerald-500 rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 active:opacity-80"
            >
              {m.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Save color="#fff" size={16} />
                  <Text className="text-white font-bold text-base">
                    Enregistrer les modifications
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldWithIcon({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address' | 'default';
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
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={false}
          className="flex-1 px-3 py-3.5 text-slate-900 dark:text-white text-base"
        />
      </View>
    </View>
  );
}
