import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950 px-6">
      <Text className="text-slate-900 dark:text-white text-lg font-bold">Page introuvable</Text>
      <Link href="/" className="mt-4 text-emerald-600 dark:text-emerald-400">Retour à l'accueil</Link>
    </View>
  );
}
