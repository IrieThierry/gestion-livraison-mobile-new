import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { ArrowRightLeft, Check, History, MapPinned, Users } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { SearchInput } from '../../../../components/shared/SearchInput';
import { SelectField } from '../../../../components/shared/SelectField';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { useApprentis } from '../../../../features/apprentis/hooks';
import { useClientsEquipe } from '../../../../features/clients/hooks';
import { useZones } from '../../../../features/lookups/hooks';
import { useReaffecterClients } from '../../../../features/equipe/hooks';
import {
  ciblesReaffectation,
  clientsAffiches,
  demandeReaffectation,
  livreurDuClient,
  messageResultat,
  nomComplet,
  peutReaffecter,
  type ModeReaffectation,
} from '../../../../features/equipe/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { AUCUN_RESULTAT } from '../../../../lib/recherche';
import { dialog } from '../../../../lib/dialog';
import { naviguer } from '../../../../lib/navigation-app';

/**
 * « Réaffecter des clients » (P8) — livreur principal indépendant seulement.
 *
 * 1. Clients : une sélection dans les clients de l'équipe (les siens et ceux
 *    de ses apprentis), ou une zone (tous les clients de l'équipe dont le
 *    quartier est dans la zone).
 * 2. Cible : un apprenti actif, ou soi-même pour reprendre les clients.
 * 3. Envoi protégé par `lancerUneFois` ; les refus du back sont affichés tels
 *    quels. L'historique s'ouvre avec « Historique ».
 *
 * Ouvert depuis « Mes apprentis » ou depuis « Mes clients » (`depuis=clients`).
 */
