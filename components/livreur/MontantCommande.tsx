import { Text, View } from 'react-native';
import type { CommandeResponse } from '../../types/api';
import { montantCommande } from '../../features/commandes/regles';
import { formatFCFA } from '../../lib/format';

/**
 * Montant d'une commande (N2c) : « Montant estimé » tant que rien n'est livré,
 * puis « Montant livré ». Rien si le back n'a pu estimer aucune ligne.
 */
export function MontantCommande({
  commande,
  variante = 'liste',
}: {
  commande: Pick<CommandeResponse, 'montantLivre' | 'montantEstime'>;
  variante?: 'liste' | 'detail';
}) {
  const { libelle, montant } = montantCommande(commande);
  if (montant == null) return null;
  const livre = libelle === 'Montant livré';
  const couleur = livre
    ? 'text-emerald-800 dark:text-emerald-400'
    : 'text-slate-700 dark:text-slate-300';
  if (variante === 'detail') {
    return (
      <View className="flex-row justify-between mt-3 px-1">
        <Text className="text-slate-700 dark:text-slate-300 font-bold">{libelle}</Text>
        <Text className={`font-extrabold text-base ${couleur}`}>{formatFCFA(montant)} FCFA</Text>
      </View>
    );
  }
  return (
    <Text className={`font-extrabold text-[12px] ${couleur}`}>
      {libelle} : {formatFCFA(montant)} F
    </Text>
  );
}
