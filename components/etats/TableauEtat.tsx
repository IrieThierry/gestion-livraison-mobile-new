import { ScrollView, Text, View } from 'react-native';
import type { SectionEtat } from '../../features/etats/document';

/** Largeur d'une colonne selon son contenu le plus long (bornée). */
function largeurColonne(section: SectionEtat, index: number): number {
  const textes = [
    section.colonnes[index]?.libelle ?? '',
    ...section.lignes.map((l) => l[index] ?? ''),
    section.totaux?.[index] ?? '',
  ];
  const max = Math.max(...textes.map((t) => t.length));
  return Math.min(220, Math.max(64, max * 7 + 16));
}

/**
 * Tableau d'une section d'état, rendu à partir du même modèle que le PDF
 * (mêmes lignes, mêmes totaux). Défilement horizontal si nécessaire.
 */
export function TableauEtat({ section }: { section: SectionEtat }) {
  const largeurs = section.colonnes.map((_, i) => largeurColonne(section, i));
  const alignement = (i: number) => (section.colonnes[i]?.droite ? 'text-right' : 'text-left');

  return (
    <View className="mt-4">
      <Text className="font-extrabold text-slate-900 dark:text-white text-[14px]">
        {section.titre}
      </Text>
      {section.note ? (
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{section.note}</Text>
      ) : null}
      {section.lignes.length === 0 ? (
        <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mt-2">
          <Text className="text-[12px] italic text-slate-500 dark:text-slate-400">{section.vide}</Text>
        </View>
      ) : (
        <ScrollView horizontal className="mt-2" showsHorizontalScrollIndicator={false}>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <View className="flex-row bg-slate-100 dark:bg-slate-800">
              {section.colonnes.map((c, i) => (
                <Text
                  key={`h-${i}`}
                  style={{ width: largeurs[i] }}
                  className={`px-2 py-2 text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-300 ${alignement(i)}`}
                >
                  {c.libelle}
                </Text>
              ))}
            </View>
            {section.lignes.map((ligne, r) => (
              <View
                key={`l-${r}`}
                className="flex-row border-t border-slate-100 dark:border-slate-800"
              >
                {ligne.map((v, i) => (
                  <Text
                    key={`c-${r}-${i}`}
                    style={{ width: largeurs[i] }}
                    className={`px-2 py-1.5 text-[12px] text-slate-800 dark:text-slate-200 ${alignement(i)}`}
                  >
                    {v}
                  </Text>
                ))}
              </View>
            ))}
            {section.totaux ? (
              <View className="flex-row border-t-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10">
                {section.totaux.map((v, i) => (
                  <Text
                    key={`t-${i}`}
                    style={{ width: largeurs[i] }}
                    className={`px-2 py-2 text-[12px] font-extrabold text-slate-900 dark:text-white ${alignement(i)}`}
                  >
                    {v}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
