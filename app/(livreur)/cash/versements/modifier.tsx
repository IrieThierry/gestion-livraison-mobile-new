import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { DatePickerField } from '../../../../components/shared/DatePickerField';
import { useVersementsLivreur } from '../../../../features/versements/hooks';
import { useCreerDemandeModif } from '../../../../features/demandes-modif/hooks';
import { construireDemandeModif } from '../../../../features/demandes-modif/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useAuthStore } from '../../../../stores/authStore';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { dialog } from '../../../../lib/dialog';
import { formatDateLong, formatFCFA } from '../../../../lib/format';
import { useRetourListe } from '../../../../lib/useRetourListe';

const LABEL = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2';
const CHAMP =
  'px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white';

/**
 * N7 : « Demander une modification » d'un versement (mêmes champs que le web) :
 * nouvelle date de versement, nouveau montant, nouveau commentaire ; un champ
 * laissé vide ne change pas. Motif obligatoire. Le fournisseur doit approuver.
 */
export default function DemanderModificationVersement() {
  const { versementId } = useLocalSearchParams<{ versementId?: string }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const estPrincipal = !!user && !user.parentId;
  const q = useVersementsLivreur(estPrincipal ? user?.id : undefined);
  const m = useCreerDemandeModif();
  const verrou = useRef(creerVerrou()).current;
  const retourListe = useRetourListe('/(livreur)/cash/versements/demandes');

  const [dateVersement, setDateVersement] = useState<string | null>(null);
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [motif, setMotif] = useState('');

  if (!user) return null;

  const versement = (q.data ?? []).find((v) => v.id === versementId);

  if (!estPrincipal || (!q.isLoading && !versement)) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Demander une modification" />
        {q.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(q.error, 'Impossible de charger le versement.')}
          />
        ) : (
          <EmptyState
            title={estPrincipal ? 'Versement introuvable' : 'Réservé au livreur principal'}
            message={estPrincipal ? undefined : 'Seul le livreur principal gère les versements aux fournisseurs.'}
          />
        )}
      </View>
    );
  }

  const onSubmit = () => {
    if (!versement) return;
    const r = construireDemandeModif({
      versementId: versement.id,
      dateVersement,
      montantVerse: montant,
      commentaire,
      motif,
    });
    if (!r.ok) {
      dialog.warning('Demande incomplète', r.erreur);
      return;
    }
    lancerUneFois(verrou, (fin) =>
      m.mutate(r.valeur, {
        onSettled: fin,
        onSuccess: () => {
          retourListe();
          dialog.success('Demande de modification envoyée', 'Le fournisseur doit l’approuver.');
        },
        onError: (err: unknown) =>
          dialog.error('Erreur', extractApiErrorMessage(err, 'Création de demande impossible')),
      }),
    );
  };

  const desactive = m.isPending || !isOnline || !motif.trim();

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Demander une modification" subtitle={versement?.fournisseur?.libelle} />
      <FormScreen>
        {q.isLoading || !versement ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#10b981" />
          </View>
        ) : (
          <View className="px-4 pt-3 gap-3">
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <Text className="text-[12px] text-slate-700 dark:text-slate-300">
                Versement du {formatDateLong(versement.dateVersement)} : {formatFCFA(Number(versement.montantVerse))} F
                chez {versement.fournisseur?.libelle ?? 'le fournisseur'}.
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Livraisons du {formatDateLong(versement.dateDebut)} au {formatDateLong(versement.dateFin)} (plage
                déterminée par les commandes réglées, non modifiable). Laisse un champ vide pour ne pas le modifier.
              </Text>
            </View>

            <DatePickerField
              label="Nouvelle date de versement"
              value={dateVersement}
              onChange={setDateVersement}
              optional
              maximumDate={new Date()}
            />

            <View>
              <Text className={LABEL}>Nouveau montant versé (FCFA)</Text>
              <TextInput
                value={montant}
                onChangeText={setMontant}
                keyboardType="decimal-pad"
                accessibilityLabel="Nouveau montant versé"
                placeholder={String(versement.montantVerse)}
                placeholderTextColor="#94a3b8"
                className={CHAMP}
              />
            </View>

            <View>
              <Text className={LABEL}>Nouveau commentaire</Text>
              <TextInput
                value={commentaire}
                onChangeText={setCommentaire}
                accessibilityLabel="Nouveau commentaire"
                placeholder={versement.commentaire ?? 'Aucun commentaire'}
                placeholderTextColor="#94a3b8"
                className={CHAMP}
              />
            </View>

            <View>
              <Text className={LABEL}>Motif de la demande *</Text>
              <TextInput
                value={motif}
                onChangeText={setMotif}
                multiline
                accessibilityLabel="Motif de la demande"
                placeholder="Ex : erreur sur le montant versé"
                placeholderTextColor="#94a3b8"
                className={`${CHAMP} min-h-[80px]`}
              />
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={desactive}
              className={`rounded-md py-3.5 mt-3 items-center ${
                desactive && !m.isPending ? 'bg-slate-200 dark:bg-slate-800' : 'bg-emerald-500 active:opacity-80'
              }`}
            >
              {m.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-bold text-base ${desactive ? 'text-slate-400' : 'text-white'}`}>
                  {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Envoyer la demande'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </FormScreen>
    </View>
  );
}
