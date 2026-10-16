import { Pressable, Text, View } from 'react-native';
import { ChevronRight, FilePen, MailOpen, Package } from 'lucide-react-native';
import {
  useCommandesFournisseur,
  useCompteInvitations,
  useDemandesModifFournisseurEnAttente,
} from '../../features/fournisseur/hooks';
import {
  estAConfirmer,
  nbDemandesADecider,
  tachesFournisseur,
  type CodeTacheFournisseur,
  type TacheFournisseur,
} from '../../features/fournisseur/regles';

/**
 * F2 : rubriques « À traiter » du fournisseur (Accueil et Notifications) :
 * commandes à confirmer, invitations de livreurs, demandes de modification
 * de versement à décider. Une rubrique dont la lecture échoue est signalée.
 */
export function useATraiterFournisseur() {
  const commandesQ = useCommandesFournisseur();
  const invitationsQ = useCompteInvitations();
  const demandesQ = useDemandesModifFournisseurEnAttente();
  const taches = tachesFournisseur({
    commandes: (commandesQ.data ?? []).filter(estAConfirmer).length,
    invitations: invitationsQ.data ?? 0,
    demandes: nbDemandesADecider(demandesQ.data),
  });
  const erreurs: string[] = [
    commandesQ.isError ? 'Commandes à confirmer indisponibles' : null,
    invitationsQ.isError ? 'Invitations indisponibles' : null,
    demandesQ.isError ? 'Demandes de modification indisponibles' : null,
  ].filter((e): e is string => !!e);
  return {
    taches,
    erreurs,
    /** Nombre total d'actions à traiter (pastille de la cloche). */
    total: taches.reduce((s, t) => s + t.nombre, 0),
    enChargement: commandesQ.isLoading || invitationsQ.isLoading || demandesQ.isLoading,
    relire: () => {
      commandesQ.refetch();
      invitationsQ.refetch();
      demandesQ.refetch();
    },
  };
}

const ICONES: Record<CodeTacheFournisseur, { Icone: typeof Package; couleur: string }> = {
  CMD: { Icone: Package, couleur: '#ea580c' },
  INV: { Icone: MailOpen, couleur: '#db2777' },
  VER: { Icone: FilePen, couleur: '#7c3aed' },
};

/** Lignes « À traiter » (une par rubrique non vide) et erreurs de lecture. */
export function ListeATraiter({
  taches,
  erreurs,
  onOuvrir,
}: {
  taches: readonly TacheFournisseur[];
  erreurs: readonly string[];
  onOuvrir: (t: TacheFournisseur) => void;
}) {
  return (
    <View className="gap-2">
      {taches.map((t) => {
        const { Icone, couleur } = ICONES[t.code];
        return (
          <Pressable
            key={t.code}
            onPress={() => onOuvrir(t)}
            accessibilityRole="button"
            accessibilityLabel={t.titre}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex-row items-center gap-3 active:opacity-70"
          >
            <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: couleur }}>
              <Icone color="#ffffff" size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">{t.titre}</Text>
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{t.detail}</Text>
            </View>
            <ChevronRight color="#94a3b8" size={18} />
          </Pressable>
        );
      })}
      {erreurs.map((e) => (
        <Text key={e} className="text-[12px] text-red-600 dark:text-red-400">
          {e}
        </Text>
      ))}
    </View>
  );
}
