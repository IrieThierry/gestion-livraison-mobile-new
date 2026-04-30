import { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Phone,
  Mail,
  AtSign,
  Power,
  Truck,
  Users,
  Banknote,
  Package,
  CircleAlert,
} from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  useApprentis,
  useToggleApprentiActif,
} from '../../../../features/apprentis/hooks';
import { useLivraisonsByLivreur } from '../../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../../features/encaissements/hooks';
import { useClientsByLivreur } from '../../../../features/clients/hooks';
import { useStockActuel } from '../../../../features/stock/hooks';
import { callPhone } from '../../../../lib/linking';
import { formatFCFA } from '../../../../lib/format';

/**
 * Fiche apprenti — affiche un récap chiffré (livraisons / encaissements /
 * clients / stock courant) basé sur les mêmes endpoints que le portail web.
 *
 * Le parent (livreur racine) peut depuis cette page :
 *   - voir les KPIs de l'apprenti
 *   - appeler son numéro
 *   - activer/désactiver son compte
 *
 * Note : les mêmes hooks `useLivraisonsByLivreur`/`useClientsByLivreur`/etc.
 * sont utilisés ici avec l'ID de l'apprenti (pas de l'utilisateur connecté).
 * Le back filtre par livreurId, donc on récupère les données de l'apprenti.
 */
