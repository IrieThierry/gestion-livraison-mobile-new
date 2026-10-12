import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ListFilter, Share2 } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { SelectField } from '../../../../components/shared/SelectField';
import { DatePickerField } from '../../../../components/shared/DatePickerField';
import { TableauEtat } from '../../../../components/etats/TableauEtat';
import {
  afficheFiltreLivreur,
  choixAutorise,
  choixDepuisId,
  descriptionFamille,
  estFamilleEtat,
  idChoix,
  libelleChoix,
  optionsLivreur,
  peutVoirFamille,
  CHOIX_MOI,
  type ChoixLivreur,
  type FamilleEtat,
} from '../../../../features/etats/acces';
import {
  erreurPeriode,
  libellePeriode,
  periodeParDefaut,
  periodeRaccourci,
  RACCOURCIS_PERIODE,
} from '../../../../features/etats/periode';
import {
  useEtatDepenses,
  useEtatEncaissements,
  useEtatFournisseurs,
  useEtatStock,
  useEtatVentes,
  type ParamsEtat,
  type ResultatEtat,
} from '../../../../features/etats/hooks';
import { partagerPdfEtat } from '../../../../features/etats/partage';
import {
  AUCUN_FILTRE,
  filtresDeFamille,
  ID_TOUS,
  OPTION_TOUS,
  OPTION_TOUTES,
  type ChoixFiltre,
  type ChoixFiltres,
  type OptionFiltre,
  type OptionsFiltres,
} from '../../../../features/etats/filtres';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useApprentis } from '../../../../features/apprentis/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { dialog } from '../../../../lib/dialog';

/**
 * Aperçu d'un état (tableaux à l'écran) avec les filtres de période, de
 * livreur et d'entité (client, produit, fournisseur, type de mouvement), et le bouton « Partager le PDF ». L'aperçu et le PDF sont produits
 * à partir du même document : mêmes lignes, mêmes totaux.
 */
export default function ApercuEtat() {
  const params = useLocalSearchParams<{ famille?: string }>();
  const user = useAuthStore((s) => s.user);
  const famille: FamilleEtat | null = estFamilleEtat(params.famille) ? params.famille : null;

  if (!user) return null;
  if (!famille || !peutVoirFamille(user, famille)) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="États" />
        <View className="px-4 pt-3">
          <EmptyState
            title="État indisponible"
            message="Cet état n’est pas accessible avec ton compte."
          />
        </View>
      </View>
    );
  }
  return <Apercu key={famille} famille={famille} />;
}

function Apercu({ famille }: { famille: FamilleEtat }) {
  const user = useAuthStore((s) => s.user)!;
  const qApprentis = useApprentis();
  const apprentis = useMemo(() => qApprentis.data ?? [], [qApprentis.data]);

  const [debut, setDebut] = useState<string | null>(() => periodeParDefaut().debut);
  const [fin, setFin] = useState<string | null>(() => periodeParDefaut().fin);
  const [choixSaisi, setChoixSaisi] = useState<ChoixLivreur>(CHOIX_MOI);
  const [filtresSaisis, setFiltresSaisis] = useState<ChoixFiltres>(AUCUN_FILTRE);
  const filtresEntite = filtresDeFamille(famille, filtresSaisis);

  const erreur = erreurPeriode({ debut, fin });
  const periode = useMemo(
    () => (!erreur && debut && fin ? { debut, fin } : null),
    [erreur, debut, fin],
  );
  const choix = choixAutorise(
    user,
    choixSaisi,
    apprentis.map((a) => a.id),
    famille,
  );
  const params: ParamsEtat = {
    user,
    choix,
    periode,
    libelleLivreur: libelleChoix(user, choix, apprentis),
    apprentis,
    lectureApprentis: qApprentis,
    filtres: filtresEntite,
  };

  const filtres = (options: OptionsFiltres) => (
    <Filtres
      debut={debut}
      fin={fin}
      onPeriode={(d, f) => {
        setDebut(d);
        setFin(f);
      }}
      erreur={erreur}
      choix={choix}
      onChoix={(c) => {
        setChoixSaisi(c);
        // Changer de livreur réinitialise les filtres d'entité.
        setFiltresSaisis(AUCUN_FILTRE);
      }}
      options={optionsLivreur(user, apprentis)}
      afficheLivreur={afficheFiltreLivreur(user, famille)}
      chargementLivreurs={qApprentis.isLoading}
      optionsEntites={options}
      entites={filtresEntite}
      onEntites={setFiltresSaisis}
    />
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={descriptionFamille(famille).titre}
        subtitle={periode ? libellePeriode(periode) : 'Période à préciser'}
      />
      {famille === 'ventes' ? <EtatVentes params={params} filtres={filtres} /> : null}
      {famille === 'encaissements' ? (
        <EtatEncaissements params={params} filtres={filtres} />
      ) : null}
      {famille === 'stock' ? <EtatStock params={params} filtres={filtres} /> : null}
      {famille === 'fournisseurs' ? (
        <EtatFournisseurs params={params} filtres={filtres} />
      ) : null}
      {famille === 'depenses' ? <EtatDepenses params={params} filtres={filtres} /> : null}
    </View>
  );
}

