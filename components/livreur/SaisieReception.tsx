import { View, Text, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { DatePickerField } from '../shared/DatePickerField';
import type { Quantites } from '../../features/commandes/regles';
import { formatDateLong, formatFCFA } from '../../lib/format';
import type { ProduitCommandeResponse, ReceptionCommandeResponse } from '../../types/api';

/** Saisie en cours : nouvelle réception, ou modification d'une réception existante. */
export type Saisie =
  | { type: 'reception'; quantites: Quantites; date: string | null }
  | { type: 'modification'; receptionId: string; quantites: Quantites; date: string | null };

export const CARTE =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden';

export function CarteReception({
  reception: r,
  corrigeable,
  actif,
  onModifier,
  onAnnuler,
}: {
  reception: ReceptionCommandeResponse;
  corrigeable: boolean;
  actif: boolean;
  onModifier: () => void;
  onAnnuler: () => void;
}) {
  return (
    <View className={`${CARTE} p-3 ${r.annulee ? 'opacity-60' : ''}`}>
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
          {r.reference}
        </Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
          {formatDateLong(r.dateReception)}
        </Text>
      </View>
      <Text className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
        Reçu par {r.receptionnePar.nom}
      </Text>
      {r.lignes.map((l) => (
        <Text key={l.produit.id} className="text-[12px] text-slate-700 dark:text-slate-300 mt-1">
          {l.produit.designation} : {l.quantite} × {formatFCFA(l.prixUnitaire)} F
          {l.remiseLivreurUnitaire > 0
            ? ` · remise ${formatFCFA(l.remiseLivreurUnitaire)} F / unité`
            : ''}
        </Text>
      ))}
      {r.modifieePar ? (
        <Text className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
          Modifiée par {r.modifieePar.nom}
          {r.dateModification ? ` le ${formatDateLong(r.dateModification)}` : ''}
        </Text>
      ) : null}
      {r.annulee ? (
        <Text className="text-[11px] font-bold text-red-700 dark:text-red-400 mt-1">
          Annulée{r.annuleePar ? ` par ${r.annuleePar.nom}` : ''}
          {r.dateAnnulation ? ` le ${formatDateLong(r.dateAnnulation)}` : ''}
        </Text>
      ) : null}
      {corrigeable ? (
        <View className="flex-row gap-2 mt-3">
          <Pressable
            onPress={onModifier}
            disabled={!actif}
            className={`flex-1 rounded-md py-2 items-center border border-slate-300 dark:border-slate-700 ${
              actif ? 'active:opacity-70' : 'opacity-50'
            }`}
          >
            <Text className="text-slate-800 dark:text-slate-200 font-bold text-[12px]">Modifier</Text>
          </Pressable>
          <Pressable
            onPress={onAnnuler}
            disabled={!actif}
            className={`flex-1 rounded-md py-2 items-center border border-red-300 dark:border-red-500/40 ${
              actif ? 'active:opacity-70' : 'opacity-50'
            }`}
          >
            <Text className="text-red-700 dark:text-red-400 font-bold text-[12px]">Annuler</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function SaisieQuantites({
  titre,
  lignes,
  borne,
  saisie,
  onChange,
  onValider,
  onFermer,
  pending,
  actif,
}: {
  titre: string;
  lignes: ProduitCommandeResponse[];
  borne: (l: ProduitCommandeResponse) => number;
  saisie: Saisie;
  onChange: (s: Saisie) => void;
  onValider: () => void;
  onFermer: () => void;
  pending: boolean;
  actif: boolean;
}) {
  return (
    <View className={`${CARTE} p-3 mt-5 border-emerald-300 dark:border-emerald-500/40`}>
      <Text className="font-extrabold text-slate-900 dark:text-white text-[14px] mb-2">{titre}</Text>
      {lignes.length === 0 ? (
        <Text className="text-[12px] text-slate-500 dark:text-slate-400">Rien à réceptionner.</Text>
      ) : (
        <View className="gap-2">
          {lignes.map((l) => (
            <View key={l.id} className="flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-bold text-slate-900 dark:text-white text-[13px]">
                  {l.produit.designation}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Au plus {borne(l)}
                </Text>
              </View>
              <TextInput
                value={saisie.quantites[l.produit.id] ?? ''}
                onChangeText={(v) =>
                  onChange({ ...saisie, quantites: { ...saisie.quantites, [l.produit.id]: v } })
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                accessibilityLabel={`Quantité reçue de ${l.produit.designation}`}
                className="w-20 px-3 py-2 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white text-base"
              />
            </View>
          ))}
        </View>
      )}
      <View className="mt-3">
        <DatePickerField
          label="Date de réception"
          value={saisie.date}
          onChange={(d) => onChange({ ...saisie, date: d })}
          maximumDate={new Date()}
        />
      </View>
      <View className="flex-row gap-2 mt-4">
        <Pressable
          onPress={onFermer}
          disabled={pending}
          className="flex-1 rounded-md py-3 items-center border border-slate-300 dark:border-slate-700 active:opacity-70"
        >
          <Text className="text-slate-700 dark:text-slate-300 font-bold">Fermer</Text>
        </Pressable>
        <Pressable
          onPress={onValider}
          disabled={!actif || lignes.length === 0}
          className={`flex-1 rounded-md py-3 items-center ${
            actif && lignes.length > 0 ? 'bg-emerald-500 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
          }`}
        >
          {pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`font-bold ${actif && lignes.length > 0 ? 'text-white' : 'text-slate-400'}`}
            >
              Enregistrer
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
