import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FiltrePeriode } from '../../components/shared/FiltrePeriode';
import { derniersJours, libelleIntervalle, moisEnCours, type ValeurPeriode } from '../../lib/periode';

const OPTIONS = [
  { cle: 'mois' as const, label: 'Ce mois', bornes: moisEnCours },
  { cle: '30j' as const, label: '30 jours', bornes: (n: Date) => derniersJours(30, n) },
];
type Cle = 'mois' | '30j';

function Ecran({ onChange }: { onChange: (v: ValeurPeriode<Cle>) => void }) {
  const [valeur, setValeur] = useState<ValeurPeriode<Cle>>({ cle: 'mois' });
  return (
    <FiltrePeriode
      options={OPTIONS}
      valeur={valeur}
      defaut="mois"
      onChange={(v) => {
        onChange(v);
        setValeur(v);
      }}
    />
  );
}

describe('FiltrePeriode', () => {
  it('raccourcis + « Période… » (plus de « Tout »)', () => {
    const onChange = jest.fn();
    render(<Ecran onChange={onChange} />);
    expect(screen.getByText('Ce mois')).toBeTruthy();
    expect(screen.getByText('Période…')).toBeTruthy();
    expect(screen.queryByText('Tout')).toBeNull();
    fireEvent.press(screen.getByText('30 jours'));
    expect(onChange).toHaveBeenLastCalledWith({ cle: '30j' });
  });

  it('Période… ouvre Du / Au, Appliquer affiche l’intervalle, la croix revient au défaut', () => {
    const onChange = jest.fn();
    render(<Ecran onChange={onChange} />);
    fireEvent.press(screen.getByText('Période…'));
    expect(screen.getByText('Choisir la période')).toBeTruthy();
    // Valeurs initiales : les bornes du raccourci courant (mois en cours).
    const { debut, fin } = moisEnCours();
    expect(screen.getByLabelText(`Du ${debut.split('-').reverse().join('/')}`)).toBeTruthy();
    expect(screen.getByLabelText(`Au ${fin.split('-').reverse().join('/')}`)).toBeTruthy();

    fireEvent.press(screen.getByText('Appliquer'));
    expect(onChange).toHaveBeenLastCalledWith({ du: debut, au: fin });
    expect(screen.queryByText('Choisir la période')).toBeNull();
    expect(screen.getByText(libelleIntervalle(debut, fin))).toBeTruthy();
    expect(screen.queryByText('Période…')).toBeNull();

    // Un appui sur la pastille la modifie ; Annuler ne change rien.
    fireEvent.press(screen.getByLabelText(`Période ${libelleIntervalle(debut, fin)}, modifier`));
    expect(screen.getByText('Choisir la période')).toBeTruthy();
    fireEvent.press(screen.getByText('Annuler'));
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText('Effacer la période'));
    expect(onChange).toHaveBeenLastCalledWith({ cle: 'mois' });
    expect(screen.getByText('Période…')).toBeTruthy();
  });
});
