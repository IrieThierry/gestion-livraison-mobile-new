import { View, Text } from 'react-native';
import { useNetworkStore } from '../../stores/networkStore';

export function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  if (isOnline) return null;
  return (
    <View className="bg-amber-500 px-4 py-2 flex-row items-center justify-center">
      <Text className="text-white text-xs font-bold">
        ⚠ Pas de connexion · données en cache
      </Text>
    </View>
  );
}
