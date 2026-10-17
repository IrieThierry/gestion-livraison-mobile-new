import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Plus, Send, X } from 'lucide-react-native';
import { ProduitVignette } from '../shared/ProduitVignette';
import {
  dateHeure,
  libelleStatutRemise,
  lireQuantite,
  nomPersonne,
  produitsAAjouter,
  remiseAnnulable,
} from '../../features/commis/regles';
import type {
  CatalogueCommisResponse,
  LigneCommandeCommisResponse,
  RemiseCommisResponse,
  StatutRemiseCommis,
  UUID,
} from '../../types/api';

/**
 * Éléments communs de l'espace commis : quantités d'une ligne de commande
 * (commandé / remis confirmé / en attente), saisie des produits d'une remise
 * ou d'une sortie, carte d'une remise. Quantités seulement, jamais de prix.
 */

export const CARTE_COMMIS = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';
export const SECTION_COMMIS = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';

/** Libellé lu d'une ligne : « Riz : commandé 10, remis 4, en attente 6 ». */
export const libelleQuantites = (l: LigneCommandeCommisResponse) =>
  `${l.designation} : commandé ${l.commande}, remis ${l.remisConfirme}, en attente ${l.enAttente}`;

/** Tableau des produits d'une commande : colonnes Commandé, Remis (confirmé), En attente. */
export function TableauQuantites({ lignes }: { lignes: readonly LigneCommandeCommisResponse[] }) {
  return (
    <View>
      <View className="flex-row items-center pb-1 border-b border-slate-100 dark:border-slate-800">
        <Text className="flex-1 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">Produit</Text>
        <Text className="w-16 text-right text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">Commandé</Text>
        <Text className="w-14 text-right text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">Remis</Text>
        <Text className="w-16 text-right text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">Attente</Text>
      </View>
      {lignes.map((l) => (
        <View key={l.produitFournisseurId} accessible accessibilityLabel={libelleQuantites(l)} className="flex-row items-center py-1">
          <Text className="flex-1 text-[12px] text-slate-800 dark:text-slate-100" numberOfLines={2}>
            {l.designation}
          </Text>
          <Text className="w-16 text-right text-[12px] font-bold text-slate-900 dark:text-white">{l.commande}</Text>
          <Text className="w-14 text-right text-[12px] font-bold text-emerald-700 dark:text-emerald-400">{l.remisConfirme}</Text>
          <Text className={`w-16 text-right text-[12px] font-bold ${l.enAttente > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {l.enAttente}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Saisie des quantités par produit : les lignes de la commande (avec leurs
 * quantités) puis les produits ajoutés depuis le catalogue (« Ajouter un
 * produit »). Une quantité vide ou 0 est ignorée à l'envoi ; elle peut
 * dépasser le commandé.
 */
export function SaisieProduits({
  lignesCommande = [],
  catalogue,
  ajoutes,
  onAjoutes,
  quantites,
  onQuantites,
}: {
  lignesCommande?: readonly LigneCommandeCommisResponse[];
  catalogue: readonly CatalogueCommisResponse[];
  ajoutes: readonly UUID[];
  onAjoutes: (ids: UUID[]) => void;
  quantites: Readonly<Record<UUID, string>>;
  onQuantites: (q: Record<UUID, string>) => void;
}) {
  const [choix, setChoix] = useState(false);
  const avecCommande = lignesCommande.length > 0;
  const parId = new Map(catalogue.map((p) => [p.produitFournisseurId, p]));
  const disponibles = produitsAAjouter(catalogue, [...lignesCommande.map((l) => l.produitFournisseurId), ...ajoutes]);
  const saisir = (id: UUID, v: string) => onQuantites({ ...quantites, [id]: v });

  return (
    <View className="gap-2">
      {lignesCommande.map((l) => (
        <LigneSaisie
          key={l.produitFournisseurId}
          designation={l.designation}
          photoUrl={l.photoUrl}
          detail={
            <Text accessibilityLabel={libelleQuantites(l)} className="text-[11px] text-slate-500 dark:text-slate-400">
              {`Commandé ${l.commande} · Remis ${l.remisConfirme} · En attente ${l.enAttente}`}
            </Text>
          }
          valeur={quantites[l.produitFournisseurId] ?? ''}
          onChange={(v) => saisir(l.produitFournisseurId, v)}
        />
      ))}
      {ajoutes.map((id) => {
        const p = parId.get(id);
        return (
          <LigneSaisie
            key={id}
            designation={p?.designation ?? 'Produit'}
            photoUrl={p?.photoUrl ?? null}
            detail={avecCommande ? <Text className="text-[11px] text-sky-700 dark:text-sky-400">Hors commande</Text> : null}
            valeur={quantites[id] ?? ''}
            onChange={(v) => saisir(id, v)}
            onRetirer={() => {
              const { [id]: _retire, ...reste } = quantites;
              onQuantites(reste);
              onAjoutes(ajoutes.filter((a) => a !== id));
            }}
          />
        );
      })}

      <Pressable
        onPress={() => setChoix((c) => !c)}
        accessibilityRole="button"
        accessibilityLabel="Ajouter un produit"
        className="flex-row items-center gap-2 self-start py-2 active:opacity-70"
      >
        <Plus color="#047857" size={16} />
        <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Ajouter un produit</Text>
      </Pressable>
      {choix ? (
        <View className={`${CARTE_COMMIS} p-2 gap-1`}>
          {disponibles.length === 0 ? (
            <Text className="text-[12px] italic text-slate-500 dark:text-slate-400 p-2">
              Tous les produits du catalogue sont déjà dans la saisie.
            </Text>
          ) : (
            disponibles.map((p) => (
              <Pressable
                key={p.produitFournisseurId}
                onPress={() => {
                  onAjoutes([...ajoutes, p.produitFournisseurId]);
                  setChoix(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${p.designation}`}
                className="flex-row items-center gap-3 p-2 rounded-md active:opacity-70"
              >
                <ProduitVignette designation={p.designation} photoUrl={p.photoUrl} size={32} />
                <Text className="flex-1 text-[13px] text-slate-900 dark:text-white">{p.designation}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function LigneSaisie({
  designation,
  photoUrl,
  detail,
  valeur,
  onChange,
  onRetirer,
}: {
  designation: string;
  photoUrl: string | null;
  detail: ReactNode;
  valeur: string;
  onChange: (v: string) => void;
  onRetirer?: () => void;
}) {
  const invalide = lireQuantite(valeur) === null;
  return (
    <View className={`${CARTE_COMMIS} p-3`}>
      <View className="flex-row items-center gap-3">
        <ProduitVignette designation={designation} photoUrl={photoUrl} size={36} />
        <View className="flex-1">
          <Text className="font-bold text-slate-900 dark:text-white text-[13px]">{designation}</Text>
          {detail}
        </View>
        <TextInput
          value={valeur}
          onChangeText={onChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
          accessibilityLabel={`Quantité ${designation}`}
          className={`w-20 text-right rounded-md border px-2 py-2 text-base text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 ${
            invalide ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
          }`}
        />
        {onRetirer ? (
          <Pressable onPress={onRetirer} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${designation}`}>
            <X color="#94a3b8" size={16} />
          </Pressable>
        ) : null}
      </View>
      {invalide ? <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">Saisis un nombre entier.</Text> : null}
    </View>
  );
}

const FOND_STATUT: Record<StatutRemiseCommis, string> = {
  EN_ATTENTE: 'bg-amber-100 dark:bg-amber-900/40',
  CONFIRMEE: 'bg-emerald-100 dark:bg-emerald-900/40',
  REFUSEE: 'bg-red-100 dark:bg-red-900/40',
  ANNULEE: 'bg-slate-100 dark:bg-slate-800',
};

const TEXTE_STATUT: Record<StatutRemiseCommis, string> = {
  EN_ATTENTE: 'text-amber-800 dark:text-amber-300',
  CONFIRMEE: 'text-emerald-800 dark:text-emerald-300',
  REFUSEE: 'text-red-700 dark:text-red-300',
  ANNULEE: 'text-slate-500 dark:text-slate-400',
};

/** Carte d'une remise : date et heure, commis, statut, produits, motif d'un refus ; Annuler tant qu'elle est en attente. */
export function CarteRemise({
  remise,
  avecLivreur = false,
  onAnnuler,
  annulationActive = true,
}: {
  remise: RemiseCommisResponse;
  avecLivreur?: boolean;
  onAnnuler?: (r: RemiseCommisResponse) => void;
  annulationActive?: boolean;
}) {
  const quand = dateHeure(remise.creeLe);
  return (
    <View className={`${CARTE_COMMIS} p-3`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{quand}</Text>
        <View className={`px-2 py-0.5 rounded-full ${FOND_STATUT[remise.statut] ?? ''}`}>
          <Text className={`text-[10px] font-bold ${TEXTE_STATUT[remise.statut] ?? ''}`}>{libelleStatutRemise(remise.statut)}</Text>
        </View>
      </View>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
        {avecLivreur
          ? `${nomPersonne(remise.commis)} → ${nomPersonne(remise.livreur)} · ${remise.commandeNumero}`
          : `Remise par ${nomPersonne(remise.commis)}`}
      </Text>
      {remise.lignes.map((l) => (
        <Text
          key={l.produitFournisseurId}
          className={`text-[12px] mt-0.5 ${remise.statut === 'ANNULEE' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}
        >
          {`${l.quantite} × ${l.designation}`}
        </Text>
      ))}
      {remise.statut === 'REFUSEE' && remise.motif ? (
        <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{`Motif : ${remise.motif}`}</Text>
      ) : null}
      {onAnnuler && remiseAnnulable(remise) ? (
        <Pressable
          onPress={() => onAnnuler(remise)}
          disabled={!annulationActive}
          accessibilityRole="button"
          accessibilityLabel={`Annuler la remise du ${quand}`}
          className="self-start mt-2 active:opacity-70"
        >
          <Text className={`text-[12px] font-bold ${annulationActive ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>Annuler</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Bouton d'envoi d'une saisie (remise, sortie) : grisé et inactif tant que rien n'est envoyable. */
export function BoutonEnvoyer({
  label,
  actif,
  enCours,
  onPress,
}: {
  label: string;
  actif: boolean;
  enCours: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !actif }}
      className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-300 dark:bg-slate-800'}`}
    >
      {enCours ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Send color="#fff" size={16} />
          <Text className="text-white font-bold text-base">{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Choix d'un élément (livreur, client) parmi des pastilles : « Choisir <nom> ». */
export function ChoixParmi({
  options,
  valeur,
  onChange,
}: {
  options: ReadonlyArray<{ id: UUID; label: string }>;
  valeur: UUID | null;
  onChange: (id: UUID) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const choisi = o.id === valeur;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityLabel={`Choisir ${o.label}`}
            accessibilityState={{ selected: choisi }}
            className={`px-3 py-2 rounded-md border active:opacity-70 ${
              choisi ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Text className={`text-[13px] font-bold ${choisi ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
