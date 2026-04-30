import { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { useQuartiers, useCategories } from '../../../../features/lookups/hooks';
import { useClientDraftStore } from '../../../../stores/clientDraftStore';
import { formatFCFA } from '../../../../lib/format';

export default function NouveauClientStep1() {
  const draft = useClientDraftStore((s) => s.draft);
  const setDraft = useClientDraftStore((s) => s.setDraft);
  const { data: quartiers = [] } = useQuartiers();
  const { data: categories = [] } = useCategories();

  const [prenom, setPrenom] = useState(draft.prenom);
  const [nom, setNom] = useState(draft.nom);
  const [contact, setContact] = useState(draft.contact);
  const [email, setEmail] = useState(draft.email);
  const [adresse, setAdresse] = useState(draft.adresse);
  const [quartierId, setQuartierId] = useState<string | null>(draft.quartierId);
  const [categorieId, setCategorieId] = useState<string | null>(draft.categorieId);
  const [prixDeVenteParDefaut, setPrixDeVenteParDefaut] = useState(draft.prixDeVenteParDefaut);
  const [avecRemise, setAvecRemise] = useState(draft.avecRemise);

  // Re-hydrate when the user comes back from step 2 (back swipe)
  useEffect(() => {
    setPrenom(draft.prenom);
    setNom(draft.nom);
    setContact(draft.contact);
    setEmail(draft.email);
    setAdresse(draft.adresse);
    setQuartierId(draft.quartierId);
    setCategorieId(draft.categorieId);
    setPrixDeVenteParDefaut(draft.prixDeVenteParDefaut);
    setAvecRemise(draft.avecRemise);
  }, [draft]);

  const onNext = () => {
    if (!prenom.trim()) return Alert.alert('Erreur', 'Prénom requis');
    if (!nom.trim()) return Alert.alert('Erreur', 'Nom requis');
    if (!contact.trim()) return Alert.alert('Erreur', 'Téléphone requis');
    if (!adresse.trim()) return Alert.alert('Erreur', 'Adresse requise');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Alert.alert('Erreur', 'Email invalide');
    }
    const prix = parseInt(prixDeVenteParDefaut, 10);
    if (Number.isNaN(prix) || prix < 0) {
      return Alert.alert('Erreur', 'Le prix doit être un nombre positif ou zéro');
    }

    setDraft({
      prenom: prenom.trim(),
      nom: nom.trim(),
      contact: contact.trim(),
      email: email.trim(),
      adresse: adresse.trim(),
      quartierId,
      categorieId,
      prixDeVenteParDefaut: String(prix),
      avecRemise,
    });
    router.push('/(livreur)/clients/nouveau/localisation' as never);
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
