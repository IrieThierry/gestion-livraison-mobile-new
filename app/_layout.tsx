import '../global.css';
import { View, Text } from 'react-native';

export default function RootLayout() {
  return (
    <View className="flex-1 items-center justify-center bg-emerald-500">
      <Text className="text-white font-bold text-2xl">NativeWind OK</Text>
    </View>
  );
}
