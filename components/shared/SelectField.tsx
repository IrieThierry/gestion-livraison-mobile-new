import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { ChevronDown, X, Check } from 'lucide-react-native';

export interface SelectOption {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Dropdown picker — Pressable trigger ouvre un Modal avec FlatList +
 * recherche. Adapté aux longues listes (zones, quartiers, catégories
 * avec dizaines d'éléments). Pas de native-module : pure JSX.
 */
export function SelectField({
  label,
  placeholder = 'Choisir…',
  value,
  options,
  onChange,
  isLoading,
  emptyMessage,
  optional = false,
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (next: string | null) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const needle = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        (o.hint ?? '').toLowerCase().includes(needle),
    );
  }, [options, search]);

  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
        {optional ? ' (optionnel)' : ''}
      </Text>
      <Pressable
        onPress={() => {
          if (!isLoading && options.length > 0) setOpen(true);
        }}
        className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex-row items-center gap-2 active:opacity-70"
      >
        <Text
          className={
            selected
              ? 'text-slate-900 dark:text-white text-base flex-1'
              : 'text-slate-400 text-base flex-1'
          }
        >
          {isLoading
            ? 'Chargement…'
            : options.length === 0
              ? (emptyMessage ?? 'Aucun élément disponible')
              : selected
                ? selected.label
                : placeholder}
        </Text>
        <ChevronDown color="#94a3b8" size={18} />
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
              {label}
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <X color="#64748b" size={22} />
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher…"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            autoCapitalize="none"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5 text-slate-900 dark:text-white text-base"
          />

          {optional && value ? (
            <Pressable
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
              className="py-3 mt-2 active:opacity-70"
            >
              <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold">
                ✕ Effacer la sélection
              </Text>
            </Pressable>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            className="mt-2"
            ListEmptyComponent={
              <Text className="text-slate-500 dark:text-slate-400 text-center mt-8">
                Aucun résultat
              </Text>
            }
            renderItem={({ item }) => {
              const active = item.id === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`flex-row items-center justify-between py-3 px-2 border-b border-slate-200 dark:border-slate-800 active:opacity-60 ${
                    active ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      {item.label}
                    </Text>
                    {item.hint ? (
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  {active ? <Check color="#10b981" size={18} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
