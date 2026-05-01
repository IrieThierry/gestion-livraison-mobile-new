import { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Phone,
  MapPin,
  Truck,
  Banknote,
  Mail,
  Tag,
  Layers,
  Percent,
  ArrowRight,
  DollarSign,
} from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { LivraisonCard } from '../../../../components/livreur/LivraisonCard';
import { MapPreview } from '../../../../components/livreur/MapPreview';
import { useClientsByLivreur } from '../../../../features/clients/hooks';
import { useLivraisonsByLivreur } from '../../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../../features/encaissements/hooks';
import { usePrixClient } from '../../../../features/prix/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { callPhone, navigateTo } from '../../../../lib/linking';
import { formatFCFA, formatDateShort } from '../../../../lib/format';
import { computeSoldeForClient, computeEncoursForClient } from '../../../../lib/credit';

function parseLatLng(s: string | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const [a, b] = s.split(',').map((p) => parseFloat(p.trim()));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return null;
}

const PREVIEW_LIMIT = 3;

/**
 * Fiche client — version compacte (sans onglets, sans listes longues).
 *
 * On a essayé deux versions précédentes :
 *   1) Onglets — déclenchait un crash navigation context au switch
 *   2) Sections empilées avec listes complètes — beaucoup trop d'info
 *      sur un seul écran (le user a remonté ce point)
 *
 * Cette version garde la fiche LÉGÈRE :
 *   - Hero + CTAs
 *   - 4 KPIs compacts (encours / solde / nb livraisons / nb encaissements)
 *   - Carte « Prix personnalisés »
 *   - Carte GPS + récap
 *   - Aperçu des 3 dernières livraisons + bouton « Voir toutes »
 *   - Aperçu des 3 derniers encaissements + bouton « Voir tous »
 *   - Infos perso
 *
 * Les listes complètes vivent dans des sous-pages dédiées :
 *   - /clients/[id]/livraisons    (filtres période + statut)
 *   - /clients/[id]/encaissements (filtre période)
 */
