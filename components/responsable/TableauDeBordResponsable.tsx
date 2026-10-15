import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState } from '../shared/EmptyState';
import { Avatar } from '../shared/Avatar';
import { AbonnementExpireBanner } from '../shared/AbonnementExpireBanner';
import { useMonOrganisation, useTableauDeBord } from '../../features/organisation/hooks';
import {
  LIBELLE_ETAT_ACTUEL,
  LIBELLE_VALEUR_INCOMPLETE,
  jourPrecedent,
  jourSuivant,
  libelleJourTableau,
  nomCommercial,
  peutAvancer,
  valeurIncomplete,
} from '../../features/organisation/tableauDeBord';
import { jourLocal } from '../../features/previsions/regles';
import { useRemisesAConfirmer } from '../../features/remises-argent/hooks';
import { nbRemisesAConfirmer } from '../../features/remises-argent/regles';
import { useTransfertsADecider } from '../../features/transferts/hooks';
import { nbTransfertsADecider } from '../../features/transferts/regles';
import { useAuthStore } from '../../stores/authStore';
import { formatMontant } from '../../lib/format';
import { extractApiErrorMessage } from '../../lib/api-error';
import { ouvrir } from '../../lib/navigation-app';
import type {
  StockValoriseTableauDeBord,
  TableauDeBordResponse,
  VentesJourTableauDeBord,
} from '../../types/api';

