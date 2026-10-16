import { ScrollView, Text, View } from 'react-native';
import { Monitor } from 'lucide-react-native';
import { PageHeader } from '../shared/PageHeader';

/**
 * Écran minimal d'un onglet du fournisseur dont le contenu arrive dans une
 * prochaine étape (FM2 : Commandes, Livreurs ; FM3 : Argent) : titre de
 * l'onglet, ce qu'il contiendra, et le renvoi au portail web en attendant.
 */
export function RubriqueEnPreparation({ titre, contenu }: { titre: string; contenu: readonly string[] }) {
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={titre} showBack={false} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 gap-2">
          {contenu.map((ligne) => (
            <Text key={ligne} className="text-[13px] text-slate-700 dark:text-slate-300">
              {`• ${ligne}`}
            </Text>
          ))}
        </View>
        <View className="flex-row items-start gap-2 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-md p-3">
          <Monitor color="#0284c7" size={14} />
          <Text className="flex-1 text-[12px] text-sky-800 dark:text-sky-200">
            Cette rubrique arrive bientôt sur le mobile. En attendant, tu la trouves sur le portail web.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
