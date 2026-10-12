import {
  Banknote,
  CalendarClock,
  Package,
  RotateCcw,
  Truck,
  Users,
  Wallet,
} from 'lucide-react-native';

/**
 * Entrées du menu « Accéder à » (bouton + de la barre d'onglets) : les sept
 * listes du quotidien, dans l'ordre affiché. Les droits suivent ceux des
 * écrans : un apprenti ne voit pas « Mes versements » (réservé au livreur
 * principal) et ses « Commandes » sont celles à réceptionner. Dépenses,
 * Reversements et Clôtures s'ouvrent depuis l'onglet Moi.
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
      cle: 'previsions',
      label: 'Prévisions',
      hint: 'Prévisions multi-produits par client',
      chemin: '/(livreur)/previsions',
      icon: CalendarClock,
      iconBg: '#dbeafe',
      iconColor: '#3b82f6',
    },
  ];
  return entrees.filter((e): e is EntreeAccederA => e !== null);
}