const fcfa = (n: number | null | undefined) => `${formatMontant(n)} FCFA`;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Accueil du responsable sur le mobile (O15, O16) : son tableau de bord en
 * lecture. Le jour choisi porte sur les ventes, avoirs et encaissements
 * (l'argent non remis est cumulé jusqu'à la fin de ce jour) ; stock,
 * transit, encours et demandes sont l'état actuel. La carte « À traiter »
 * ouvre ses Notifications (déchargements, remises d'argent).
 */
export function TableauDeBordResponsable() {
  const user = useAuthStore((s) => s.user);
  const aujourdhui = jourLocal();
  const [jour, setJour] = useState(aujourdhui);
  const q = useTableauDeBord(jour);
  const orgQ = useMonOrganisation();
  const transfertsQ = useTransfertsADecider();
  const remisesQ = useRemisesAConfirmer();

  const nbDechargements = nbTransfertsADecider(transfertsQ.data, user?.id);
  const nbRemises = nbRemisesAConfirmer(remisesQ.data);
  const organisation = orgQ.data;

  const rafraichir = () => {
    q.refetch();
    transfertsQ.refetch();
    remisesQ.refetch();
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Tableau de bord"
        subtitle={organisation?.raisonSociale ?? 'Espace responsable'}
        showBack={false}
        right={<Avatar prenom={organisation?.raisonSociale} photoUrl={organisation?.photoUrl} size={36} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={[q, transfertsQ, remisesQ].some((x) => x.isFetching && !x.isLoading)}
            onRefresh={rafraichir}
            tintColor="#047857"
          />
        }
      >
        <AbonnementExpireBanner />

        {/* À traiter : les deux actions du responsable sur le mobile. */}
        <Pressable
          onPress={() => ouvrir('/(livreur)/notifications')}
          accessibilityRole="button"
          accessibilityLabel="À traiter"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3 active:opacity-70"
        >
          <Bell color={nbDechargements + nbRemises > 0 ? '#f59e0b' : '#94a3b8'} size={20} />
          <View className="flex-1">
            <Text className="font-extrabold text-slate-900 dark:text-white">À traiter</Text>
            <Text className="text-[12px] text-slate-600 dark:text-slate-400">
              {`${pluriel(nbDechargements, 'déchargement')} à accepter · ${pluriel(nbRemises, 'remise')} à confirmer`}
            </Text>
          </View>
          <ChevronRight color="#94a3b8" size={18} />
        </Pressable>

        {/* Jour des ventes */}
        <View className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
          <Pressable
            onPress={() => setJour(jourPrecedent(jour))}
            accessibilityRole="button"
            accessibilityLabel="Jour précédent"
            hitSlop={8}
            className="p-2 active:opacity-60"
          >
            <ChevronLeft color="#475569" size={18} />
          </Pressable>
          <Text className="font-extrabold text-slate-900 dark:text-white">{libelleJourTableau(jour, aujourdhui)}</Text>
          <Pressable
            onPress={() => setJour(jourSuivant(jour))}
            disabled={!peutAvancer(jour, aujourdhui)}
            accessibilityRole="button"
            accessibilityLabel="Jour suivant"
            accessibilityState={{ disabled: !peutAvancer(jour, aujourdhui) }}
            hitSlop={8}
            className={`p-2 ${peutAvancer(jour, aujourdhui) ? 'active:opacity-60' : 'opacity-30'}`}
          >
            <ChevronRight color="#475569" size={18} />
          </Pressable>
        </View>

        {q.isLoading ? (
          <ActivityIndicator color="#047857" style={{ marginTop: 24 }} />
        ) : q.isError || !q.data ? (
          <EmptyState
            title="Tableau de bord indisponible"
            message={extractApiErrorMessage(q.error, 'Le tableau de bord n’a pas pu être lu. Tire pour réessayer.')}
          />
        ) : (
          <Contenu tdb={q.data} />
        )}
      </ScrollView>
    </View>
  );
}

function Contenu({ tdb }: { tdb: TableauDeBordResponse }) {
  const remisesEnAttente = tdb.commerciaux.reduce((acc, c) => acc + Number(c.argent.remisesEnAttente), 0);
  return (
    <>
      <Bloc titre="Ventes">
        <Ventes ventes={tdb.ventes} />
      </Bloc>

      <Bloc titre="Argent non remis">
        <View className="flex-row gap-3">
          <Chiffre libelle="Argent non remis" valeur={fcfa(tdb.argentNonRemis)} accent />
          <Chiffre libelle="Remises en attente" valeur={fcfa(remisesEnAttente)} />
        </View>
      </Bloc>

      <Bloc titre="Commerciaux">
        {tdb.commerciaux.length === 0 ? (
          <Text className="text-[12px] text-slate-500 dark:text-slate-400">Aucun commercial.</Text>
        ) : (
          tdb.commerciaux.map((c, i) => (
            <View
              key={c.commercialId}
              accessibilityLabel={`Commercial ${nomCommercial(c)}`}
              className={`gap-1.5 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800 pt-3 mt-1' : ''}`}
            >
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-extrabold text-slate-900 dark:text-white">{nomCommercial(c)}</Text>
                {!c.actif ? (
                  <Text className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Inactif
                  </Text>
                ) : null}
              </View>
              <Ventes ventes={c.ventes} compact />
              <Ligne libelle="Argent non remis" valeur={fcfa(c.argent.nonRemis)} />
              <Ligne libelle="Remises en attente" valeur={fcfa(c.argent.remisesEnAttente)} />
              <Ligne
                libelle="Camion"
                valeur={`${c.camion.quantiteTotale} u. · ${fcfa(c.camion.valeur)}`}
                note={valeurIncomplete(c.camion) ? LIBELLE_VALEUR_INCOMPLETE : undefined}
              />
            </View>
          ))
        )}
      </Bloc>

      <Bloc titre="Stock du dépôt" etatActuel>
        <Stock bloc={tdb.depot} />
      </Bloc>

      <Bloc titre="Stock des camions" etatActuel>
        <Stock bloc={tdb.camions} />
      </Bloc>

      <Bloc titre="Marchandise en transit" etatActuel>
        <Ligne libelle="Vers les commerciaux" valeur={`${tdb.enTransit.versCommerciaux} u.`} />
        <Ligne libelle="Vers le dépôt" valeur={`${tdb.enTransit.versDepot} u.`} />
        {tdb.enTransit.lignes.map((l) => (
          <Text key={l.produitId} className="text-[12px] text-slate-600 dark:text-slate-400">
            {`${l.designation} : ${l.versCommerciaux} vers les commerciaux · ${l.versDepot} vers le dépôt`}
          </Text>
        ))}
      </Bloc>

      <Bloc titre="Encours clients" etatActuel>
        <Ligne libelle="Total dû" valeur={fcfa(tdb.encours.total)} />
        <Ligne libelle="Clients débiteurs" valeur={String(tdb.encours.nombreClients)} />
        <Ligne libelle="Avances" valeur={fcfa(tdb.encours.avances)} />
      </Bloc>

      <Bloc titre="Demandes de chargement en attente" etatActuel>
        <Ligne libelle="En attente" valeur={String(tdb.nombreDemandesEnAttente)} />
        {tdb.demandesEnAttente.map((d) => (
          <Text key={d.id} className="text-[12px] text-slate-600 dark:text-slate-400">
            {`${d.reference} · ${nomCommercial({ prenom: d.commercialPrenom, nom: d.commercialNom })} · ${d.quantiteTotaleDemandee} u.`}
          </Text>
        ))}
        {tdb.nombreDemandesEnAttente > 0 ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Les demandes se servent sur le portail web.
          </Text>
        ) : null}
      </Bloc>
    </>
  );
}

