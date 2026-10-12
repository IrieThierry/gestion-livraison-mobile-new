import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl, Switch } from 'react-native';
import { Plus, ListTree, Calendar, ShoppingCart, Users } from 'lucide-react-native';
import { dialog } from '../../../lib/dialog';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { ProduitVignette } from '../../../components/shared/ProduitVignette';
import {
  CarteClient,
  LignePrevision,
  QuantiteModal,
} from '../../../components/previsions/LignePrevision';
import { ChoixFournisseurModal } from '../../../components/previsions/ChoixFournisseurModal';
import {
  useCumul,
  useLivraisonsDuJour,
  useModifierGroupe,
  usePrevisionsLivreur,
  usePrevisionsParent,
  useSupprimerGroupes,
} from '../../../features/previsions/hooks';
import {
  ajouterJours,
  estEchue,
  jourCourt,
  jourLocal,
  nomClient,
  parClient,
  parLivreur,
  regrouperPrevisions,
  type GroupePrevision,
} from '../../../features/previsions/regles';
import { useFournisseursPartenaires } from '../../../features/lookups/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useCommandePrefillStore } from '../../../stores/commandePrefillStore';
import { naviguer } from '../../../lib/navigation-app';
import { DEPUIS_PREVISIONS } from '../../../lib/navigation';
import { extractApiErrorMessage } from '../../../lib/api-error';

/**
 * Prévisions d'une date : cumul commande fournisseur (avec ou sans les
 * apprentis, bouton « Commander »), puis les prévisions du livreur
 * regroupées par client (une ligne par produit : Prévu · Livré · Écart et
 * pastille) et, pour un livreur principal, un bloc en lecture seule par
 * apprenti. Date par défaut = demain (planifier la tournée du lendemain).
 */
