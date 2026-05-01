import { useMemo, useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  Info as InfoIcon,
  ListFilter,
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
import { isEncaissee, isAEncaisser } from '../../../../lib/livraison-status';

function parseLatLng(s: string | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const [a, b] = s.split(',').map((p) => parseFloat(p.trim()));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return null;
}

type Periode = '7j' | '30j' | '90j' | 'all';
type LivraisonStatut = 'all' | 'LIVREE' | 'ENCAISSEE';

const PERIODES: Array<{ key: Periode; label: string; days: number | null }> = [
  { key: '7j', label: '7 jours', days: 7 },
  { key: '30j', label: '30 jours', days: 30 },
  { key: '90j', label: '90 jours', days: 90 },
  { key: 'all', label: 'Tout', days: null },
];

/**
 * Fiche client — design accordéon.
 *
 * Toujours visible : Hero + CTAs + KPIs + carte Prix.
 * Sections pliables (collapsed par défaut, indépendantes les unes des
 * autres) :
 *   - 🏠 Info (carte GPS + infos perso : email, adresse, quartier, …)
 *   - 🚚 Livraisons (filtres période + statut + liste)
 *   - 💵 Encaissements (filtre période + liste)
 *
 * Le contenu d'une section n'est rendu que si elle est dépliée — ça
 * économise du rendu sur les longues listes et évite les soucis de
 * navigation context lors du toggle.
 */
export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qC = useClientsByLivreur(livreurId);
  const qL = useLivraisonsByLivreur(livreurId);
  const qE = useEncaissementsByLivreur(livreurId);
  const qPrix = usePrixClient(id);

  // État accordéon — tous fermés par défaut. Le user déplie ce dont il a besoin.
  const [openInfo, setOpenInfo] = useState(false);
  const [openLiv, setOpenLiv] = useState(false);
  const [openEnc, setOpenEnc] = useState(false);

  const [periodeLiv, setPeriodeLiv] = useState<Periode>('30j');
  const [periodeEnc, setPeriodeEnc] = useState<Periode>('30j');
  const [statutLiv, setStatutLiv] = useState<LivraisonStatut>('all');

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

  const livFiltrees = useMemo(() => {
    const now = Date.now();
    const days = PERIODES.find((p) => p.key === periodeLiv)?.days ?? null;
    return livraisonsClient.filter((l) => {
      if (days !== null && now - new Date(l.date).getTime() > days * 86_400_000) {
        return false;
      }
      if (statutLiv === 'all') return true;
      if (statutLiv === 'ENCAISSEE') return isEncaissee(l);
      if (statutLiv === 'LIVREE') return isAEncaisser(l);
      return true;
    });
  }, [livraisonsClient, periodeLiv, statutLiv]);

  const encFiltres = useMemo(() => {
    const now = Date.now();
    const days = PERIODES.find((p) => p.key === periodeEnc)?.days ?? null;
    return encaissementsClient.filter((e) => {
      if (days !== null && e.date) {
        return now - new Date(e.date).getTime() <= days * 86_400_000;
      }
      return true;
    });
  }, [encaissementsClient, periodeEnc]);

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
    // Mode CLIENT — la page agrège les non-encaissées + montre le solde
    // et pré-remplit le montant. Évite de choisir une livraison précise.
    router.push({
      pathname: '/(livreur)/cash/encaisser' as never,
      params: { clientId: client.id },
    } as never);
  };

  const hasPendingLivraisons = livraisonsClient.some(isAEncaisser);
  const totalLivFiltrees = livFiltrees.reduce(
    (acc, l) => acc + (l.montantLivre ?? 0),
    0,
  );
  const totalEncFiltres = encFiltres.reduce(
    (acc, e) => acc + (e.montantEncaisse ?? 0),
    0,
  );

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

          {/* KPIs 2x2 */}
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

          {/* ===== Section pliable : Info ===== */}
          <Section
            title="Info"
            subtitle="Coordonnées GPS, email, adresse, catégorie…"
            icon={InfoIcon}
            iconColor="#3b82f6"
            iconBg="bg-blue-100 dark:bg-blue-500/15"
            open={openInfo}
            onToggle={() => setOpenInfo((v) => !v)}
          >
            {/* Map */}
            {geo ? (
              <View>
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Localisation
                </Text>
                <MapPreview lat={geo.lat} lng={geo.lng} height={180} />
                <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2 font-mono">
                  {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
                </Text>
              </View>
            ) : (
              <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3">
                <Text className="text-[12px] text-amber-700 dark:text-amber-400">
                  Pas de coordonnées GPS enregistrées pour ce client.
                </Text>
              </View>
            )}

            <View className="mt-3 gap-3">
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
          </Section>

          {/* ===== Section pliable : Livraisons ===== */}
          <Section
            title="Livraisons"
            subtitle={`${livraisonsClient.length} au total`}
            badgeValue={livraisonsClient.length}
            icon={Truck}
            iconColor="#10b981"
            iconBg="bg-emerald-100 dark:bg-emerald-500/15"
            open={openLiv}
            onToggle={() => setOpenLiv((v) => !v)}
          >
            {/* Filtres période */}
            <View className="flex-row items-center gap-1.5 mb-2">
              <ListFilter color="#64748b" size={12} />
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Période
              </Text>
            </View>
            <View className="flex-row gap-2 mb-3">
              {PERIODES.map((p) => (
                <FilterChip
                  key={`L_${p.key}`}
                  active={periodeLiv === p.key}
                  label={p.label}
                  onPress={() => setPeriodeLiv(p.key)}
                />
              ))}
            </View>

            {/* Filtres statut */}
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Statut
            </Text>
            <View className="flex-row gap-2 mb-3">
              <FilterChip
                active={statutLiv === 'all'}
                label="Toutes"
                onPress={() => setStatutLiv('all')}
              />
              <FilterChip
                active={statutLiv === 'LIVREE'}
                label="Non encaissée"
                onPress={() => setStatutLiv('LIVREE')}
              />
              <FilterChip
                active={statutLiv === 'ENCAISSEE'}
                label="Encaissée"
                onPress={() => setStatutLiv('ENCAISSEE')}
              />
            </View>

            {/* Récap */}
            <View className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 mb-3 flex-row justify-between items-center">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                {livFiltrees.length} livraison{livFiltrees.length > 1 ? 's' : ''} filtrée{livFiltrees.length > 1 ? 's' : ''}
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatFCFA(totalLivFiltrees)} F
              </Text>
            </View>

            {livFiltrees.length === 0 ? (
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
                Aucune livraison ne correspond aux filtres.
              </Text>
            ) : (
              <View className="gap-2">
                {livFiltrees.map((l) => (
                  <LivraisonCard key={l.id} livraison={l} />
                ))}
              </View>
            )}
          </Section>

          {/* ===== Section pliable : Encaissements ===== */}
          <Section
            title="Encaissements"
            subtitle={`${encaissementsClient.length} au total`}
            badgeValue={encaissementsClient.length}
            icon={Banknote}
            iconColor="#f59e0b"
            iconBg="bg-amber-100 dark:bg-amber-500/15"
            open={openEnc}
            onToggle={() => setOpenEnc((v) => !v)}
          >
            <View className="flex-row items-center gap-1.5 mb-2">
              <ListFilter color="#64748b" size={12} />
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Période
              </Text>
            </View>
            <View className="flex-row gap-2 mb-3">
              {PERIODES.map((p) => (
                <FilterChip
                  key={`E_${p.key}`}
                  active={periodeEnc === p.key}
                  label={p.label}
                  onPress={() => setPeriodeEnc(p.key)}
                />
              ))}
            </View>

            <View className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 mb-3 flex-row justify-between items-center">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                {encFiltres.length} encaissement{encFiltres.length > 1 ? 's' : ''} filtré{encFiltres.length > 1 ? 's' : ''}
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatFCFA(totalEncFiltres)} F
              </Text>
            </View>

            {encFiltres.length === 0 ? (
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
                Aucun encaissement ne correspond à la période choisie.
              </Text>
            ) : (
              <View className="gap-2">
                {encFiltres.map((e) => (
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
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Section accordéon : header tappable + contenu collapsible.
 * On ne rend le contenu que si `open === true` — économise du rendu
 * sur les longues listes et évite les soucis potentiels de
 * navigation context au mount.
 */
function Section({
  title,
  subtitle,
  badgeValue,
  icon: Icon,
  iconColor,
  iconBg,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  badgeValue?: number;
  icon: React.ComponentType<{ color: string; size: number }>;
  iconColor: string;
  iconBg: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-3 px-3 py-3 active:bg-slate-50 dark:active:bg-slate-800/40"
      >
        <View className={`w-10 h-10 rounded-full items-center justify-center ${iconBg}`}>
          <Icon color={iconColor} size={18} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-extrabold text-slate-900 dark:text-white">
              {title}
            </Text>
            {badgeValue !== undefined && badgeValue > 0 ? (
              <View className="bg-slate-200 dark:bg-slate-700 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {badgeValue}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {open ? (
          <ChevronUp color="#94a3b8" size={18} />
        ) : (
          <ChevronDown color="#94a3b8" size={18} />
        )}
      </Pressable>
      {open ? (
        <View className="px-3 pb-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          {children}
        </View>
      ) : null}
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

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded-md border ${
        active
          ? 'bg-emerald-500 border-emerald-500'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text
        className={`text-[12px] font-bold ${
          active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
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
