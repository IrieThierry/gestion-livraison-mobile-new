import { View, Text, Pressable } from 'react-native';

/**
 * Choix de la destination d'un retour : « Remettre en stock » (les unités
 * reviennent dans le stock du livreur) ou « Perdu » (invendable).
 */
export function DestinationRetourToggle({
  enStock,
  onChange,
  disabled = false,
}: {
  enStock: boolean;
  onChange: (enStock: boolean) => void;
  disabled?: boolean;
}) {
  const options: Array<{ valeur: boolean; label: string }> = [
    { valeur: true, label: 'Remettre en stock' },
    { valeur: false, label: 'Perdu' },
  ];
  return (
    <View className="flex-row gap-1.5 mt-1.5">
      {options.map((o) => {
        const actif = enStock === o.valeur;
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.valeur)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif, disabled }}
            className={`px-2.5 py-1 rounded-md border ${
              actif
                ? o.valeur
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-slate-600 border-slate-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
            } ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
          >
            <Text
              className={`text-[11px] font-bold ${
                actif ? 'text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
