import { Pressable, ScrollView, Text, View } from 'react-native';
import type { OptionLivreurCloture } from '../../features/clotures/regles';

/**
 * N6 : « Moi » ou un apprenti actif (livreur principal). Rien s'il n'y a
 * qu'une option (apprenti, ou principal sans apprenti actif).
 */
export function ChoixLivreurCloture({
  options,
  value,
  onChange,
}: {
  options: OptionLivreurCloture[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        Livreur à clôturer
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => {
          const actif = o.id === value;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              className={`px-3 py-1.5 rounded-full border ${
                actif
                  ? 'bg-emerald-700 border-emerald-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Text
                className={`text-[12px] font-bold ${
                  actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
