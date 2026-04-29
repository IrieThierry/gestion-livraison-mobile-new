import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { OfflineBanner } from '../../components/shared/OfflineBanner';
import { useNetworkStore } from '../../stores/networkStore';

export default function LivreurLayout() {
  const startWatching = useNetworkStore((s) => s.startWatching);

  useEffect(() => {
    startWatching();
  }, []);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
