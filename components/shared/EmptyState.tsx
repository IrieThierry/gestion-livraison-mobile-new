import { View, Text } from 'react-native';

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Text className="text-slate-900 dark:text-white font-extrabold text-base">{title}</Text>
      {message ? (
        <Text className="text-slate-500 dark:text-slate-400 text-sm text-center mt-1">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
