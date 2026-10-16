import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Bell, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react-native';
import { Avatar } from '../../components/shared/Avatar';
import { EmptyState } from '../../components/shared/EmptyState';
import { AbonnementExpireBanner } from '../../components/shared/AbonnementExpireBanner';
import { ListeATraiter, useATraiterFournisseur } from '../../components/fournisseur/ATraiterFournisseur';
import {
  useCommandesFournisseur,
  useFournisseurProfil,
  useLivreursPartenaires,
  useReversementsSyntheseFournisseur,
  useSyntheseFournisseur,
} from '../../features/fournisseur/hooks';
import {
  libelleMois,
  moisDe,
  moisVoisin,
  peutAvancer,
  resumeCommandes,
  resumeLivreurs,
} from '../../features/fournisseur/regles';
import { useMonAbonnement } from '../../features/abonnement/hooks';
import { useNombreNonLues, useRelireAuFocus } from '../../features/notifications/hooks';
import { badgeNonLues, libelleCloche } from '../../features/notifications/regles';
import { extractApiErrorMessage } from '../../lib/api-error';
import { formatMontant } from '../../lib/format';
import { NOTIFICATIONS_FOURNISSEUR } from '../../lib/navigation';
import { ouvrir } from '../../lib/navigation-app';
import { useAuthStore } from '../../stores/authStore';

const SECTION = 'text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 mt-5 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';

const fcfa = (n: number | null | undefined) => `${formatMontant(n ?? 0)} F`;
const nomLivreur = (p: { prenom?: string | null; nom?: string | null }) => `${p.prenom ?? ''} ${p.nom ?? ''}`.trim();

/**
 * F2, onglet 1 : Accueil du fournisseur. Mêmes données que la Synthèse du
 * portail web (mois choisi : total reçu, remise livreur à reverser et déjà
 * reversée, livreurs actifs, « À reverser aux livreurs », top livreurs),
 * plus les chiffres des commandes (en attente, livrées) et des livreurs (dû,
 * remises à reverser), le bloc « À traiter » et la cloche des notifications.
 */
