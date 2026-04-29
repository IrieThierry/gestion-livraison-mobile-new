import { View, Text, Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  showBack = true,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center px-4 pt-3 pb-2 gap-3">
      {showBack ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
        >
          <ChevronLeft color="#64748b" size={18} />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="font-extrabold text-slate-900 dark:text-white text-base">{title}</Text>
        {subtitle ? (
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
