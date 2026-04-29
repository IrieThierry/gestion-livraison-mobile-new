import { View, Text } from 'react-native';

type Accent = 'emerald' | 'amber' | 'red' | 'blue' | 'orange';

const borderByAccent: Record<Accent, string> = {
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  blue: 'border-l-blue-500',
  orange: 'border-l-orange-500',
};

export function StatCard({
  label,
  value,
  suffix,
  accent = 'emerald',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: Accent;
}) {
  return (
    <View
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${borderByAccent[accent]} rounded-lg p-3`}
    >
      <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
        {label}
      </Text>
      <Text className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
        {value}
      </Text>
      {suffix ? (
        <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{suffix}</Text>
      ) : null}
    </View>
  );
}
