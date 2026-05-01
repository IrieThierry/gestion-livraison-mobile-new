import { ScrollView, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Phone, MapPin, Banknote } from 'lucide-react-native';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { PageHeader } from '../../../components/shared/PageHeader';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { callPhone, navigateTo } from '../../../lib/linking';
import { formatFCFA, formatDateShort, formatTime } from '../../../lib/format';
import { isAEncaisser } from '../../../lib/livraison-status';

/**
 * The backend stores client coords as a single string "lat,lng".
 * Returns null if the string is empty / unparseable.
 */
function parseLatLng(raw: string | undefined | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export default function LivraisonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const q = useLivraisonsByLivreur(user?.id ?? '');

  if (!user) return null;

  if (q.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  const livraison = (q.data ?? []).find((l) => l.id === id);
  if (!livraison) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Livraison" />
        <EmptyState
          title="Livraison introuvable"
          message="Cette livraison n'est pas dans ta tournée actuelle."
        />
      </View>
    );
  }

  const c = livraison.client;
  const clientName = `${c.prenom} ${c.nom}`;
  const geo = parseLatLng(c.latitudeLongitude);
  const hasGeo = geo !== null;
  const hasPhone = !!c.contact && c.contact.trim().length > 0;
  const lignes = livraison.produitsLivraison ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={clientName}
        subtitle={`${formatDateShort(livraison.date)} · ${formatTime(livraison.date)}`}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          {/* Hero — montant + statut + actions */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {formatFCFA(livraison.montantLivre)}{' '}
                  <Text className="text-base font-semibold text-slate-500 dark:text-slate-400">
                    FCFA
                  </Text>
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {c.quartier?.libelle ?? 'Quartier inconnu'}
                </Text>
              </View>
              <StatusBadge
                statut={livraison.statutEncaissement ?? livraison.statut}
              />
            </View>

            <View className="flex-row gap-2 mt-4">
              <Pressable
                onPress={() => hasPhone && callPhone(c.contact)}
                disabled={!hasPhone}
                className={`flex-1 py-2.5 rounded-md flex-row items-center justify-center gap-2 ${
                  hasPhone ? 'bg-emerald-500 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <Phone color={hasPhone ? '#fff' : '#94a3b8'} size={16} />
                <Text className={`font-bold ${hasPhone ? 'text-white' : 'text-slate-400'}`}>
                  Appeler
                </Text>
              </Pressable>

              <Pressable
                onPress={() => geo && navigateTo(geo.lat, geo.lng, clientName)}
                disabled={!hasGeo}
                className={`flex-1 py-2.5 rounded-md flex-row items-center justify-center gap-2 ${
                  hasGeo ? 'bg-blue-500 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <MapPin color={hasGeo ? '#fff' : '#94a3b8'} size={16} />
                <Text className={`font-bold ${hasGeo ? 'text-white' : 'text-slate-400'}`}>
                  Y aller
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Lignes — products delivered */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Produits livrés ({lignes.length})
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {lignes.length === 0 ? (
              <Text className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                Aucun produit
              </Text>
            ) : (
              lignes.map((ligne, i) => (
                <View
                  key={ligne.id ?? i}
                  className={`px-4 py-3 flex-row items-center justify-between ${
                    i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                  }`}
                >
                  <Text className="text-slate-900 dark:text-white flex-1 pr-2">
                    {ligne.produit.designation}
                  </Text>
                  <Text className="text-slate-700 dark:text-slate-300 font-semibold">
                    {ligne.qteLivre} × {formatFCFA(ligne.prixDeVente)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Encaisser button — only if not already encaissée */}
          {isAEncaisser(livraison) ? (
            <Pressable
              disabled={!isOnline}
              onPress={() =>
                router.push({
                  pathname: '/(livreur)/cash/encaisser' as never,
                  params: { livraisonId: livraison.id },
                })
              }
              className={`mt-5 rounded-md py-3 flex-row items-center justify-center gap-2 ${
                isOnline ? 'bg-emerald-500 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <Banknote color={isOnline ? '#fff' : '#94a3b8'} size={18} />
              <Text className={`font-bold ${isOnline ? 'text-white' : 'text-slate-400'}`}>
                {isOnline ? 'Encaisser' : 'Hors ligne — réessaye en ligne'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
