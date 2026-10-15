import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { ChevronDown, X, Check } from 'lucide-react-native';
import { SearchInput } from './SearchInput';
import { AUCUN_RESULTAT, filtrerRecherche, type ChampRecherche } from '../../lib/recherche';

export interface SelectOption {
  id: string;
  label: string;
  hint?: string;
  /** Champs de recherche supplémentaires (en plus du libellé et de l'indice). */
  motsCles?: ChampRecherche[];
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

  const filtered = useMemo(
    () => filtrerRecherche(options, search, (o) => [o.label, o.hint, ...(o.motsCles ?? [])]),
    [options, search],
  );

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

          <SearchInput value={search} onChangeText={setSearch} />

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
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text className="text-slate-500 dark:text-slate-400 text-center mt-8">
                {AUCUN_RESULTAT}
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
                  {active ? <Check color="#047857" size={18} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
