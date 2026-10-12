import {
  Banknote,
  CalendarClock,
  Coins,
  ClipboardCheck,
  Package,
  Receipt,
  RotateCcw,
  Truck,
  Users,
  Wallet,
} from 'lucide-react-native';

/**
 * Entrées du menu « Accéder à » (bouton + de la barre d'onglets) : les dix
 * listes du livreur, dans l'ordre affiché. Les droits suivent ceux des
 * écrans : un apprenti ne voit pas « Mes versements » (réservé au livreur
 * principal) et ses « Commandes » sont celles à réceptionner ; les
 * Reversements restent ouverts à tous, comme dans le menu Moi.
 */
export interface EntreeAccederA {
  cle: string;
  label: string;
  hint: string;
  chemin: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  iconBg: string;
  iconColor: string;
}

export function entreesAccederA(user: { parentId?: string | null } | null | undefined): EntreeAccederA[] {
  const apprenti = !!user?.parentId;
  const entrees: Array<EntreeAccederA | null> = [
    {
      cle: 'livraisons',
      label: 'Mes livraisons',
      hint: 'Livraisons du jour et historique',
      chemin: '/(livreur)/livraisons',
      icon: Truck,
      iconBg: '#d1fae5',
      iconColor: '#059669',
    },
    {
      cle: 'clients',
      label: 'Mes clients',
      hint: 'Liste, carte et fiches clients',
      chemin: '/(livreur)/clients',
      icon: Users,
      iconBg: '#d1fae5',
      iconColor: '#059669',
    },
    {
      cle: 'encaissements',
      label: 'Mes encaissements',
      hint: 'Encaissements clients, recherche et total',
      chemin: '/(livreur)/cash/encaissements',
      icon: Banknote,
      iconBg: '#d1fae5',
      iconColor: '#059669',
    },
    apprenti
      ? null
      : {
          cle: 'versements',
          label: 'Mes versements',
          hint: 'Versements aux fournisseurs',
          chemin: '/(livreur)/cash/versements',
          icon: Wallet,
          iconBg: '#fef3c7',
          iconColor: '#b45309',
        },
    {
      cle: 'commandes',
      label: 'Commandes',
      hint: apprenti ? 'Commandes à réceptionner' : 'Commandes auprès des fournisseurs',
      chemin: apprenti ? '/(livreur)/cash/commandes/a-receptionner' : '/(livreur)/cash/commandes',
      icon: Package,
      iconBg: '#dbeafe',
      iconColor: '#1d4ed8',
    },
    {
      cle: 'retours',
      label: 'Retours produits',
      hint: 'Retours produits par client',
      chemin: '/(livreur)/cash/retours',
      icon: RotateCcw,
      iconBg: '#fce7f3',
      iconColor: '#be185d',
    },
    {
      cle: 'reversements',
      label: 'Reversements',
      hint: 'Remise due aux clients, remise des fournisseurs',
      chemin: '/(livreur)/cash/reversements',
      icon: Coins,
      iconBg: '#ede9fe',
      iconColor: '#7c3aed',
    },
    {
      cle: 'depenses',
      label: 'Dépenses',
      hint: 'Carburant, entretien, autre',
      chemin: '/(livreur)/cash/depenses',
      icon: Receipt,
      iconBg: '#fee2e2',
      iconColor: '#dc2626',
    },
    {
      cle: 'previsions',
      label: 'Prévisions',
      hint: 'Prévisions multi-produits par client',
      chemin: '/(livreur)/previsions',
      icon: CalendarClock,
      iconBg: '#dbeafe',
      iconColor: '#3b82f6',
    },
    {
      cle: 'clotures',
      label: 'Clôtures',
      hint: 'Clôtures journalières et écarts de caisse',
      chemin: '/(livreur)/clotures',
      icon: ClipboardCheck,
      iconBg: '#fef3c7',
      iconColor: '#d97706',
    },
  ];
  return entrees.filter((e): e is EntreeAccederA => e !== null);
}
