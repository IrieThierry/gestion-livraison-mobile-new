import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { X } from 'lucide-react-native';
import { useClientsByLivreur, useEncoursByLivreur } from '../../features/clients/hooks';
import {
  champsRechercheClient,
  indiceClient,
  nomClient,
  soldesParClient,
} from '../../features/clients/affichage';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../lib/recherche';
import { useAuthStore } from '../../stores/authStore';
import { SearchInput } from '../shared/SearchInput';
import type { ClientResponse } from '../../types/api';

/**
 * Choix d'un client : nom, puis « quartier · contact · Dû X FCFA » (solde
 * serveur, « Avance » si négatif, omis si nul ou non chargé). Recherche sur
 * nom, prénom, quartier et contact. Ordre alphabétique du back conservé.
 */
export function ClientPicker({
  value,
  onChange,
}: {
  value: ClientResponse | null;
  onChange: (c: ClientResponse) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data = [], isLoading } = useClientsByLivreur(livreurId);
  const qEncours = useEncoursByLivreur(livreurId);
  const soldes = useMemo(() => soldesParClient(qEncours.data), [qEncours.data]);

  const filtered = useMemo(
    () => filtrerRecherche(data, query, champsRechercheClient),
    [data, query],
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-3.5 active:opacity-70"
      >
        <Text
          className={
            value
              ? 'text-slate-900 dark:text-white text-base'
              : 'text-slate-400 text-base'
          }
        >
          {value ? nomClient(value) : 'Choisir un client'}
        </Text>
        {value ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {indiceClient(value, soldes.get(value.id)) || '—'}
          </Text>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet"
      >
        <View className="flex-1 bg-slate-50 dark:bg-slate-950 pt-4 px-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Choisir un client
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <X color="#64748b" size={22} />
            </Pressable>
          </View>

          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nom, quartier, contact…"
            autoFocus
          />

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            className="mt-3"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text className="text-slate-500 dark:text-slate-400 text-center mt-12">
                {isLoading ? 'Chargement…' : query.trim() ? AUCUN_RESULTAT : 'Aucun client'}
              </Text>
            }
            renderItem={({ item }) => {
              const hint = indiceClient(item, soldes.get(item.id));
              return (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="py-3 border-b border-slate-200 dark:border-slate-800 active:opacity-60"
                >
                  <Text className="font-extrabold text-slate-900 dark:text-white">
                    {nomClient(item)}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    {hint || '—'}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}
