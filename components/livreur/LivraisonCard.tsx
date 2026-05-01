import { Pressable, View, Text } from 'react-native';
import { router } from 'expo-router';
import { formatFCFA, formatTime } from '../../lib/format';
import type { LivraisonResponse } from '../../types/api';

type DerivedStatus = 'ENCAISSEE' | 'PARTIEL' | 'LIVREE' | 'IMPAYEE';

const STATUS_STYLES: Record<DerivedStatus, { border: string; bg: string; text: string; label: string }> = {
  ENCAISSEE: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Encaissée',
  },
  PARTIEL: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Partielle',
  },
  LIVREE: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
    label: 'Livrée',
  },
  IMPAYEE: {
    border: 'border-l-red-500',
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    label: 'Impayée',
  },
};

/**
 * Calcule le statut affiché à partir de `statutEncaissement` (calculé à
 * la volée par le back, équivalent au flux web) avec un fallback sur
 * `statut` pour rétro-compatibilité avec les anciens caches qui n'avaient
 * pas le champ.
 *
 * Mapping :
 *   - `statutEncaissement === 'ENCAISSEE'`             → ENCAISSEE
 *   - `statutEncaissement === 'PARTIELLEMENT_ENCAISSEE'` → PARTIEL
 *   - `statutEncaissement === 'NON_ENCAISSEE'` :
 *       • date du jour → LIVREE
 *       • date passée  → IMPAYEE (créance dépassant la journée)
 *
 * `IMPAYEE` n'existe pas côté back — c'est une heuristique mobile pour
 * mettre en évidence visuellement les livraisons en retard.
 */
export function deriveStatus(livraison: LivraisonResponse): DerivedStatus {
  // Préférer statutEncaissement (calculé back) au statut métier figé
  if (livraison.statutEncaissement === 'ENCAISSEE') return 'ENCAISSEE';
  if (livraison.statutEncaissement === 'PARTIELLEMENT_ENCAISSEE') return 'PARTIEL';
  // Fallback : ancien comportement (statut métier == ENCAISSEE — rare)
  if (livraison.statut === 'ENCAISSEE') return 'ENCAISSEE';

  const today = new Date().toDateString();
  const livDate = new Date(livraison.date).toDateString();
  return livDate === today ? 'LIVREE' : 'IMPAYEE';
}

export function LivraisonCard({ livraison }: { livraison: LivraisonResponse }) {
  const status = deriveStatus(livraison);
  const style = STATUS_STYLES[status];
  const clientName = `${livraison.client.prenom} ${livraison.client.nom}`;
  const quartier = livraison.client.quartier?.libelle ?? '—';
  const montant = livraison.montantLivre ?? 0;
  const time = formatTime(livraison.date);
  const lignes = livraison.produitsLivraison ?? [];
  const lignesSummary = lignes
    .map((p) => `${p.qteLivre} ${p.produit.designation}`)
    .join(' · ');

  return (
    <Pressable
      onPress={() => router.push(`/(livreur)/livraisons/${livraison.id}` as never)}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${style.border} rounded-lg p-3 active:opacity-70`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[14px] flex-1">
          {clientName}
        </Text>
        <View className={`${style.bg} px-2 py-0.5 rounded-full self-start`}>
          <Text className={`${style.text} text-[10px] font-bold`}>{style.label}</Text>
        </View>
      </View>
      <Text className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
        {quartier} · {time} ·{' '}
        <Text
          className={
            status === 'IMPAYEE'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'font-bold text-slate-700 dark:text-slate-200'
          }
        >
          {formatFCFA(montant)} {status === 'IMPAYEE' ? 'impayé' : 'FCFA'}
        </Text>
      </Text>
      {lignesSummary ? (
        <Text className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5" numberOfLines={1}>
          {lignesSummary}
        </Text>
      ) : null}
    </Pressable>
  );
}
