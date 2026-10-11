import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';

/**
 * Champ de recherche partagé : loupe, effacement en un appui. Le filtrage se
 * fait avec `filtrerRecherche` (lib/recherche : insensible casse/accents).
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Rechercher…',
  autoFocus,
  className = '',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <View
      className={`flex-row items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 ${className}`}
    >
      <Search color="#94a3b8" size={16} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        className="flex-1 py-2.5 text-slate-900 dark:text-white text-base"
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
          className="active:opacity-60"
        >
          <X color="#94a3b8" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}
