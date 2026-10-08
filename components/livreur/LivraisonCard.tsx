import { Pressable, View, Text } from 'react-native';
import { router } from 'expo-router';
import { formatFCFA, formatTime } from '../../lib/format';
import {
  isEncaissee,
  isEntierementPayee,
  libelleStatutEncaissement,
} from '../../lib/livraison-status';
import { num } from '../../features/encaissements/regles';
import type { LivraisonResponse } from '../../types/api';

/** Couleur de bordure : soldée, reste dû du jour, reste dû en retard. */
type DerivedStatus = 'SOLDEE' | 'LIVREE' | 'IMPAYEE';

const BORDURES: Record<DerivedStatus, string> = {
  SOLDEE: 'border-l-emerald-500',
  LIVREE: 'border-l-amber-500',
  IMPAYEE: 'border-l-red-500',
};

const BADGE = {
  encaissee: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  nonEncaissee: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
  },
};

/**
 * Statut visuel (bordure) : « soldée » se lit sur `entierementPayee`
 * (serveur), jamais sur `statutEncaissement`, qui vaut `ENCAISSEE` dès un
 * paiement partiel (E8). Avec un reste dû :
 *   • date du jour → LIVREE ;
 *   • date passée  → IMPAYEE (créance dépassant la journée, heuristique
 *     mobile).
 */
export function deriveStatus(livraison: LivraisonResponse): DerivedStatus {
  if (isEntierementPayee(livraison)) return 'SOLDEE';

  const today = new Date().toDateString();
  const livDate = new Date(livraison.date).toDateString();
  return livDate === today ? 'LIVREE' : 'IMPAYEE';
}

export function LivraisonCard({ livraison }: { livraison: LivraisonResponse }) {
  const status = deriveStatus(livraison);
  const badge = isEncaissee(livraison) ? BADGE.encaissee : BADGE.nonEncaissee;
  const clientName = `${livraison.client.prenom} ${livraison.client.nom}`;
  const quartier = livraison.client.quartier?.libelle ?? '—';
  // Dû net serveur (remise et retours compris, avant paiements). Jamais
  // `montantLivre` (brut prix × qté).
  const montant = num(livraison.montantDu);
  const time = formatTime(livraison.date);
  const lignes = livraison.produitsLivraison ?? [];
  const lignesSummary = lignes
    .map((p) => `${p.qteLivre} ${p.produit.designation}`)
    .join(' · ');

  return (
    <Pressable
      onPress={() => router.push(`/(livreur)/livraisons/${livraison.id}` as never)}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${BORDURES[status]} rounded-lg p-3 active:opacity-70`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[14px] flex-1">
          {clientName}
        </Text>
        <View className={`${badge.bg} px-2 py-0.5 rounded-full self-start`}>
          <Text className={`${badge.text} text-[10px] font-bold`}>
            {libelleStatutEncaissement(livraison)}
          </Text>
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
          {formatFCFA(montant)} FCFA
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
