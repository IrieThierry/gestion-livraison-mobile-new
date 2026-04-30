import { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { SelectField } from '../../../../components/shared/SelectField';
import {
  useQuartiers,
  useCategories,
  useZones,
} from '../../../../features/lookups/hooks';
import { useClientDraftStore } from '../../../../stores/clientDraftStore';

export default function NouveauClientStep1() {
  const draft = useClientDraftStore((s) => s.draft);
  const setDraft = useClientDraftStore((s) => s.setDraft);
  const zonesQ = useZones();
  const quartiersQ = useQuartiers();
  const categoriesQ = useCategories();
  const zones = zonesQ.data ?? [];
  const quartiers = quartiersQ.data ?? [];
  const categories = categoriesQ.data ?? [];

  const [prenom, setPrenom] = useState(draft.prenom);
  const [nom, setNom] = useState(draft.nom);
  const [contact, setContact] = useState(draft.contact);
  const [email, setEmail] = useState(draft.email);
  const [adresse, setAdresse] = useState(draft.adresse);
  const [quartierId, setQuartierId] = useState<string | null>(draft.quartierId);
  const [categorieId, setCategorieId] = useState<string | null>(draft.categorieId);
  const [avecRemise, setAvecRemise] = useState(draft.avecRemise);
  const initialZoneId =
    quartiers.find((q) => q.id === draft.quartierId)?.zone?.id ?? null;
  const [zoneId, setZoneId] = useState<string | null>(initialZoneId);

  // Re-hydrate when the user comes back from step 2 (back swipe)
  useEffect(() => {
    setPrenom(draft.prenom);
    setNom(draft.nom);
    setContact(draft.contact);
    setEmail(draft.email);
    setAdresse(draft.adresse);
    setQuartierId(draft.quartierId);
    setCategorieId(draft.categorieId);
    setAvecRemise(draft.avecRemise);
  }, [draft]);

  // Quartiers strictement filtrés par la zone choisie. Si pas de zone,
  // la liste est vide — l'utilisateur doit d'abord choisir sa zone.
  const quartiersOptions = useMemo(() => {
    if (!zoneId) return [];
    return quartiers
      .filter((q) => q.zone?.id === zoneId)
      .map((q) => ({ id: q.id, label: q.libelle }));
  }, [quartiers, zoneId]);

  const zonesOptions = useMemo(
    () => zones.map((z) => ({ id: z.id, label: z.libelle })),
    [zones],
  );
  const categoriesOptions = useMemo(
    () => categories.map((c) => ({ id: c.id, label: c.libelle })),
    [categories],
  );

  const onChangeZone = (next: string | null) => {
    setZoneId(next);
    // Reset quartier if it's no longer in the new zone
    if (
      next &&
      quartierId &&
      quartiers.find((q) => q.id === quartierId)?.zone?.id !== next
    ) {
      setQuartierId(null);
    }
  };

  const onNext = () => {
    // Aligned with backend CreerClientUseCase.validateInput :
    //   required → prenom, contact, quartierId, categorieId, latitudeLongitude (step 2)
    //   optional côté back → nom, email, adresse
    // Côté UX mobile, on impose en plus le choix d'une Zone (le quartier
    // n'a pas vraiment de sens hors zone), même si le back-office l'extraira
    // de la jointure quartier.zone.
    if (!prenom.trim()) return Alert.alert('Erreur', 'Prénom requis');
    if (!contact.trim()) return Alert.alert('Erreur', 'Téléphone requis');
    if (!zoneId) return Alert.alert('Erreur', 'Zone requise');
    if (!quartierId) return Alert.alert('Erreur', 'Quartier requis');
    if (!categorieId) return Alert.alert('Erreur', 'Catégorie requise');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Alert.alert('Erreur', 'Email invalide');
    }

    setDraft({
      prenom: prenom.trim(),
      nom: nom.trim(),
      contact: contact.trim(),
      email: email.trim(),
      adresse: adresse.trim(),
      quartierId,
      categorieId,
      // Field removed from the form — keep at default 0 in the draft for
      // backward compat with the store's existing shape.
      prixDeVenteParDefaut: '0',
      avecRemise,
    });
    router.push('/(livreur)/clients/nouveau/localisation' as never);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau client" subtitle="Étape 1 / 2 — Informations" />

      {/* Step indicator */}
      <View className="px-4 pb-2 flex-row items-center gap-2">
        <View className="flex-1 h-1.5 rounded-full bg-emerald-500" />
        <View className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 gap-3">
          {/* Identity */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Prénom *" value={prenom} onChange={setPrenom} placeholder="Marc" />
            </View>
            <View className="flex-1">
              <Field
                label="Nom"
                value={nom}
                onChange={setNom}
                placeholder="Konan"
              />
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

          {/* Adresse — optionnel */}
          <Field
            label="Adresse"
            value={adresse}
            onChange={setAdresse}
            placeholder="Rue, immeuble, repère…"
          />

          {/* Zone — obligatoire (filtre les quartiers) */}
          <SelectField
            label="Zone *"
            placeholder="Choisir une zone"
            value={zoneId}
            onChange={onChangeZone}
            options={zonesOptions}
            isLoading={zonesQ.isLoading}
            emptyMessage="Aucune zone configurée"
          />

          {/* Quartier — obligatoire, filtré par la zone choisie */}
          <SelectField
            label={
              zoneId
                ? `Quartier · ${zones.find((z) => z.id === zoneId)?.libelle ?? ''} *`
                : 'Quartier *'
            }
            placeholder={zoneId ? 'Choisir un quartier' : 'Choisis d’abord une zone'}
            value={quartierId}
            onChange={setQuartierId}
            options={quartiersOptions}
            isLoading={zoneId ? quartiersQ.isLoading : false}
            emptyMessage={
              !zoneId
                ? 'Choisis d’abord une zone'
                : 'Aucun quartier dans cette zone'
            }
          />

          {/* Catégorie — obligatoire */}
          <SelectField
            label="Catégorie *"
            placeholder="Choisir une catégorie"
            value={categorieId}
            onChange={setCategorieId}
            options={categoriesOptions}
            isLoading={categoriesQ.isLoading}
            emptyMessage="Aucune catégorie configurée"
          />

          {/* Avec remise — toggle */}
          <Pressable
            onPress={() => setAvecRemise((v) => !v)}
            className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-3.5 active:opacity-70"
          >
            <View className="flex-1 pr-3">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                Avec remise
              </Text>
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

          {/* Next */}
          <Pressable
            onPress={onNext}
            className="bg-emerald-500 rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Suivant</Text>
            <ArrowRight color="#fff" size={18} />
          </Pressable>

          <Text className="text-[10px] text-slate-400 text-center mt-1">
            * Champs obligatoires. Étape suivante : géolocalisation et confirmation.
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