/** Facturé / Avoirs / Net, puis Encaissements du jour. */
function Ventes({ ventes, compact = false }: { ventes: VentesJourTableauDeBord; compact?: boolean }) {
  return (
    <View className="gap-1.5">
      <Ligne
        libelle="Facturé / Avoirs / Net"
        valeur={`${formatMontant(ventes.totalTtc)} / ${formatMontant(ventes.totalAvoirsTtc)} / ${fcfa(ventes.netTtc)}`}
        note={compact ? undefined : `${pluriel(ventes.nombre, 'facture')} · ${pluriel(ventes.nombreAvoirs, 'avoir')}`}
      />
      <Ligne libelle="Encaissements du jour" valeur={fcfa(ventes.encaisse)} />
    </View>
  );
}

function Stock({ bloc }: { bloc: StockValoriseTableauDeBord }) {
  return (
    <>
      <Ligne libelle="Quantité" valeur={`${bloc.quantiteTotale} u.`} />
      <Ligne
        libelle="Valeur"
        valeur={fcfa(bloc.valeur)}
        note={valeurIncomplete(bloc) ? LIBELLE_VALEUR_INCOMPLETE : undefined}
      />
      {bloc.lignes.map((l) => (
        <Text key={l.produitId} className="text-[12px] text-slate-600 dark:text-slate-400">
          {`${l.designation} : ${l.quantite} u. · ${l.valeur == null ? 'sans prix' : fcfa(l.valeur)}`}
        </Text>
      ))}
    </>
  );
}

function Bloc({ titre, etatActuel = false, children }: { titre: string; etatActuel?: boolean; children: ReactNode }) {
  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 gap-1.5">
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="flex-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
          {titre}
        </Text>
        {etatActuel ? (
          <Text className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded">
            {LIBELLE_ETAT_ACTUEL}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Ligne({ libelle, valeur, note }: { libelle: string; valeur: string; note?: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Text className="flex-1 text-[13px] text-slate-600 dark:text-slate-400">{libelle}</Text>
      <View className="items-end">
        <Text className="text-[13px] font-bold text-slate-900 dark:text-white">{valeur}</Text>
        {note ? <Text className="text-[11px] text-amber-700 dark:text-amber-300">{note}</Text> : null}
      </View>
    </View>
  );
}

function Chiffre({ libelle, valeur, accent = false }: { libelle: string; valeur: string; accent?: boolean }) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">{libelle}</Text>
      <Text
        className={`text-base font-extrabold ${accent ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}
      >
        {valeur}
      </Text>
    </View>
  );
}
