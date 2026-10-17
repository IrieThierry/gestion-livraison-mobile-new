import { Text, TextInput, View, type TextInputProps } from 'react-native';

/**
 * Champ de formulaire de l'espace fournisseur : libellé au-dessus, saisie
 * accessible par son libellé, aide ou erreur en dessous.
 */
export function ChampTexte({
  label,
  value,
  onChangeText,
  aide,
  erreur,
  ...rest
}: Omit<TextInputProps, 'style' | 'className'> & {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  aide?: string;
  erreur?: string | null;
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-3.5 text-slate-900 dark:text-white text-base"
        {...rest}
      />
      {erreur ? (
        <Text className="text-red-600 dark:text-red-400 text-[12px] mt-1">{erreur}</Text>
      ) : aide ? (
        <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{aide}</Text>
      ) : null}
    </View>
  );
}