export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qC = useClientsByLivreur(livreurId);
  const qL = useLivraisonsByLivreur(livreurId);
  const qE = useEncaissementsByLivreur(livreurId);
  const qPrix = usePrixClient(id);

  const client = useMemo(
    () => (qC.data ?? []).find((c) => c.id === id),
    [qC.data, id],
  );

  const livraisonsClient = useMemo(
    () =>
      (qL.data ?? [])
        .filter((l) => l.client.id === id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [qL.data, id],
  );

  const encaissementsClient = useMemo(
    () =>
      (qE.data ?? [])
        .filter((e) => e.client?.id === id)
        .sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        }),
    [qE.data, id],
  );

  const solde = useMemo(
    () => computeSoldeForClient(qL.data ?? [], qE.data ?? [], id ?? ''),
    [qL.data, qE.data, id],
  );

  const encours = useMemo(
    () => computeEncoursForClient(qL.data ?? [], id ?? ''),
    [qL.data, id],
  );

  if (!user) return null;

  if (qC.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (!client) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Client" />
        <EmptyState
          title="Client introuvable"
          message="Ce client n'est plus dans ta liste."
        />
      </View>
    );
  }

  const fullName = `${client.prenom} ${client.nom}`.trim();
  const initials = `${client.prenom[0] ?? ''}${client.nom[0] ?? ''}`.toUpperCase();
  const geo = parseLatLng(client.latitudeLongitude);
  const debt = solde > 0;
  const credit = solde < 0;

  const onLivrer = () =>
    router.push({
      pathname: '/(livreur)/livraisons/nouvelle' as never,
      params: { clientId: client.id },
    } as never);

  const onEncaisser = () => {
    const pending = livraisonsClient.filter((l) => l.statut !== 'ENCAISSEE');
    if (pending.length === 0) return;
    const target = pending[0];
    router.push({
      pathname: '/(livreur)/cash/encaisser' as never,
      params: { livraisonId: target.id },
    } as never);
  };

  const hasPendingLivraisons = livraisonsClient.some((l) => l.statut !== 'ENCAISSEE');
  const hasMoreLivraisons = livraisonsClient.length > PREVIEW_LIMIT;
  const hasMoreEncaissements = encaissementsClient.length > PREVIEW_LIMIT;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={fullName} subtitle={client.quartier?.libelle ?? '—'} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={
              (qC.isFetching && !qC.isLoading) ||
              (qL.isFetching && !qL.isLoading) ||
              (qE.isFetching && !qE.isLoading)
            }
            onRefresh={() => {
              qC.refetch();
              qL.refetch();
              qE.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Hero */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
              <Text className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                {initials || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {fullName}
              </Text>
              {client.contact ? (
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {client.contact}
                </Text>
              ) : null}
            </View>
            {debt ? (
              <View className="items-end">
                <View className="bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">
                  <Text className="text-[11px] font-extrabold text-amber-800 dark:text-amber-400">
                    {formatFCFA(solde)} F
                  </Text>
                </View>
                <Text className="text-[8px] text-slate-400 mt-0.5">SOLDE DÛ</Text>
              </View>
            ) : credit ? (
              <View className="items-end">
                <View className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  <Text className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                    +{formatFCFA(Math.abs(solde))} F
                  </Text>
                </View>
                <Text className="text-[8px] text-slate-400 mt-0.5">CRÉDIT</Text>
              </View>
            ) : null}
          </View>

          {/* CTAs */}
          <View className="flex-row gap-2 mt-3">
            <ActionBtn
              label="Appeler"
              icon={Phone}
              color="#10b981"
              disabled={!client.contact}
              onPress={() => client.contact && callPhone(client.contact)}
            />
            <ActionBtn
              label="Y aller"
              icon={MapPin}
              color="#3b82f6"
              disabled={!geo}
              onPress={() => geo && navigateTo(geo.lat, geo.lng, fullName)}
            />
            <ActionBtn
              label="Livrer"
              icon={Truck}
              color="#10b981"
              onPress={onLivrer}
            />
            <ActionBtn
              label="Encaisser"
              icon={Banknote}
              color="#f59e0b"
              disabled={!hasPendingLivraisons}
              onPress={onEncaisser}
            />
          </View>

          {/* KPI grid 2x2 — chiffres clés en un coup d'œil */}
          <View className="flex-row gap-2 mt-3">
            <KpiCard label="Encours" value={`${formatFCFA(encours)} F`} highlight={encours > 0} />
            <KpiCard label="Livraisons" value={`${livraisonsClient.length}`} />
          </View>
          <View className="flex-row gap-2 mt-2">
            <KpiCard
              label="Solde"
              value={`${debt ? '' : credit ? '+' : ''}${formatFCFA(Math.abs(solde))} F`}
              tone={debt ? 'amber' : credit ? 'emerald' : undefined}
            />
            <KpiCard label="Encaissements" value={`${encaissementsClient.length}`} />
          </View>

          {/* Prix custom */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(livreur)/clients/[id]/prix' as never,
                params: { id: client.id },
              } as never)
            }
            className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center gap-3 active:opacity-70"
          >
            <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
              <DollarSign color="#059669" size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                Prix personnalisés
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                {qPrix.isLoading
                  ? 'Chargement…'
                  : (qPrix.data?.length ?? 0) === 0
                  ? 'Aucun prix custom — paiera les prix par défaut'
                  : `${qPrix.data?.length} produit${(qPrix.data?.length ?? 0) > 1 ? 's' : ''} avec un prix négocié`}
              </Text>
            </View>
            <ArrowRight color="#94a3b8" size={16} />
          </Pressable>

          {/* Map */}
          {geo ? (
            <View className="mt-4">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Localisation
              </Text>
              <MapPreview lat={geo.lat} lng={geo.lng} height={180} />
            </View>
          ) : (
            <View className="mt-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3">
              <Text className="text-[12px] text-amber-700 dark:text-amber-400">
                Pas de coordonnées GPS enregistrées pour ce client.
              </Text>
            </View>
          )}

          {/* Aperçu Livraisons (3 dernières) */}
          <View className="flex-row items-center justify-between mt-5 mb-2">
            <View className="flex-row items-center gap-1.5">
              <Truck color="#10b981" size={14} />
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Dernières livraisons
              </Text>
            </View>
            {hasMoreLivraisons ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(livreur)/clients/[id]/livraisons' as never,
                    params: { id: client.id },
                  } as never)
                }
                hitSlop={8}
                className="active:opacity-60"
              >
                <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  Voir tout ({livraisonsClient.length}) →
                </Text>
              </Pressable>
            ) : null}
          </View>

          {livraisonsClient.length === 0 ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center">
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center">
                Aucune livraison pour ce client.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {livraisonsClient.slice(0, PREVIEW_LIMIT).map((l) => (
                <LivraisonCard key={l.id} livraison={l} />
              ))}
            </View>
          )}

          {/* Aperçu Encaissements (3 derniers) */}
          <View className="flex-row items-center justify-between mt-5 mb-2">
            <View className="flex-row items-center gap-1.5">
              <Banknote color="#f59e0b" size={14} />
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Derniers encaissements
              </Text>
            </View>
            {hasMoreEncaissements ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(livreur)/clients/[id]/encaissements' as never,
                    params: { id: client.id },
                  } as never)
                }
                hitSlop={8}
                className="active:opacity-60"
              >
                <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  Voir tout ({encaissementsClient.length}) →
                </Text>
              </Pressable>
            ) : null}
          </View>

          {encaissementsClient.length === 0 ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center">
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center">
                Aucun encaissement pour ce client.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {encaissementsClient.slice(0, PREVIEW_LIMIT).map((e) => (
                <View
                  key={e.reference}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-md p-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[12px] text-slate-700 dark:text-slate-300 font-bold">
                      {e.date ? formatDateShort(e.date) : '—'}
                    </Text>
                    {e.commentaire ? (
                      <Text className="text-[10px] text-slate-400 mt-0.5">
                        {e.commentaire}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    +{formatFCFA(e.montantEncaisse)} F
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Infos perso */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Informations
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 gap-3">
            {client.email ? <InfoRow icon={Mail} label="Email" value={client.email} /> : null}
            {client.adresse ? <InfoRow icon={MapPin} label="Adresse" value={client.adresse} /> : null}
            <InfoRow
              icon={Layers}
              label="Quartier"
              value={
                client.quartier?.libelle
                  ? `${client.quartier.libelle}${client.quartier.zone?.libelle ? ` · ${client.quartier.zone.libelle}` : ''}`
                  : '—'
              }
            />
            <InfoRow icon={Tag} label="Catégorie" value={client.categorie?.libelle ?? '—'} />
            <InfoRow icon={Percent} label="Avec remise" value={client.avecOuSansRemise ? 'Oui' : 'Non'} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function KpiCard({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: 'amber' | 'emerald';
}) {
  const valueClass =
    tone === 'amber'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : highlight
      ? 'text-slate-900 dark:text-white'
      : 'text-slate-700 dark:text-slate-300';
  return (
    <View className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
      <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <Text className={`font-extrabold text-base mt-1 ${valueClass}`}>{value}</Text>
    </View>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  color,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 flex-col items-center justify-center gap-1 py-3 rounded-md border ${
        disabled
          ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-40'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800/60'
      }`}
    >
      <Icon color={disabled ? '#94a3b8' : color} size={18} />
      <Text
        className={`text-[10px] font-bold ${
          disabled
            ? 'text-slate-400'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  value: string;
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
        <Text className="text-[13px] text-slate-700 dark:text-slate-300 mt-0.5">
          {value}
        </Text>
      </View>
    </View>
  );
}
