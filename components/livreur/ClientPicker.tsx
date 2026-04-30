import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList } from 'react-native';
import { X } from 'lucide-react-native';
import { useClientsByLivreur } from '../../features/clients/hooks';
import { useAuthStore } from '../../stores/authStore';
import type { ClientResponse } from '../../types/api';

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

  const filtered = query
    ? data.filter((c) =>
        `${c.prenom} ${c.nom}`.toLowerCase().includes(query.toLowerCase()),
      )
    : data;

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
          {value ? `${value.prenom} ${value.nom}` : 'Choisir un client'}
        </Text>
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

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher…"
            placeholderTextColor="#94a3b8"
            autoFocus
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5 text-slate-900 dark:text-white text-base"
          />

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            className="mt-3"
            ListEmptyComponent={
              <Text className="text-slate-500 dark:text-slate-400 text-center mt-12">
                {isLoading ? 'Chargement…' : 'Aucun client'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className="py-3 border-b border-slate-200 dark:border-slate-800 active:opacity-60"
              >
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {item.prenom} {item.nom}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {item.quartier?.libelle ?? '—'}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
