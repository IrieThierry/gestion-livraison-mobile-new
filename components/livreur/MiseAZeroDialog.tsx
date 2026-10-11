import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { ProduitVignette } from '../shared/ProduitVignette';
import { useMettreAZeroStock } from '../../features/stock/hooks';
import {
  COMMENTAIRE_AJUSTEMENT_MAX,
  construireMiseAZero,
  messageMiseAZero,
  MOTIFS_AJUSTEMENT,
} from '../../features/stock/regles';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { extractApiErrorMessage } from '../../lib/api-error';
import { dialog } from '../../lib/dialog';
import type { MotifAjustementStock, ProduitResponse, UUID } from '../../types/api';

export interface CibleMiseAZero {
  livreurId: UUID;
  /** Nom du livreur affiché quand ce n'est pas le stock de l'utilisateur. */
  livreurNom?: string;
  produit: Pick<ProduitResponse, 'id' | 'designation'> & { photoUrl?: string | null; code?: string };
  quantite: number;
}

/**
 * Fenêtre « Mettre à zéro » (G9) : quantité actuelle, motif (sélection) et
 * commentaire, exigé pour « Autre ». Envoi protégé par `lancerUneFois` ; le
 * refus du back reste affiché dans la fenêtre. Après succès, le cache du
 * stock et de l'historique est invalidé par le hook.
 *
 * Monter avec `key` = produit + livreur pour repartir d'une saisie vide.
 */
export function MiseAZeroDialog({
  cible,
  onClose,
}: {
  cible: CibleMiseAZero | null;
  onClose: () => void;
}) {
  const mutation = useMettreAZeroStock();
  const verrou = useRef(creerVerrou()).current;
  const [motif, setMotif] = useState<MotifAjustementStock | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = () => {
    if (mutation.isPending) return;
    onClose();
  };

  const valider = () => {
    if (!cible) return;
    const r = construireMiseAZero({ quantite: cible.quantite, motif, commentaire });
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      mutation.mutate(
        { livreurId: cible.livreurId, produitId: cible.produit.id, payload: r.valeur },
        {
          onSuccess: (res) => {
            onClose();
            dialog.success(
              'Stock mis à zéro',
              messageMiseAZero(cible.produit.designation, res, cible.quantite),
            );
          },
          onError: (e) => setErreur(extractApiErrorMessage(e, 'Impossible de mettre le stock à zéro')),
          onSettled: fin,
        },
      ),
    );
  };

  const commentaireObligatoire = motif === 'AUTRE';

  return (
    <Modal visible={!!cible} transparent animationType="fade" onRequestClose={fermer} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <Pressable
            onPress={fermer}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityLabel="Fermer"
          />
          {cible ? (
            <View
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl self-center w-full"
              style={{ maxWidth: 420, maxHeight: '90%' }}
            >
              <ScrollView
                contentContainerStyle={{ padding: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <AlertTriangle color="#ef4444" size={20} />
                  <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Mettre à zéro
                  </Text>
                </View>

                <View className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <ProduitVignette
                    designation={cible.produit.designation}
                    photoUrl={cible.produit.photoUrl}
                    size={44}
                  />
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white" numberOfLines={2}>
                      {cible.produit.designation}
                    </Text>
                    {cible.livreurNom ? (
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                        Stock de {cible.livreurNom}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-extrabold text-red-600 dark:text-red-400">
                      {cible.quantite}
                    </Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                      unité{cible.quantite > 1 ? 's' : ''} retirée{cible.quantite > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-2">
                  Motif
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {MOTIFS_AJUSTEMENT.map((m) => {
                    const actif = motif === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          setMotif(m.id);
                          setErreur(null);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: actif }}
                        className={`px-3 py-2 rounded-full border active:opacity-70 ${
                          actif
                            ? 'bg-red-500 border-red-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Text
                          className={`text-[13px] font-bold ${
                            actif ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-2">
                  Commentaire{commentaireObligatoire ? ' (obligatoire)' : ' (optionnel)'}
                </Text>
                <TextInput
                  value={commentaire}
                  onChangeText={(v) => {
                    setCommentaire(v);
                    setErreur(null);
                  }}
                  multiline
                  maxLength={COMMENTAIRE_AJUSTEMENT_MAX}
                  placeholder={commentaireObligatoire ? 'Précisez le motif' : 'Ex. sac percé'}
                  placeholderTextColor="#94a3b8"
                  className="min-h-[72px] px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1">
                  {commentaire.length}/{COMMENTAIRE_AJUSTEMENT_MAX}
                </Text>

                {erreur ? (
                  <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold mt-2">
                    {erreur}
                  </Text>
                ) : null}

                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  Le stock du produit passera à 0. Le retrait est tracé dans les mouvements (Ajustement).
                </Text>

                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={fermer}
                    disabled={mutation.isPending}
                    className="flex-1 py-3 rounded-xl items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:opacity-80"
                  >
                    <Text className="font-extrabold text-[15px] text-slate-700 dark:text-slate-200">
                      Annuler
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={valider}
                    disabled={mutation.isPending}
                    className={`flex-1 py-3 rounded-xl items-center justify-center bg-red-500 active:opacity-80 ${
                      mutation.isPending ? 'opacity-60' : ''
                    }`}
                  >
                    {mutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="font-extrabold text-[15px] text-white">Mettre à zéro</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
