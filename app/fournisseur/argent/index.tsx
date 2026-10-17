import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { FilePen, HandCoins, Plus, Receipt, Undo2, UsersRound } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EntreeRubrique } from '../../../components/fournisseur/EntreeRubrique';
import {
  useDemandesModifFournisseurEnAttente,
  useReversementsSyntheseFournisseur,
  useVersementsFournisseur,
} from '../../../features/fournisseur/hooks';
import { moisDe, nbDemandesADecider } from '../../../features/fournisseur/regles';
import { totauxVersements } from '../../../features/fournisseur/argent';
import { formatFCFA } from '../../../lib/format';
import { naviguer } from '../../../lib/navigation-app';

const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';

/**
 * F2, onglet 4 « Argent » du fournisseur : versements reçus (et leurs
 * demandes de modification), reversements de la remise aux livreurs, dépenses.
 * Les chiffres du mois en cours viennent des mêmes routes que le portail web.
 */
export default function ArgentFournisseur() {
  const mois = moisDe();
  const versementsQ = useVersementsFournisseur(mois);
  const reversementsQ = useReversementsSyntheseFournisseur(mois);
  const demandesQ = useDemandesModifFournisseurEnAttente();
  const aDecider = nbDemandesADecider(demandesQ.data);
  const { total } = totauxVersements(versementsQ.data);
  const aReverser = (reversementsQ.data?.aReverserAuxLivreurs ?? []).reduce(
    (s, l) => s + (l.montantNetAReverser ?? 0),
    0,
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Argent" subtitle="Versements, reversements et dépenses" showBack={false} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={!!versementsQ.isFetching && !versementsQ.isLoading}
            onRefresh={() => {
              versementsQ.refetch();
              reversementsQ.refetch();
              demandesQ.refetch();
            }}
            tintColor="#047857"
          />
        }
      >
        <Text className={SECTION}>Versements reçus</Text>
        <View className="gap-2">
          <EntreeRubrique
            Icone={HandCoins}
            couleur="#047857"
            titre="Versements reçus"
            detail={versementsQ.data ? `${formatFCFA(total)} F reçus ce mois` : 'Les versements faits par tes livreurs'}
            onPress={() => naviguer('/fournisseur/argent/versements')}
          />
          <EntreeRubrique
            Icone={Plus}
            couleur="#0f766e"
            titre="Enregistrer un versement"
            detail="Un livreur t’a payé : note son versement"
            onPress={() => naviguer('/fournisseur/argent/versements/nouveau')}
          />
          <EntreeRubrique
            Icone={FilePen}
            couleur="#7c3aed"
            titre="Demandes de modification"
            detail="Approuve, rejette ou suis les demandes sur les versements"
            badge={aDecider}
            onPress={() => naviguer('/fournisseur/argent/versements/demandes')}
          />
        </View>

        <Text className={SECTION}>Clients du guichet</Text>
        <View className="gap-2">
          <EntreeRubrique
            Icone={UsersRound}
            couleur="#2563eb"
            titre="Mes clients"
            detail="Ce qu’ils te doivent, leurs prix et leurs versements"
            onPress={() => naviguer('/fournisseur/argent/clients')}
          />
        </View>

        <Text className={SECTION}>Remises et frais</Text>
        <View className="gap-2">
          <EntreeRubrique
            Icone={Undo2}
            couleur="#d97706"
            titre="Reversements"
            detail={
              reversementsQ.data
                ? `${formatFCFA(aReverser)} F à reverser ce mois`
                : 'La remise livreur à reverser à tes livreurs'
            }
            onPress={() => naviguer('/fournisseur/argent/reversements')}
          />
          <EntreeRubrique
            Icone={Receipt}
            couleur="#dc2626"
            titre="Dépenses"
            detail="Tes frais (carburant, entretien…)"
            onPress={() => naviguer('/fournisseur/argent/depenses')}
          />
        </View>
      </ScrollView>
    </View>
  );
}