export default function ApprentiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const apprentisQ = useApprentis();
  const toggleMut = useToggleApprentiActif();

  const livQ = useLivraisonsByLivreur(id);
  const encQ = useEncaissementsByLivreur(id);
  const cliQ = useClientsByLivreur(id);
  const stockQ = useStockActuel(id ?? '');

  const apprenti = useMemo(
    () => (apprentisQ.data ?? []).find((a) => a.id === id),
    [apprentisQ.data, id],
  );

  const stats = useMemo(() => {
    const livraisons = livQ.data ?? [];
    const encaissements = encQ.data ?? [];
    const clients = cliQ.data ?? [];
    const stocks = stockQ.data ?? [];

    const today = new Date().toDateString();
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;

    const livMois = livraisons.filter(
      (l) => new Date(l.date).getTime() >= thirtyDaysAgo,
    );
    const livJour = livraisons.filter(
      (l) => new Date(l.date).toDateString() === today,
    );
    const totalCAMois = livMois.reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    const aEncaisser = livraisons
      .filter((l) => l.statut !== 'ENCAISSEE')
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);

    const encMois = encaissements.filter((e) =>
      e.date ? new Date(e.date).getTime() >= thirtyDaysAgo : false,
    );
    const totalEncaisseMois = encMois.reduce(
      (acc, e) => acc + (e.montantEncaisse ?? 0),
      0,
    );

    const totalUnitesStock = stocks.reduce((acc, s) => acc + (s.qte ?? 0), 0);

    return {
      nbClients: clients.length,
      nbLivraisons: livraisons.length,
      nbLivJour: livJour.length,
      totalCAMois,
      aEncaisser,
      totalEncaisseMois,
      totalUnitesStock,
    };
  }, [livQ.data, encQ.data, cliQ.data, stockQ.data]);

  if (apprentisQ.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (!apprenti) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Apprenti" />
        <EmptyState
          title="Apprenti introuvable"
          message="Ce compte n'est plus dans ta liste d'apprentis."
        />
      </View>
    );
  }

  const fullName = `${apprenti.prenom} ${apprenti.nom}`.trim();
  const initials = `${apprenti.prenom[0] ?? ''}${apprenti.nom[0] ?? ''}`.toUpperCase();
  const actif = apprenti.actif !== false;

  const onToggle = () => {
    const next = !actif;
    Alert.alert(
      next ? 'Activer le compte ?' : 'Désactiver le compte ?',
      next
        ? `${fullName} pourra à nouveau se connecter.`
        : `${fullName} ne pourra plus se connecter tant que tu ne réactives pas son compte.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: next ? 'Activer' : 'Désactiver',
          style: next ? 'default' : 'destructive',
          onPress: () => toggleMut.mutate({ id: apprenti.id, actif: next }),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={fullName} subtitle={apprenti.username} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={
              (livQ.isFetching && !livQ.isLoading) ||
              (encQ.isFetching && !encQ.isLoading)
            }
            onRefresh={() => {
              apprentisQ.refetch();
              livQ.refetch();
              encQ.refetch();
              cliQ.refetch();
              stockQ.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Hero */}
          <View
            className={`rounded-lg p-4 flex-row items-center gap-3 ${
              actif
                ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                : 'bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <View
              className={`w-14 h-14 rounded-full items-center justify-center ${
                actif
                  ? 'bg-emerald-100 dark:bg-emerald-500/15'
                  : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <Text
                className={`font-extrabold text-base ${
                  actif
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {initials || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-extrabold text-slate-900 dark:text-white text-base">
                  {fullName}
                </Text>
                {!actif ? (
                  <View className="bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">
                    <Text className="text-[9px] font-bold text-red-600 dark:text-red-400">
                      DÉSACTIVÉ
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                Apprenti livreur
              </Text>
            </View>
          </View>

          {/* Compte désactivé warning */}
          {!actif ? (
            <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mt-3 flex-row items-start gap-2">
              <CircleAlert color="#d97706" size={16} />
              <Text className="flex-1 text-[12px] text-amber-700 dark:text-amber-400">
                Ce compte est désactivé. L'apprenti ne peut plus se connecter
                ni effectuer de livraisons. Réactive-le pour qu'il puisse
                reprendre son activité.
              </Text>
            </View>
          ) : null}

          {/* CTA row : appeler + toggle */}
          <View className="flex-row gap-2 mt-3">
            {apprenti.contact ? (
              <Pressable
                onPress={() => callPhone(apprenti.contact)}
                className="flex-1 flex-col items-center justify-center gap-1 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md active:opacity-70"
              >
                <Phone color="#10b981" size={18} />
                <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  Appeler
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onToggle}
              disabled={toggleMut.isPending}
              className={`flex-1 flex-col items-center justify-center gap-1 py-3 border rounded-md active:opacity-70 ${
                actif
                  ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
              }`}
            >
              <Power color={actif ? '#dc2626' : '#059669'} size={18} />
              <Text
                className={`text-[10px] font-bold ${
                  actif
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {actif ? 'Désactiver' : 'Activer'}
              </Text>
            </Pressable>
          </View>

          {/* KPIs activité */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Activité (30 derniers jours)
          </Text>
          <View className="gap-2">
            <View className="flex-row gap-2">
              <KpiCard
                icon={Truck}
                color="#10b981"
                label="Livraisons"
                value={`${stats.nbLivraisons}`}
                hint={`${stats.nbLivJour} aujourd'hui`}
              />
              <KpiCard
                icon={Banknote}
                color="#059669"
                label="Encaissé"
                value={`${formatFCFA(stats.totalEncaisseMois)}`}
                hint="FCFA / 30j"
              />
            </View>
            <View className="flex-row gap-2">
              <KpiCard
                icon={Users}
                color="#3b82f6"
                label="Clients"
                value={`${stats.nbClients}`}
                hint="rattachés"
              />
              <KpiCard
                icon={Package}
                color="#f59e0b"
                label="Stock"
                value={`${stats.totalUnitesStock}`}
                hint="unités embarquées"
              />
            </View>
            <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 flex-row justify-between items-center">
              <Text className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
                À encaisser
              </Text>
              <Text className="font-extrabold text-amber-700 dark:text-amber-400">
                {formatFCFA(stats.aEncaisser)} FCFA
              </Text>
            </View>
            <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md p-3 flex-row justify-between items-center">
              <Text className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                CA livré (30j)
              </Text>
              <Text className="font-extrabold text-emerald-700 dark:text-emerald-400">
                {formatFCFA(stats.totalCAMois)} FCFA
              </Text>
            </View>
          </View>

          {/* Identifiants */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Identifiants
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 gap-3">
            <InfoRow icon={AtSign} label="Nom d'utilisateur" value={apprenti.username} mono />
            {apprenti.contact ? (
              <InfoRow icon={Phone} label="Téléphone" value={apprenti.contact} />
            ) : null}
            {apprenti.email ? (
              <InfoRow icon={Mail} label="Email" value={apprenti.email} />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={14} />
        <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </Text>
      </View>
      <Text className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
        {value}
      </Text>
      <Text className="text-[10px] text-slate-500 dark:text-slate-400">
        {hint}
      </Text>
    </View>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
        <Icon color="#64748b" size={14} />
      </View>
      <View className="flex-1">
        <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </Text>
        <Text
          className={`text-[13px] text-slate-700 dark:text-slate-300 mt-0.5 ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
