import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { SearchInput } from '../../../../components/shared/SearchInput';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import { useProduits } from '../../../../features/produits/hooks';
import { useCreerDemandeChargement } from '../../../../features/organisation/hooks';
import {
  erreurDemandeChargement,
  payloadDemandeChargement,
  type LigneDemandeSaisie,
} from '../../../../features/organisation/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../../../lib/recherche';
import { useRetourListe } from '../../../../lib/useRetourListe';

/**
 * « Nouvelle demande de chargement » (O8) : le commercial choisit des
 * produits du catalogue de son organisation et les quantités voulues. Le
 * responsable la sert (transferts à accepter) ou la refuse ; aucun stock ne
 * bouge à la création.
 */
export default function NouvelleDemandeChargement() {
  const { data: catalogue = [], isLoading, isError } = useProduits();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const m = useCreerDemandeChargement();
  const retourListe = useRetourListe('/(livreur)/stock/demandes');
  const verrou = useRef(creerVerrou()).current;
  const [recherche, setRecherche] = useState('');
  const [lignes, setLignes] = useState<LigneDemandeSaisie[]>([]);

  const proposes = useMemo(
    () => filtrerRecherche(catalogue, recherche, (p) => [p.designation, p.code]),
    [catalogue, recherche],
  );
  const total = lignes.reduce((acc, l) => acc + (l.qte > 0 ? l.qte : 0), 0);

  const ajouter = (produitId: string, designation: string) =>
    setLignes((ls) => (ls.some((l) => l.produitId === produitId) ? ls : [...ls, { produitId, designation, qte: 1 }]));
  const changerQte = (produitId: string, brut: string) => {
    const qte = parseInt(brut.replace(/[^0-9]/g, ''), 10) || 0;
    setLignes((ls) => ls.map((l) => (l.produitId === produitId ? { ...l, qte } : l)));
  };
  const retirer = (produitId: string) => setLignes((ls) => ls.filter((l) => l.produitId !== produitId));

  const onSubmit = () => {
    if (verrou.enCours) return;
    const erreur = erreurDemandeChargement(lignes);
    if (erreur) {
      dialog.warning('Demande incomplète', erreur);
      return;
    }
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Reconnecte-toi pour envoyer la demande.');
      return;
    }
    const payload = payloadDemandeChargement(lignes);
    lancerUneFois(verrou, (fin) =>
      m.mutate(payload, {
        onSuccess: (d) => {
          setLignes([]);
          retourListe();
          dialog.success(`Demande ${d.reference} envoyée`, 'Ton responsable va la servir ou la refuser.');
        },
        onError: (err) =>
          dialog.error('Demande non envoyée', extractApiErrorMessage(err, 'Échec de l’envoi de la demande')),
        onSettled: fin,
      }),
    );
  };

  const bloque = m.isPending || !isOnline || total === 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle demande" subtitle="Chargement depuis le dépôt" />
      <FormScreen>
        <View className="px-4">
          <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Catalogue
          </Text>
          {catalogue.length > 0 ? (
            <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Rechercher un produit…" className="mb-2" />
          ) : null}
          {isLoading ? <ActivityIndicator color="#10b981" /> : null}
          {isError ? (
            <Text className="text-[12px] text-red-500">Le catalogue n’a pas pu être lu.</Text>
          ) : !isLoading && catalogue.length === 0 ? (
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">
              Aucun produit dans le catalogue de ton organisation.
            </Text>
          ) : null}
          {proposes.length === 0 && recherche.trim() ? (
            <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-2">{AUCUN_RESULTAT}</Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {proposes.map((p) => {
              const deja = lignes.some((l) => l.produitId === p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => ajouter(p.id, p.designation)}
                  disabled={deja}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${p.designation}`}
                  className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-md flex-row items-center gap-1.5 active:opacity-70 ${
                    deja ? 'border-emerald-300 dark:border-emerald-800 opacity-50' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <ProduitVignette designation={p.designation} photoUrl={p.photoUrl} size={22} />
                  <Plus color={deja ? '#94a3b8' : '#10b981'} size={14} />
                  <Text className="text-sm text-slate-900 dark:text-white">{p.designation}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Produits demandés ({lignes.length})
          </Text>
          <View className="gap-2">
            {lignes.map((l) => (
              <View
                key={l.produitId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2"
              >
                <Text className="font-extrabold text-slate-900 dark:text-white flex-1">{l.designation}</Text>
                <TextInput
                  value={l.qte > 0 ? String(l.qte) : ''}
                  onChangeText={(v) => changerQte(l.produitId, v)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  accessibilityLabel={`Quantité ${l.designation}`}
                  className="w-20 px-2 py-2 rounded text-center text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <Pressable onPress={() => retirer(l.produitId)} hitSlop={10} accessibilityLabel={`Retirer ${l.designation}`}>
                  <Trash2 color="#ef4444" size={18} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={bloque}
            accessibilityRole="button"
            className={`rounded-md py-3.5 mt-5 items-center ${
              bloque ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${bloque ? 'text-slate-500' : 'text-white'}`}>
                {!isOnline ? 'Hors ligne — réessaye en ligne' : `Envoyer la demande${total > 0 ? ` (${total})` : ''}`}
              </Text>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