export default function ReaffecterClients() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const autorise = peutReaffecter(user);
  const moiId = user?.id ?? '';

  const qClients = useClientsEquipe(moiId, autorise);
  const qApprentis = useApprentis();
  const qZones = useZones();
  const m = useReaffecterClients();
  const verrou = useRef(creerVerrou()).current;

  const [mode, setMode] = useState<ModeReaffectation>('selection');
  const [selection, setSelection] = useState<string[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const clients = useMemo(
    () => clientsAffiches(qClients.data, recherche, moiId),
    [qClients.data, recherche, moiId],
  );
  const cibles = useMemo(
    () => (user ? ciblesReaffectation(user, qApprentis.data) : []),
    [user, qApprentis.data],
  );
  const zones = useMemo(
    () =>
      [...(qZones.data ?? [])]
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }))
        .map((z) => ({ id: z.id, label: z.libelle })),
    [qZones.data],
  );

  if (!user) return null;

  if (!autorise) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Réaffecter des clients" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal indépendant réaffecte les clients de son équipe."
        />
      </View>
    );
  }

  const basculer = (id: string) => {
    setErreur(null);
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const onSubmit = () => {
    if (verrou.enCours) return;
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Reconnecte-toi pour réaffecter des clients.');
      return;
    }
    const r = demandeReaffectation(mode, selection, zoneId, cibleId);
    if ('erreur' in r) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      m.mutate(r.demande, {
        onSuccess: (res) => {
          setSelection([]);
          setZoneId(null);
          dialog.success('Réaffectation enregistrée', messageResultat(res?.reaffectes ?? 0));
        },
        onError: (err) => setErreur(extractApiErrorMessage(err, 'Réaffectation impossible')),
        onSettled: fin,
      }),
    );
  };

  const n = selection.length;
  const cible = cibles.find((c) => c.id === cibleId) ?? null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Réaffecter des clients"
        subtitle="Entre toi et tes apprentis"
        right={
          <Pressable
            onPress={() => naviguer('/(livreur)/profil/apprentis/reaffectations')}
            accessibilityRole="button"
            accessibilityLabel="Historique des réaffectations"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-70"
          >
            <History color="#8b5cf6" size={14} />
            <Text className="text-slate-700 dark:text-slate-300 text-xs font-bold">Historique</Text>
          </Pressable>
        }
      />

      <FormScreen
        refreshControl={
          <RefreshControl
            refreshing={qClients.isFetching && !qClients.isLoading}
            onRefresh={() => {
              qClients.refetch();
              qApprentis.refetch();
            }}
            tintColor="#047857"
          />
        }
      >
        <View className="px-4 pt-3">
          <Text className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
            La dette suit le client ; ses livraisons et encaissements restent à leur auteur.
          </Text>

          {/* 1. Clients : sélection ou zone */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
            1. Clients
          </Text>
          <View className="flex-row gap-2 mb-3">
            <ChoixMode
              actif={mode === 'selection'}
              label="Sélection"
              icon={Users}
              onPress={() => {
                setMode('selection');
                setErreur(null);
              }}
            />
            <ChoixMode
              actif={mode === 'zone'}
              label="Par zone"
              icon={MapPinned}
              onPress={() => {
                setMode('zone');
                setErreur(null);
              }}
            />
          </View>

          {mode === 'zone' ? (
            <SelectField
              label="Zone"
              placeholder="Choisir une zone"
              value={zoneId}
              options={zones}
              onChange={(z) => {
                setZoneId(z);
                setErreur(null);
              }}
              isLoading={qZones.isLoading}
              emptyMessage="Aucune zone"
            />
          ) : qClients.isLoading ? (
            <ActivityIndicator color="#047857" />
          ) : qClients.isError ? (
            <EmptyState
              title="Chargement impossible"
              message={extractApiErrorMessage(qClients.error, 'Impossible de charger les clients de l’équipe.')}
            />
          ) : (qClients.data ?? []).length === 0 ? (
            <EmptyState title="Aucun client" message="Ton équipe n’a pas encore de client." />
          ) : (
            <View>
              <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Client, quartier, livreur…" />
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 mb-1">
                {n} client{n > 1 ? 's' : ''} sélectionné{n > 1 ? 's' : ''}
              </Text>
              {clients.length === 0 ? (
                <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">{AUCUN_RESULTAT}</Text>
              ) : (
                <View className="gap-1.5">
                  {clients.map((c) => {
                    const coche = selection.includes(c.id);
                    const nom = nomComplet(c.prenom, c.nom);
                    const livreur = livreurDuClient(c, moiId);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => basculer(c.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: coche }}
                        accessibilityLabel={nom}
                        className={`flex-row items-center gap-3 px-3 py-2.5 rounded-md border active:opacity-70 ${
                          coche
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <View
                          className={`w-5 h-5 rounded border items-center justify-center ${
                            coche ? 'bg-emerald-700 border-emerald-700' : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {coche ? <Check color="#fff" size={13} /> : null}
                        </View>
                        <View className="flex-1">
                          <Text className="font-bold text-slate-900 dark:text-white text-[13px]">{nom}</Text>
                          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                            {c.quartier?.libelle ?? '—'}
                            {livreur ? ` · ${livreur}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* 2. Cible */}
          <View className="mt-5">
            <SelectField
              label="2. Apprenti qui reprend les clients"
              placeholder="Choisir l’apprenti"
              value={cibleId}
              options={cibles}
              onChange={(id) => {
                setCibleId(id);
                setErreur(null);
              }}
              isLoading={qApprentis.isLoading}
            />
          </View>

          {erreur ? (
            <Text accessibilityRole="alert" className="text-[12px] text-red-600 dark:text-red-400 mt-3">
              {erreur}
            </Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline}
            accessibilityRole="button"
            accessibilityLabel="Réaffecter"
            className={`rounded-md py-3.5 mt-5 flex-row items-center justify-center gap-2 ${
              m.isPending || !isOnline ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-700 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ArrowRightLeft color="#fff" size={16} />
                <Text className="font-bold text-base text-white">
                  {!isOnline
                    ? 'Hors ligne — réessaye en ligne'
                    : mode === 'selection' && n > 0 && cible
                    ? `Réaffecter ${n} client${n > 1 ? 's' : ''}`
                    : 'Réaffecter'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}

function ChoixMode({
  actif,
  label,
  icon: Icon,
  onPress,
}: {
  actif: boolean;
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: actif }}
      className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-md border ${
        actif ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <Icon color={actif ? '#fff' : '#64748b'} size={14} />
      <Text className={`text-[13px] font-bold ${actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