export default function PrevisionsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const principal = !!user && !user.parentId;

  const aujourdhui = jourLocal();
  const demain = ajouterJours(aujourdhui, 1);
  const [date, setDate] = useState<string | null>(demain);
  const jour = date ?? demain;
  const [inclureApprentis, setInclureApprentis] = useState(false);

  const previsionsQ = usePrevisionsLivreur(livreurId, jour);
  const equipeQ = usePrevisionsParent(livreurId, jour, principal);
  const livraisonsQ = useLivraisonsDuJour(user, jour);
  const cumulQ = useCumul(livreurId, jour, principal && inclureApprentis);
  const modifier = useModifierGroupe();
  const supprimer = useSupprimerGroupes();
  const [enModification, setEnModification] = useState<GroupePrevision | null>(null);
  const [choixFournisseur, setChoixFournisseur] = useState(false);
  const fournisseursQ = useFournisseursPartenaires();

  const livraisons = livraisonsQ.data;
  const mesBlocs = useMemo(
    () => parClient(regrouperPrevisions(previsionsQ.data ?? [], livraisons ?? [])),
    [previsionsQ.data, livraisons],
  );
  const blocsApprentis = useMemo(
    () =>
      parLivreur(
        regrouperPrevisions(
          (equipeQ.data ?? []).filter((p) => p.livreur?.id && p.livreur.id !== livreurId),
          livraisons ?? [],
        ),
      ),
    [equipeQ.data, livraisons, livreurId],
  );

  const optionsFournisseurs = useMemo(
    () =>
      [...(fournisseursQ.data ?? [])]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
        .map((f) => ({ id: f.id, label: f.libelle })),
    [fournisseursQ.data],
  );

  const onSupprimer = (g: GroupePrevision) => {
    dialog.confirm({
      title: 'Supprimer cette prévision ?',
      message: `${nomClient(g.client)} — ${g.produit.designation} × ${g.prevu} (${jourCourt(g.jour)})${
        g.ids.length > 1 ? `\n${g.ids.length} prévisions regroupées seront supprimées.` : ''
      }`,
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () =>
        supprimer.mutate([g], {
          onError: (e) => dialog.error('Suppression impossible', extractApiErrorMessage(e, 'Échec de la suppression')),
        }),
    });
  };

  const onValiderModification = (qte: number) => {
    if (!enModification) return;
    modifier.mutate(
      { groupe: enModification, qte },
      {
        onSuccess: () => setEnModification(null),
        onError: (e) => dialog.error('Modification impossible', extractApiErrorMessage(e, 'Échec de la modification')),
      },
    );
  };

  const onCommander = (fournisseurId: string) => {
    setChoixFournisseur(false);
    useCommandePrefillStore.getState().definir({ fournisseurId, jour, cumul: cumulQ.data ?? [] });
    naviguer('/(livreur)/cash/commandes/nouvelle', { depuis: DEPUIS_PREVISIONS });
  };

  if (!user) return null;

  const cumul = cumulQ.data ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Prévisions"
        subtitle="Planifier la tournée"
        right={
          <Pressable
            onPress={() => naviguer('/(livreur)/previsions/nouvelle', { date: jour < aujourdhui ? demain : jour })}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={previsionsQ.isFetching && !previsionsQ.isLoading}
            onRefresh={() => {
              previsionsQ.refetch();
              cumulQ.refetch();
              livraisonsQ.refetch();
              if (principal) equipeQ.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3 gap-3">
          <DatePickerField label="Date de livraison" value={date} onChange={setDate} />

          {/* Cumul commande */}
          <View className="flex-row items-center gap-2 mt-2">
            <ListTree color="#3b82f6" size={14} />
            <Text className="flex-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Cumul commande fournisseur
            </Text>
          </View>
          {principal ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-[12px] text-slate-600 dark:text-slate-300">Inclure les apprentis</Text>
              <Switch
                value={inclureApprentis}
                onValueChange={setInclureApprentis}
                accessibilityLabel="Inclure les apprentis"
              />
            </View>
          ) : null}
          {cumul.length === 0 ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center">
                Aucune prévision saisie pour cette date.
              </Text>
            </View>
          ) : (
            <View className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-3">
              {cumul.map((c) => (
                <View key={c.produit.id} className="flex-row items-center justify-between py-1">
                  <View className="mr-2">
                    <ProduitVignette designation={c.produit.designation} photoUrl={c.produit.photoUrl} size={28} />
                  </View>
                  <Text className="flex-1 text-[13px] text-blue-700 dark:text-blue-300">{c.produit.designation}</Text>
                  <Text className="text-[13px] font-bold text-blue-700 dark:text-blue-300">{c.qteCumulee}</Text>
                </View>
              ))}
              {principal ? (
                <Pressable
                  onPress={() => setChoixFournisseur(true)}
                  accessibilityRole="button"
                  className="bg-blue-600 rounded-md py-2.5 mt-2 flex-row items-center justify-center gap-2 active:opacity-80"
                >
                  <ShoppingCart color="#fff" size={16} />
                  <Text className="text-white font-bold">Commander</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Mes prévisions, par client */}
          <View className="flex-row items-center gap-2 mt-2">
            <Calendar color="#10b981" size={14} />
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              {principal ? 'Mes prévisions par client' : 'Détail par client'}
            </Text>
          </View>
          {mesBlocs.length === 0 ? (
            <EmptyState
              title="Aucune prévision"
              message="Saisis tes prévisions du jour pour anticiper la commande fournisseur."
            />
          ) : (
            <View className="gap-2">
              {mesBlocs.map((b) => (
                <CarteClient key={b.clientId} bloc={b}>
                  {b.lignes.map((l) => (
                    <LignePrevision
                      key={l.cle}
                      ligne={l}
                      echue={estEchue(l, aujourdhui)}
                      onModifier={() => setEnModification(l)}
                      onSupprimer={() => onSupprimer(l)}
                    />
                  ))}
                </CarteClient>
              ))}
            </View>
          )}

          {/* Apprentis : lecture seule */}
          {principal
            ? blocsApprentis.map((a) => (
                <View key={a.livreurId} className="gap-2 mt-2">
                  <View className="flex-row items-center gap-2">
                    <Users color="#8b5cf6" size={14} />
                    <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                      {a.livreurNom || 'Apprenti'} (lecture seule)
                    </Text>
                  </View>
                  {parClient(a.lignes).map((b) => (
                    <CarteClient key={`${a.livreurId}-${b.clientId}`} bloc={b}>
                      {b.lignes.map((l) => (
                        <LignePrevision key={l.cle} ligne={l} echue={estEchue(l, aujourdhui)} />
                      ))}
                    </CarteClient>
                  ))}
                </View>
              ))
            : null}
        </View>
      </ScrollView>

      <QuantiteModal
        ligne={enModification}
        enCours={modifier.isPending}
        onFermer={() => setEnModification(null)}
        onValider={onValiderModification}
      />
      <ChoixFournisseurModal
        visible={choixFournisseur}
        options={optionsFournisseurs}
        chargement={fournisseursQ.isLoading}
        erreur={fournisseursQ.isError ? extractApiErrorMessage(fournisseursQ.error, 'Fournisseurs indisponibles') : null}
        onFermer={() => setChoixFournisseur(false)}
        onChoisir={onCommander}
      />
    </View>
  );
}