type PropsEtat = { params: ParamsEtat; filtres: (options: OptionsFiltres) => ReactNode };

function EtatVentes({ params, filtres }: PropsEtat) {
  return <Corps resultat={useEtatVentes(params)} filtres={filtres} periodeValide={!!params.periode} />;
}
function EtatEncaissements({ params, filtres }: PropsEtat) {
  return (
    <Corps resultat={useEtatEncaissements(params)} filtres={filtres} periodeValide={!!params.periode} />
  );
}
function EtatStock({ params, filtres }: PropsEtat) {
  return <Corps resultat={useEtatStock(params)} filtres={filtres} periodeValide={!!params.periode} />;
}
function EtatFournisseurs({ params, filtres }: PropsEtat) {
  return (
    <Corps resultat={useEtatFournisseurs(params)} filtres={filtres} periodeValide={!!params.periode} />
  );
}

function EtatDepenses({ params, filtres }: PropsEtat) {
  return <Corps resultat={useEtatDepenses(params)} filtres={filtres} periodeValide={!!params.periode} />;
}

function Corps({
  resultat,
  filtres,
  periodeValide,
}: {
  resultat: ResultatEtat;
  filtres: (options: OptionsFiltres) => ReactNode;
  periodeValide: boolean;
}) {
  const verrou = useRef(creerVerrou()).current;
  const [partageEnCours, setPartageEnCours] = useState(false);
  // Rien à partager tant qu'une lecture charge ou a échoué : jamais de PDF incomplet.
  const doc = resultat.isLoading || resultat.isError ? null : resultat.document;

  const onPartager = () => {
    if (!doc) return;
    lancerUneFois(verrou, (fin) => {
      setPartageEnCours(true);
      // Date d'édition = moment du partage.
      partagerPdfEtat({ ...doc, editeLe: new Date() })
        .catch((e: unknown) =>
          dialog.error(
            'Partage impossible',
            e instanceof Error && e.message ? e.message : 'Le PDF n’a pas pu être généré.',
          ),
        )
        .finally(() => {
          setPartageEnCours(false);
          fin();
        });
    });
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={resultat.isRefetching}
            onRefresh={resultat.refetch}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {filtres(resultat.options)}
          {!periodeValide ? null : resultat.isLoading ? (
            <View className="mt-6">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : resultat.isError ? (
            <View className="mt-3">
              <EmptyState
                title="Chargement impossible"
                message={extractApiErrorMessage(resultat.error, 'Impossible de charger l’état.')}
              />
            </View>
          ) : doc ? (
            <>
              <View className="flex-row flex-wrap gap-2 mt-4">
                {doc.syntheses.map((s) => (
                  <View
                    key={s.libelle}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-lg px-3 py-2"
                    style={{ minWidth: '47%', flexGrow: 1 }}
                  >
                    <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                      {s.libelle}
                    </Text>
                    <Text className="font-extrabold text-slate-900 dark:text-white text-base">
                      {s.valeur}
                    </Text>
                  </View>
                ))}
              </View>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                Livreur : {doc.livreur}
              </Text>
              {doc.filtres.map((f) => (
                <Text key={f.libelle} className="text-[11px] text-slate-500 dark:text-slate-400">
                  {f.libelle} : {f.valeur}
                </Text>
              ))}
              {doc.sections.map((s) => (
                <TableauEtat key={s.titre} section={s} />
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 px-4 pb-6 pt-3 bg-slate-50/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800">
        <Pressable
          onPress={onPartager}
          disabled={!doc || partageEnCours}
          className={`rounded-lg py-3.5 flex-row items-center justify-center gap-2 ${
            !doc || partageEnCours ? 'bg-emerald-300 dark:bg-emerald-800' : 'bg-emerald-500 active:opacity-80'
          }`}
        >
          {partageEnCours ? <ActivityIndicator color="#fff" /> : <Share2 color="#fff" size={18} />}
          <Text className="text-white font-bold text-base">
            {partageEnCours ? 'Préparation du PDF…' : 'Partager le PDF'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function Filtres({
  debut,
  fin,
  onPeriode,
  erreur,
  choix,
  onChoix,
  options,
  afficheLivreur,
  chargementLivreurs,
  optionsEntites,
  entites,
  onEntites,
}: {
  debut: string | null;
  fin: string | null;
  onPeriode: (debut: string | null, fin: string | null) => void;
  erreur: string | null;
  choix: ChoixLivreur;
  onChoix: (c: ChoixLivreur) => void;
  options: Array<{ id: string; label: string }>;
  afficheLivreur: boolean;
  chargementLivreurs: boolean;
  optionsEntites: OptionsFiltres;
  entites: ChoixFiltres;
  onEntites: (c: ChoixFiltres) => void;
}) {
  const listes: Array<{ cle: keyof ChoixFiltres; label: string; liste?: OptionFiltre[]; tous?: OptionFiltre }> = [
    { cle: 'client', label: 'Client', liste: optionsEntites.clients },
    { cle: 'produit', label: 'Produit', liste: optionsEntites.produits },
    { cle: 'fournisseur', label: 'Fournisseur', liste: optionsEntites.fournisseurs },
    { cle: 'typeMouvement', label: 'Type de mouvement', liste: optionsEntites.typesMouvement },
    { cle: 'categorie', label: 'Catégorie', liste: optionsEntites.categories, tous: OPTION_TOUTES },
  ];
  return (
    <View>
      <View className="flex-row items-center gap-1.5 mb-2">
        <ListFilter color="#64748b" size={12} />
        <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
          Période
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {RACCOURCIS_PERIODE.map((r) => {
          const p = periodeRaccourci(r.key);
          const actif = p.debut === debut && p.fin === fin;
          return (
            <Pressable
              key={r.key}
              onPress={() => onPeriode(p.debut, p.fin)}
              className={`px-3 py-1.5 rounded-md border ${
                actif
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Text
                className={`text-[12px] font-bold ${
                  actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <DatePickerField label="Début" value={debut} onChange={(d) => onPeriode(d, fin)} />
        </View>
        <View className="flex-1">
          <DatePickerField label="Fin" value={fin} onChange={(f) => onPeriode(debut, f)} />
        </View>
      </View>
      {erreur ? (
        <Text className="text-[12px] text-red-600 dark:text-red-400 mt-2">{erreur}</Text>
      ) : null}
      {afficheLivreur ? (
        <View className="mt-3">
          <SelectField
            label="Livreur"
            value={idChoix(choix)}
            onChange={(id) => onChoix(choixDepuisId(id))}
            options={options}
            isLoading={chargementLivreurs}
            emptyMessage="Aucun livreur"
          />
        </View>
      ) : null}
      {listes.map(({ cle, label, liste, tous }) =>
        liste ? (
          <View key={cle} className="mt-3">
            <FiltreEntite
              label={label}
              liste={liste}
              tous={tous}
              valeur={entites[cle]}
              onChange={(v) => onEntites({ ...entites, [cle]: v })}
            />
          </View>
        ) : null,
      )}
    </View>
  );
}

/** Liste avec recherche, « Tous » (ou « Toutes ») par défaut. */
function FiltreEntite({
  label,
  liste,
  tous = OPTION_TOUS,
  valeur,
  onChange,
}: {
  label: string;
  liste: OptionFiltre[];
  tous?: OptionFiltre;
  valeur: ChoixFiltre;
  onChange: (v: ChoixFiltre) => void;
}) {
  // Un choix absent des données de la période reste affiché (et sélectionnable).
  const options = [
    tous,
    ...liste,
    ...(valeur && !liste.some((o) => o.id === valeur.id) ? [valeur] : []),
  ];
  return (
    <SelectField
      label={label}
      value={valeur?.id ?? ID_TOUS}
      options={options}
      onChange={(id) => onChange(!id || id === ID_TOUS ? null : (options.find((o) => o.id === id) ?? null))}
    />
  );
}
