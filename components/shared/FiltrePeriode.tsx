import { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, ListFilter, X } from 'lucide-react-native';
import {
  LIBELLE_PERIODE_PERSO,
  bornesPeriode,
  corrigerIntervalle,
  dateDeJour,
  estPeriodePerso,
  jourIso,
  libelleIntervalle,
  type OptionPeriode,
  type ValeurPeriode,
} from '../../lib/periode';
import { useThemeStore } from '../../stores/themeStore';

/**
 * Filtre de période partagé : pastilles des raccourcis de l'écran, plus
 * « Période… » qui ouvre un choix Du / Au (Au ≥ Du, pas après aujourd'hui).
 * Une fois choisi, la pastille affiche l'intervalle (« 01/10 → 12/10 ») ; un
 * appui la modifie, la croix revient au raccourci par défaut de l'écran.
 * Bornes à utiliser : `bornesPeriode` (lib/periode).
 */
export function FiltrePeriode<K extends string>({
  options,
  valeur,
  defaut,
  onChange,
  titre = 'Période',
}: {
  options: ReadonlyArray<OptionPeriode<K>>;
  valeur: ValeurPeriode<K>;
  /** Raccourci rétabli par la croix. */
  defaut: K;
  onChange: (v: ValeurPeriode<K>) => void;
  /** Titre au-dessus des pastilles ; null pour aucun. */
  titre?: string | null;
}) {
  const [saisie, setSaisie] = useState<{ du: string; au: string } | null>(null);
  const perso = estPeriodePerso(valeur) ? valeur : null;

  const ouvrir = () => {
    const now = new Date();
    const b = bornesPeriode(valeur, options, now);
    const au = b.fin ?? jourIso(now);
    setSaisie(corrigerIntervalle(b.debut ?? au, au, now));
  };

  return (
    <View>
      {titre ? (
        <View className="flex-row items-center gap-1.5 mb-2">
          <ListFilter color="#64748b" size={12} />
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
            {titre}
          </Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Pastille
            key={o.cle}
            active={!estPeriodePerso(valeur) && valeur.cle === o.cle}
            label={o.label}
            onPress={() => onChange({ cle: o.cle })}
          />
        ))}
        {perso ? (
          <View className="flex-row items-center rounded-md border bg-emerald-500 border-emerald-500">
            <Pressable
              onPress={ouvrir}
              accessibilityRole="button"
              accessibilityLabel={`Période ${libelleIntervalle(perso.du, perso.au)}, modifier`}
              className="pl-3 pr-1.5 py-1.5 flex-row items-center gap-1 active:opacity-70"
            >
              <Calendar color="#fff" size={12} />
              <Text className="text-[12px] font-bold text-white">{libelleIntervalle(perso.du, perso.au)}</Text>
            </Pressable>
            <Pressable
              onPress={() => onChange({ cle: defaut })}
              accessibilityRole="button"
              accessibilityLabel="Effacer la période"
              hitSlop={6}
              className="pr-2 pl-1 py-1.5 active:opacity-70"
            >
              <X color="#fff" size={13} />
            </Pressable>
          </View>
        ) : (
          <Pastille active={false} label={LIBELLE_PERIODE_PERSO} onPress={ouvrir} />
        )}
      </View>

      {saisie ? (
        <ChoixDuAu
          initial={saisie}
          onAnnuler={() => setSaisie(null)}
          onValider={(v) => {
            setSaisie(null);
            onChange(v);
          }}
        />
      ) : null}
    </View>
  );
}

function Pastille({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      className={`px-3 py-1.5 rounded-md border ${
        active ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text className={`text-[12px] font-bold ${active ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** `yyyy-MM-dd` → `01/10/2026`. */
function jourLong(j: string): string {
  const [a, m, d] = j.split('-');
  return `${d}/${m}/${a}`;
}

/**
 * Feuille Du / Au. Le calendrier s'ouvre dans la feuille (iOS) ou en
 * dialogue natif (Android) : pas de modale imbriquée.
 */
function ChoixDuAu({
  initial,
  onAnnuler,
  onValider,
}: {
  initial: { du: string; au: string };
  onAnnuler: () => void;
  onValider: (v: { du: string; au: string }) => void;
}) {
  const [du, setDu] = useState(initial.du);
  const [au, setAu] = useState(initial.au);
  const [edition, setEdition] = useState<'du' | 'au' | null>(null);
  const aujourdhui = new Date();
  // Calendrier iOS « inline » : couleurs du thème de l'appli (la feuille le suit), pas de celui du système.
  const theme = useThemeStore((s) => s.effective);

  // Stable : le dialogue Android se rouvre si `onChange` change pendant qu'il est ouvert.
  const choisir = useCallback((evenement: { type?: string }, d?: Date) => {
    const champ = edition;
    if (Platform.OS !== 'ios') setEdition(null);
    if (evenement?.type === 'dismissed' || !d || !champ) return;
    const j = jourIso(d);
    // Au ≥ Du et pas après aujourd'hui : un Du après Au repousse Au.
    if (champ === 'du') {
      const v = corrigerIntervalle(j, j > au ? j : au, aujourdhui);
      setDu(v.du);
      setAu(v.au);
    } else {
      const v = corrigerIntervalle(du, j, aujourdhui);
      setDu(v.du);
      setAu(v.au);
    }
  }, [edition, du, au]);

  return (
    <Modal transparent animationType="fade" onRequestClose={onAnnuler}>
      <Pressable className="flex-1 bg-black/40" onPress={onAnnuler}>
        <Pressable
          onPress={() => {}}
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl pt-4 pb-8 px-4"
        >
          <Text className="font-extrabold text-slate-900 dark:text-white text-base mb-3">Choisir la période</Text>
          <View className="flex-row gap-2">
            <ChampJour label="Du" valeur={du} actif={edition === 'du'} onPress={() => setEdition('du')} />
            <ChampJour label="Au" valeur={au} actif={edition === 'au'} onPress={() => setEdition('au')} />
          </View>

          {edition ? (
            <DateTimePicker
              value={dateDeJour(edition === 'du' ? du : au)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={choisir}
              minimumDate={edition === 'au' ? dateDeJour(du) : undefined}
              maximumDate={aujourdhui}
              themeVariant={theme}
            />
          ) : null}

          <View className="flex-row gap-2 mt-4">
            <Pressable
              onPress={onAnnuler}
              accessibilityRole="button"
              className="flex-1 py-3 rounded-md border border-slate-200 dark:border-slate-700 items-center active:opacity-70"
            >
              <Text className="font-bold text-slate-700 dark:text-slate-300">Annuler</Text>
            </Pressable>
            <Pressable
              onPress={() => onValider(corrigerIntervalle(du, au, new Date()))}
              accessibilityRole="button"
              className="flex-1 py-3 rounded-md bg-emerald-500 items-center active:opacity-80"
            >
              <Text className="font-bold text-white">Appliquer</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChampJour({
  label,
  valeur,
  actif,
  onPress,
}: {
  label: string;
  valeur: string;
  actif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${jourLong(valeur)}`}
      className={`flex-1 px-3 py-2.5 rounded-md border active:opacity-70 ${
        actif ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-700'
      } bg-white dark:bg-slate-900`}
    >
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <Text className="text-base text-slate-900 dark:text-white mt-0.5">{jourLong(valeur)}</Text>
    </Pressable>
  );
}
