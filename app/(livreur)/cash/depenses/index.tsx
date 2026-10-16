import { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { dialog } from '../../../../lib/dialog';
import { Plus, Trash2, Fuel, Wrench, FileText, MoreHorizontal } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { SelectField } from '../../../../components/shared/SelectField';
import { useDepenses, useDeleteDepense } from '../../../../features/depenses/hooks';
import {
  CIBLE_MOI,
  auteurDepense,
  cibleDepuisId,
  cibleRetenue,
  depenseModifiable,
  idCible,
  optionsDepenses,
  type CibleDepenses,
  type OptionDepenses,
} from '../../../../features/depenses/regles';
import { useApprentis } from '../../../../features/apprentis/hooks';
import { estMembreOrganisation } from '../../../../features/organisation/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { formatFCFA, formatDateShort } from '../../../../lib/format';
import type { DepenseResponse } from '../../../../types/api';
import { naviguer } from '../../../../lib/navigation-app';
import { extractApiErrorMessage } from '../../../../lib/api-error';

const CATEGORIE_META: Record<
  string,
  { icon: React.ComponentType<{ color: string; size: number }>; color: string; bg: string; label: string }
> = {
  CARBURANT: { icon: Fuel, color: '#dc2626', bg: 'bg-red-100 dark:bg-red-500/15', label: 'Carburant' },
  ENTRETIEN: { icon: Wrench, color: '#3b82f6', bg: 'bg-blue-100 dark:bg-blue-500/15', label: 'Entretien' },
  ADMINISTRATIF: { icon: FileText, color: '#8b5cf6', bg: 'bg-violet-100 dark:bg-violet-500/15', label: 'Administratif' },
  AUTRE: { icon: MoreHorizontal, color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Autre' },
};

/**
 * Dépenses. S5 : le livreur principal indépendant choisit « Moi », « Équipe »
 * ou un apprenti actif ; chaque ligne d'un autre auteur indique « par … » et
 * reste en lecture seule (seul l'auteur supprime). L'apprenti et les membres
 * d'une organisation ne voient que leurs dépenses, sans sélecteur.
 */
export default function DepensesList() {
  const user = useAuthStore((s) => s.user);
  const membre = estMembreOrganisation(user);
  const qApprentis = useApprentis();
  const options = useMemo(
    () => optionsDepenses(user, membre, membre ? [] : qApprentis.data),
    [user, membre, qApprentis.data],
  );
  return (
    <EcranDepenses
      options={options}
      optionsEnChargement={qApprentis.isLoading}
      nouvelle="/(livreur)/cash/depenses/nouvelle"
    />
  );
}

/**
 * Liste des dépenses, partagée avec le fournisseur (FM3 : mêmes routes
 * `/depense`, sans sélecteur d'équipe). `options` vide : pas de sélecteur.
 */
export function EcranDepenses({
  options,
  optionsEnChargement = false,
  nouvelle,
}: {
  options: OptionDepenses[];
  optionsEnChargement?: boolean;
  /** Écran « Nouvelle dépense » de l'espace. */
  nouvelle: string;
}) {
  const user = useAuthStore((s) => s.user);
  const [cibleSaisie, setCibleSaisie] = useState<CibleDepenses>(CIBLE_MOI);
  const cible = cibleRetenue(options, cibleSaisie);
  const q = useDepenses(undefined, undefined, cible);
  const m = useDeleteDepense();
  const verrou = useRef(creerVerrou()).current;
  const userId = user?.id ?? '';

  const total = useMemo(
    () => (q.data ?? []).reduce((acc, d) => acc + (d.montant ?? 0), 0),
    [q.data],
  );

  // Tri stable : plus récent en premier
  const sorted = useMemo(
    () =>
      [...(q.data ?? [])].sort(
        (a, b) =>
          new Date(b.dateDepense).getTime() - new Date(a.dateDepense).getTime(),
      ),
    [q.data],
  );

  const onDelete = (d: DepenseResponse) => {
    dialog.confirm({
      title: 'Supprimer cette dépense ?',
      message: d.libelle,
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          m.mutate(d.id, {
            onSettled: fin,
            onError: (err: unknown) => dialog.error('Erreur', extractApiErrorMessage(err, 'Suppression impossible')),
          }),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={cible.type === 'moi' ? 'Mes dépenses' : 'Dépenses'}
        subtitle={`${q.data?.length ?? 0} dépense${(q.data?.length ?? 0) > 1 ? 's' : ''} · ${formatFCFA(total)} FCFA`}
        right={
          <Pressable
            onPress={() => naviguer(nouvelle)}
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />

      {options.length > 0 ? (
        <View className="px-4 pt-2">
          <SelectField
            label="Dépenses de"
            value={idCible(cible)}
            options={options}
            onChange={(id) => setCibleSaisie(cibleDepuisId(id))}
            isLoading={optionsEnChargement}
          />
        </View>
      ) : null}

      <FlatList
        data={sorted}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#047857"
          />
        }
        ListEmptyComponent={
          q.isLoading ? null : q.isError ? (
            <EmptyState
              title="Chargement impossible"
              message={extractApiErrorMessage(q.error, 'Les dépenses n’ont pas pu être lues.')}
            />
          ) : (
            <EmptyState
              title="Aucune dépense"
              message={
                cible.type === 'moi'
                  ? 'Enregistre tes frais de tournée (carburant, entretien…) avec le bouton « Nouvelle ».'
                  : undefined
              }
            />
          )
        }
        renderItem={({ item }) => {
          const meta = CATEGORIE_META[item.categorie] ?? CATEGORIE_META.AUTRE;
          const Icon = meta.icon;
          const auteur = auteurDepense(item, userId);
          return (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2 flex-row items-center gap-3">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${meta.bg}`}
              >
                <Icon color={meta.color} size={16} />
              </View>
              <View className="flex-1">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {item.libelle}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {meta.label} · {formatDateShort(item.dateDepense)}
                  {item.commentaire ? ` · ${item.commentaire}` : ''}
                </Text>
                {auteur ? (
                  <Text className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{auteur}</Text>
                ) : null}
              </View>
              <View className="items-end">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {formatFCFA(item.montant)}
                </Text>
                <Text className="text-[10px] text-slate-400 dark:text-slate-500">FCFA</Text>
              </View>
              {depenseModifiable(item, userId) ? (
                <Pressable
                  onPress={() => onDelete(item)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer ${item.libelle}`}
                  className="active:opacity-60 p-1"
                >
                  <Trash2 color="#ef4444" size={14} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
