import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { ProduitVignette } from '../shared/ProduitVignette';
import {
  LIBELLE_STATUT,
  formatEcart,
  jourCourt,
  nomClient,
  type BlocClient,
  type GroupePrevision,
  type StatutPrevision,
} from '../../features/previsions/regles';

const COULEURS: Record<StatutPrevision, { fond: string; texte: string }> = {
  A_LIVRER: { fond: 'bg-slate-100 dark:bg-slate-800', texte: 'text-slate-600 dark:text-slate-300' },
  PARTIEL: { fond: 'bg-amber-100 dark:bg-amber-500/15', texte: 'text-amber-700 dark:text-amber-300' },
  LIVRE: { fond: 'bg-emerald-100 dark:bg-emerald-500/15', texte: 'text-emerald-700 dark:text-emerald-300' },
};

function Pastille({ texte, fond, couleur }: { texte: string; fond: string; couleur: string }) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${fond}`}>
      <Text className={`text-[10px] font-bold ${couleur}`}>{texte}</Text>
    </View>
  );
}

export function PastilleStatut({ statut }: { statut: StatutPrevision }) {
  return <Pastille texte={LIBELLE_STATUT[statut]} fond={COULEURS[statut].fond} couleur={COULEURS[statut].texte} />;
}

export function PastilleEchue() {
  return <Pastille texte="Échue" fond="bg-red-100 dark:bg-red-500/15" couleur="text-red-700 dark:text-red-300" />;
}

/** Prévu · Livré · Écart. */
export function ChiffresPrevision({
  ligne,
  livreConnu = true,
}: {
  ligne: Pick<GroupePrevision, 'prevu' | 'livre' | 'ecart'>;
  /** Faux tant que les livraisons ne sont pas lues : Livré et Écart masqués. */
  livreConnu?: boolean;
}) {
  if (!livreConnu) {
    return (
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        Prévu <Text className="font-bold text-slate-800 dark:text-slate-200">{ligne.prevu}</Text>
        {' · '}Livré … · Écart …
      </Text>
    );
  }
  return (
    <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
      Prévu <Text className="font-bold text-slate-800 dark:text-slate-200">{ligne.prevu}</Text>
      {' · '}Livré <Text className="font-bold text-slate-800 dark:text-slate-200">{ligne.livre}</Text>
      {' · '}Écart{' '}
      <Text
        className={`font-bold ${
          ligne.ecart < 0
            ? 'text-red-600 dark:text-red-400'
            : ligne.ecart > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-800 dark:text-slate-200'
        }`}
      >
        {formatEcart(ligne.ecart)}
      </Text>
    </Text>
  );
}

/** Une ligne regroupée (client + produit + jour) ; actions absentes = lecture seule. */
export function LignePrevision({
  ligne,
  echue,
  livreConnu = true,
  onModifier,
  onSupprimer,
}: {
  ligne: GroupePrevision;
  echue?: boolean;
  /** Faux tant que les livraisons ne sont pas lues : ni Livré, ni pastilles. */
  livreConnu?: boolean;
  onModifier?: () => void;
  onSupprimer?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2 py-2">
      <ProduitVignette designation={ligne.produit.designation} photoUrl={ligne.produit.photoUrl} size={32} />
      <View className="flex-1">
        <Text className="font-bold text-slate-900 dark:text-white text-[13px]">
          {ligne.produit.designation}
        </Text>
        <ChiffresPrevision ligne={ligne} livreConnu={livreConnu} />
        {livreConnu ? (
          <View className="flex-row flex-wrap gap-1 mt-1">
            <PastilleStatut statut={ligne.statut} />
            {echue ? <PastilleEchue /> : null}
          </View>
        ) : null}
        {ligne.commentaire ? (
          <Text className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{ligne.commentaire}</Text>
        ) : null}
      </View>
      {onModifier ? (
        <Pressable
          onPress={onModifier}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Modifier ${ligne.produit.designation}`}
          className="active:opacity-60 p-1.5"
        >
          <Pencil color="#3b82f6" size={15} />
        </Pressable>
      ) : null}
      {onSupprimer ? (
        <Pressable
          onPress={onSupprimer}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Supprimer ${ligne.produit.designation}`}
          className="active:opacity-60 p-1.5"
        >
          <Trash2 color="#ef4444" size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Carte d'un client et de ses lignes. */
export function CarteClient({ bloc, children }: { bloc: BlocClient; children: ReactNode }) {
  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2">
      <Text className="font-extrabold text-slate-900 dark:text-white">{nomClient(bloc.client)}</Text>
      {children}
    </View>
  );
}

/** Modification de la quantité d'une ligne regroupée (remplace le total). */
export function QuantiteModal({
  ligne,
  enCours,
  onFermer,
  onValider,
}: {
  ligne: GroupePrevision | null;
  enCours: boolean;
  onFermer: () => void;
  onValider: (qte: number) => void;
}) {
  const [valeur, setValeur] = useState('');
  useEffect(() => {
    setValeur(ligne ? String(ligne.prevu) : '');
  }, [ligne]);
  const qte = parseInt(valeur, 10);
  const valide = Number.isFinite(qte) && qte > 0;

  return (
    <Modal visible={!!ligne} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <Pressable
            onPress={onFermer}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityLabel="Fermer"
          />
          {ligne ? (
            <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 self-center w-full" style={{ maxWidth: 420 }}>
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white">Modifier la prévision</Text>
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
                {nomClient(ligne.client)} — {ligne.produit.designation} — {jourCourt(ligne.jour)}
              </Text>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-1">
                Quantité prévue (remplace le total)
              </Text>
              <TextInput
                value={valeur}
                onChangeText={(v) => setValeur(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                selectTextOnFocus
                autoFocus
                accessibilityLabel="Quantité prévue"
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white text-base"
              />
              <View className="flex-row gap-2 mt-5">
                <Pressable
                  onPress={onFermer}
                  className="flex-1 rounded-md py-3 items-center border border-slate-200 dark:border-slate-700 active:opacity-70"
                >
                  <Text className="font-bold text-slate-600 dark:text-slate-300">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={() => valide && onValider(qte)}
                  disabled={!valide || enCours}
                  className={`flex-1 rounded-md py-3 items-center ${
                    !valide || enCours ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-500 active:opacity-80'
                  }`}
                >
                  <Text className="font-bold text-white">{enCours ? 'Enregistrement…' : 'Enregistrer'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
