import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { useDeclarerRemise } from '../../../../features/remises-argent/hooks';
import { COMMENTAIRE_REMISE_MAX, construireDeclaration } from '../../../../features/remises-argent/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { num } from '../../../../features/encaissements/regles';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatMontant } from '../../../../lib/format';
import { useRetourListe } from '../../../../lib/useRetourListe';

/**
 * « Nouvelle remise » (apprenti) : montant remis à son principal et
 * commentaire facultatif. La remise part « Déclarée » ; le principal la
 * confirme ou la conteste. Envoi protégé par `lancerUneFois`.
 */
export default function NouvelleRemise() {
  const m = useDeclarerRemise();
  const verrou = useRef(creerVerrou()).current;
  const retourListe = useRetourListe('/(livreur)/profil/remises');
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const onSubmit = () => {
    const r = construireDeclaration(montant, commentaire);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      m.mutate(r.valeur, {
        onSuccess: (remise) => {
          retourListe();
          dialog.success(
            'Remise déclarée',
            `${remise.reference} · ${formatMontant(num(remise.montant))} FCFA, en attente de confirmation par ton principal.`,
          );
        },
        onError: (e) => setErreur(extractApiErrorMessage(e, 'La remise n’a pas pu être déclarée.')),
        onSettled: fin,
      }),
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle remise" />

      <FormScreen>
        <View className="px-4 gap-3 pt-3">
          <View className="flex-row items-start gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-3">
            <Info color="#2563eb" size={16} />
            <Text className="flex-1 text-[12px] text-blue-800 dark:text-blue-200">
              La remise sera déclarée à ton principal, qui devra la confirmer.
            </Text>
          </View>

          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Montant (FCFA) *
            </Text>
            <TextInput
              value={montant}
              onChangeText={(v) => {
                setMontant(v);
                setErreur(null);
              }}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Montant remis"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
            />
          </View>

          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Commentaire (optionnel)
            </Text>
            <TextInput
              value={commentaire}
              onChangeText={(v) => {
                setCommentaire(v);
                setErreur(null);
              }}
              multiline
              maxLength={COMMENTAIRE_REMISE_MAX}
              placeholder="Ex. recette du matin"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Commentaire"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
              style={{ textAlignVertical: 'top' }}
            />
            <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1">
              {commentaire.length}/{COMMENTAIRE_REMISE_MAX}
            </Text>
          </View>

          {erreur ? (
            <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold">{erreur}</Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            accessibilityRole="button"
            className="bg-emerald-500 rounded-md py-3.5 mt-3 items-center active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Déclarer la remise</Text>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
