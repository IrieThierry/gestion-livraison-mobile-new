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

/**
 * Fiche client — accessible en tappant sur une ligne de la liste Clients.
 *
 * Affiche en un coup d'œil tout ce dont le livreur a besoin pour traiter
 * un client : coordonnées + carte + solde/encours, historique des dernières
 * livraisons + encaissements. Trois CTA principaux : Appeler, Y aller,
 * Livrer / Encaisser.
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
    () => (qL.data ?? []).filter((l) => l.client.id === id),
    [qL.data, id],
  );

  const encaissementsClient = useMemo(
    () => (qE.data ?? []).filter((e) => e.client?.id === id),
    [qE.data, id],
  );

  const solde = useMemo(
    () =>
      computeSoldeForClient(qL.data ?? [], qE.data ?? [], id ?? ''),
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
    if (pending.length === 0) return; // bouton désactivé en amont
    if (pending.length === 1) {
      router.push({
        pathname: '/(livreur)/cash/encaisser' as never,
        params: { livraisonId: pending[0].id },
      } as never);
      return;
    }
    const sorted = [...pending].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    router.push({
      pathname: '/(livreur)/cash/encaisser' as never,
      params: { livraisonId: sorted[0].id },
    } as never);
  };

  const hasPendingLivraisons = livraisonsClient.some((l) => l.statut !== 'ENCAISSEE');

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={fullName} subtitle={client.quartier?.libelle ?? '—'} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={qC.isFetching && !qC.isLoading}
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
          {/* Hero — avatar + nom + solde */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3">
            <View className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
              <Text className="text-emerald-700 dark:text-emerald-400 font-extrabold text-base">
                {initials || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white text-lg">
                {fullName}
              </Text>
              {client.contact ? (
                <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                  {client.contact}
                </Text>
              ) : null}
            </View>
            {debt ? (
              <View className="items-end">
                <View className="bg-amber-100 dark:bg-amber-500/15 px-2 py-1 rounded-full">
                  <Text className="text-[11px] font-extrabold text-amber-800 dark:text-amber-400">
                    {formatFCFA(solde)} F
                  </Text>
                </View>
                <Text className="text-[9px] text-slate-400 mt-1">SOLDE DÛ</Text>
              </View>
            ) : credit ? (
              <View className="items-end">
                <View className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-1 rounded-full">
                  <Text className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                    +{formatFCFA(Math.abs(solde))} F
                  </Text>
                </View>
                <Text className="text-[9px] text-slate-400 mt-1">CRÉDIT</Text>
              </View>
            ) : (
              <View className="items-end">
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  Solde nul
                </Text>
              </View>
            )}
          </View>

          {/* CTA row */}
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

          {/* Map preview */}
          {geo ? (
            <View className="mt-4">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Localisation
              </Text>
              <MapPreview lat={geo.lat} lng={geo.lng} height={180} />
              <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2 font-mono">
                {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View className="mt-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3">
              <Text className="text-[12px] text-amber-700 dark:text-amber-400">
                Pas de coordonnées GPS enregistrées pour ce client.
              </Text>
            </View>
          )}

          {/* Carte « Prix personnalisés » */}
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

          {/* Récap chiffré */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Synthèse
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 gap-2">
            <Row label="Encours (livré non encaissé)" value={`${formatFCFA(encours)} FCFA`} />
            <Row label="Livraisons" value={`${livraisonsClient.length}`} />
            <Row label="Encaissements" value={`${encaissementsClient.length}`} />
          </View>

          {/* Infos client */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Informations
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 gap-3">
            {client.email ? (
              <InfoRow icon={Mail} label="Email" value={client.email} />
            ) : null}
            {client.adresse ? (
              <InfoRow icon={MapPin} label="Adresse" value={client.adresse} />
            ) : null}
            <InfoRow
              icon={Layers}
              label="Quartier"
              value={
                client.quartier?.libelle
                  ? `${client.quartier.libelle}${client.quartier.zone?.libelle ? ` · ${client.quartier.zone.libelle}` : ''}`
                  : '—'
              }
            />
            <InfoRow
              icon={Tag}
              label="Catégorie"
              value={client.categorie?.libelle ?? '—'}
            />
            <InfoRow
              icon={Percent}
              label="Avec remise"
              value={client.avecOuSansRemise ? 'Oui' : 'Non'}
            />
          </View>

          {/* Livraisons récentes */}
          <View className="flex-row items-center justify-between mt-5 mb-2">
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Livraisons récentes
            </Text>
            {livraisonsClient.length > 5 ? (
              <Pressable
                onPress={() => router.push('/(livreur)/livraisons' as never)}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Text className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Tout voir
                </Text>
                <ArrowRight color="#10b981" size={12} />
              </Pressable>
            ) : null}
          </View>
          {livraisonsClient.length === 0 ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center">
              <Text className="text-slate-400 text-[12px]">
                Aucune livraison pour ce client.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {[...livraisonsClient]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((l) => (
                  <LivraisonCard key={l.id} livraison={l} />
                ))}
            </View>
          )}

          {/* Encaissements récents */}
          {encaissementsClient.length > 0 ? (
            <>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
                Encaissements récents
              </Text>
              <View className="gap-2">
                {[...encaissementsClient]
                  .sort((a, b) => {
                    const da = a.date ? new Date(a.date).getTime() : 0;
                    const db = b.date ? new Date(b.date).getTime() : 0;
                    return db - da;
                  })
                  .slice(0, 5)
                  .map((e) => (
                    <View
                      key={e.reference}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-md p-3 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-[12px] text-slate-700 dark:text-slate-300">
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
            </>
          ) : null}
        </View>
      </ScrollView>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-[12px] text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <Text className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
        {value}
      </Text>
    </View>
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