export default function AccueilFournisseur() {
  const user = useAuthStore((s) => s.user);
  const [mois, setMois] = useState(() => moisDe());

  const profilQ = useFournisseurProfil();
  const syntheseQ = useSyntheseFournisseur(mois);
  const reversementsQ = useReversementsSyntheseFournisseur(mois);
  const commandesQ = useCommandesFournisseur();
  const partenairesQ = useLivreursPartenaires();
  const aTraiter = useATraiterFournisseur();
  const aboQ = useMonAbonnement();
  const nonLuesQ = useNombreNonLues(!!user);
  // Retour sur l'Accueil : badge et « À traiter » relus (comme l'Accueil du livreur).
  useRelireAuFocus(() => {
    nonLuesQ.refetch();
    aTraiter.relire();
  });

  if (!user) return null;

  const nonLues = nonLuesQ.data ?? 0;
  const synthese = syntheseQ.data;
  const cmd = resumeCommandes(commandesQ.data, mois);
  const liv = resumeLivreurs(partenairesQ.data);
  const nbVersements = synthese?.nbVersements ?? 0;

  // Tirer pour actualiser : l'indicateur suit toutes les lectures relancées, pas seulement la synthèse.
  const enActualisation = [profilQ, syntheseQ, reversementsQ, commandesQ, partenairesQ].some(
    (x) => x.isFetching && !x.isLoading,
  );

  const actualiser = () => {
    profilQ.refetch();
    syntheseQ.refetch();
    reversementsQ.refetch();
    commandesQ.refetch();
    partenairesQ.refetch();
    aTraiter.relire();
    aboQ.refetch();
    nonLuesQ.refetch();
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={enActualisation}
          onRefresh={actualiser}
          tintColor="#047857"
        />
      }
    >
      <View className="px-4 pt-3">
        {/* En-tête : nom de l'entreprise, cloche, avatar */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">Bonjour</Text>
            <Text className="font-extrabold text-slate-900 dark:text-white text-lg" numberOfLines={1}>
              {profilQ.data?.libelle ?? user.prenom ?? ''}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              hitSlop={6}
              onPress={() => ouvrir(NOTIFICATIONS_FOURNISSEUR)}
              accessibilityRole="button"
              accessibilityLabel={libelleCloche(nonLues, aTraiter.total)}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
            >
              <Bell color="#475569" size={18} />
              {nonLues > 0 ? (
                <View
                  className="absolute -top-1 -right-1 h-4 px-1 rounded-full bg-red-500 items-center justify-center"
                  style={{ minWidth: 16 }}
                >
                  <Text className="text-white text-[9px] font-bold">{badgeNonLues(nonLues)}</Text>
                </View>
              ) : aTraiter.total > 0 ? (
                <View
                  testID="cloche-a-traiter"
                  className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white dark:border-slate-900"
                />
              ) : null}
            </Pressable>
            <Pressable
              hitSlop={6}
              onPress={() => ouvrir('/fournisseur/moi/infos')}
              accessibilityRole="button"
              accessibilityLabel="Modifier mes infos"
              className="active:opacity-70"
            >
              <Avatar prenom={user.prenom} nom={user.nom} photoUrl={user.photoUrl} size={40} />
            </Pressable>
          </View>
        </View>

        <AbonnementExpireBanner />

        {/* À traiter : seulement s'il y a une rubrique (ou une erreur de lecture). */}
        {aTraiter.taches.length > 0 || aTraiter.erreurs.length > 0 ? (
          <>
            <Text className={SECTION}>À traiter</Text>
            <ListeATraiter taches={aTraiter.taches} erreurs={aTraiter.erreurs} onOuvrir={(t) => ouvrir(t.lien)} />
          </>
        ) : null}

        {/* Mois de la synthèse */}
        <View className="flex-row items-center justify-between mt-5">
          <Pressable
            onPress={() => setMois((m) => moisVoisin(m, -1))}
            accessibilityRole="button"
            accessibilityLabel="Mois précédent"
            hitSlop={8}
            className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
          >
            <ChevronLeft color="#64748b" size={18} />
          </Pressable>
          <Text className="font-extrabold text-slate-900 dark:text-white capitalize">{libelleMois(mois)}</Text>
          <Pressable
            onPress={() => setMois((m) => moisVoisin(m, 1))}
            disabled={!peutAvancer(mois)}
            accessibilityRole="button"
            accessibilityLabel="Mois suivant"
            accessibilityState={{ disabled: !peutAvancer(mois) }}
            hitSlop={8}
            className={`w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center ${
              peutAvancer(mois) ? 'active:opacity-70' : 'opacity-40'
            }`}
          >
            <ChevronRight color="#64748b" size={18} />
          </Pressable>
        </View>

        {/* Synthèse du mois (portail web) */}
        {syntheseQ.isLoading ? (
          <ActivityIndicator color="#047857" style={{ marginTop: 24 }} accessibilityLabel="Chargement de la synthèse" />
        ) : syntheseQ.isError ? (
          <View className={`${CARTE} mt-3`}>
            <EmptyState
              title="Synthèse indisponible"
              message={extractApiErrorMessage(syntheseQ.error, 'La synthèse n’a pas pu être lue.')}
            />
            <Pressable onPress={() => syntheseQ.refetch()} accessibilityRole="button" className="self-center pb-4 active:opacity-70">
              <Text className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              className="bg-emerald-700 mt-3 rounded-2xl p-4"
              style={{
                shadowColor: '#047857',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white/95">Total reçu ce mois</Text>
              <Text className="text-white font-extrabold mt-1">
                <Text className="text-4xl">{formatMontant(synthese?.totalVerse ?? 0)}</Text>
                <Text className="text-base"> FCFA</Text>
              </Text>
              <Text className="text-emerald-50 text-[12px] mt-0.5">
                {`${nbVersements} versement${nbVersements > 1 ? 's' : ''}`}
              </Text>
              <View className="flex-row gap-2 mt-3">
                <SousCarte libelle="Livreurs actifs" valeur={String(synthese?.nbLivreursActifs ?? 0)} />
                <SousCarte libelle="Remise déjà reversée" valeur={fcfa(synthese?.remiseLivreurDejaReversee)} />
              </View>
            </View>
            <View className={`${CARTE} border-l-4 border-l-amber-500 p-3 mt-3`}>
              <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
                Remise livreur à reverser
              </Text>
              <Text className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {fcfa(synthese?.remiseLivreurAReverser)}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {`sur ${fcfa(synthese?.remiseLivreurCumuleeMois)} dûs ce mois`}
              </Text>
            </View>
          </>
        )}

        {/* Commandes et livreurs */}
        <Text className={SECTION}>Commandes</Text>
        <View className="flex-row gap-2">
          <Tuile
            libelle="En attente"
            valeur={commandesQ.isError ? '—' : String(cmd.enAttente)}
            detail={
              commandesQ.isError
                ? extractApiErrorMessage(commandesQ.error, 'Commandes indisponibles')
                : `${fcfa(cmd.montantEnAttente)} estimés`
            }
            erreur={commandesQ.isError}
            accent="border-l-orange-500"
            onPress={() => ouvrir('/fournisseur/commandes')}
          />
          <Tuile
            libelle="Livrées ce mois"
            valeur={commandesQ.isError ? '—' : String(cmd.livrees)}
            detail={commandesQ.isError ? 'Commandes indisponibles' : `${fcfa(cmd.montantLivre)} livrés`}
            erreur={commandesQ.isError}
            accent="border-l-emerald-700"
            onPress={() => ouvrir('/fournisseur/commandes')}
          />
        </View>
        <Text className={SECTION}>Livreurs</Text>
        <View className="flex-row gap-2">
          <Tuile
            libelle="Dû des livreurs"
            valeur={partenairesQ.isError ? '—' : fcfa(liv.du)}
            detail={
              partenairesQ.isError
                ? extractApiErrorMessage(partenairesQ.error, 'Livreurs indisponibles')
                : `${liv.debiteurs} livreur${liv.debiteurs > 1 ? 's' : ''} sur ${liv.nombre}`
            }
            erreur={partenairesQ.isError}
            accent="border-l-red-500"
            onPress={() => ouvrir('/fournisseur/livreurs')}
          />
          <Tuile
            libelle="Remises à reverser"
            valeur={partenairesQ.isError ? '—' : fcfa(liv.remiseAReverser)}
            detail={partenairesQ.isError ? 'Livreurs indisponibles' : 'Toutes périodes'}
            erreur={partenairesQ.isError}
            accent="border-l-amber-500"
            onPress={() => ouvrir('/fournisseur/argent')}
          />
        </View>

        {/* À reverser aux livreurs (mois) */}
        <Text className={SECTION}>À reverser aux livreurs</Text>
        <Bloc>
          {reversementsQ.isLoading ? (
            <ActivityIndicator color="#047857" />
          ) : reversementsQ.isError ? (
            <Text className="text-[13px] text-red-600 dark:text-red-400">
              {extractApiErrorMessage(reversementsQ.error, 'Les reversements n’ont pas pu être lus.')}
            </Text>
          ) : !reversementsQ.data?.aReverserAuxLivreurs?.length ? (
            <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">
              Aucun reversement à effectuer ce mois.
            </Text>
          ) : (
            reversementsQ.data.aReverserAuxLivreurs.map((l, i) => (
              <View
                key={l.livreurId}
                className={`py-2.5 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                    {nomLivreur(l)}
                  </Text>
                  <Text className="font-extrabold text-emerald-700 dark:text-emerald-400">
                    {fcfa(l.montantNetAReverser)}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {`Remise du mois ${fcfa(l.remiseLivreurCumuleeMois)} · dette −${fcfa(l.detteCourante)}`}
                </Text>
              </View>
            ))
          )}
        </Bloc>

        {/* Top livreurs (mois) */}
        <View className="flex-row items-center gap-1.5 mt-5 mb-2">
          <TrendingUp color="#047857" size={12} />
          <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
            Top livreurs
          </Text>
        </View>
        <Bloc>
          {syntheseQ.isLoading ? (
            <ActivityIndicator color="#047857" />
          ) : syntheseQ.isError ? (
            <Text className="text-[13px] text-red-600 dark:text-red-400">Synthèse indisponible.</Text>
          ) : !synthese?.topLivreurs?.length ? (
            <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucun versement ce mois.</Text>
          ) : (
            synthese.topLivreurs.map((l, i) => (
              <View
                key={l.livreurId}
                className={`flex-row items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
              >
                <View className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/15 items-center justify-center">
                  <Text className="text-[12px] font-extrabold text-emerald-700 dark:text-emerald-400">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                    {nomLivreur(l)}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    {`${l.nbVersements} versement${l.nbVersements > 1 ? 's' : ''} · remise livreur ${fcfa(l.remiseLivreurCumulee)}`}
                  </Text>
                </View>
                <Text className="font-extrabold text-slate-900 dark:text-white">{fcfa(l.totalVerse)}</Text>
              </View>
            ))
          )}
        </Bloc>
      </View>
    </ScrollView>
  );
}

function Bloc({ children }: { children: ReactNode }) {
  return <View className={`${CARTE} px-4 py-2`}>{children}</View>;
}

function SousCarte({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View accessibilityLabel={`${libelle} : ${valeur}`} className="flex-1 bg-white/15 rounded-xl px-3 py-2">
      <Text className="text-[10px] uppercase font-bold tracking-wide text-white/90" numberOfLines={1}>
        {libelle}
      </Text>
      <Text className="text-white font-extrabold text-lg">{valeur}</Text>
    </View>
  );
}

function Tuile({
  libelle,
  valeur,
  detail,
  erreur,
  accent,
  onPress,
}: {
  libelle: string;
  valeur: string;
  detail: string;
  erreur: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${libelle} : ${valeur}`}
      className={`flex-1 ${CARTE} border-l-4 ${accent} rounded-xl p-3 active:opacity-70`}
    >
      <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
        {libelle}
      </Text>
      <Text className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5" numberOfLines={1} adjustsFontSizeToFit>
        {valeur}
      </Text>
      <Text
        className={`text-[11px] mt-1 ${erreur ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {detail}
      </Text>
    </Pressable>
  );
}
