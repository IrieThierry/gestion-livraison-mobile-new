import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

type Color = 'emerald' | 'amber' | 'red';

const colorStyles: Record<Color, { bg: string; text: string }> = {
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
  },
};

export function FreshnessIndicator({ queryKey }: { queryKey: QueryKey }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState<string>('');
  const [color, setColor] = useState<Color>('emerald');

  useEffect(() => {
    const tick = () => {
      const state = qc.getQueryState(queryKey);
      const updatedAt = state?.dataUpdatedAt;
      if (!updatedAt) {
        setLabel('');
        return;
      }
      const ageMin = (Date.now() - updatedAt) / 60_000;
      if (ageMin < 5) {
        setLabel('À jour');
        setColor('emerald');
      } else if (ageMin < 360) {
        setLabel(`Il y a ${Math.round(ageMin)} min`);
        setColor('amber');
      } else {
        setLabel('Données anciennes');
        setColor('red');
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!label) return null;
  const s = colorStyles[color];
  return (
    <View className={`${s.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${s.text} text-[10px] font-bold`}>{label}</Text>
    </View>
  );
}
