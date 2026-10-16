import { dialog } from './dialog';
import { useDialogStore } from '../stores/dialogStore';

describe('dialog.choix', () => {
  beforeEach(() => useDialogStore.getState().hide());

  it('un bouton par option puis Annuler', () => {
    dialog.choix({ title: 'T', options: [{ label: 'A', onPress: jest.fn() }, { label: 'B', onPress: jest.fn() }] });
    expect(useDialogStore.getState().actions?.map((a) => a.label)).toEqual(['A', 'B', 'Annuler']);
  });

  it('choisir une option appelle son gestionnaire seulement', () => {
    const a = jest.fn();
    const b = jest.fn();
    dialog.choix({ title: 'T', options: [{ label: 'A', onPress: a }, { label: 'B', onPress: b }] });
    useDialogStore.getState().actions?.[1].onPress?.();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it('Annuler n appelle aucun gestionnaire', () => {
    const a = jest.fn();
    dialog.choix({ title: 'T', options: [{ label: 'A', onPress: a }] });
    useDialogStore.getState().actions?.[1].onPress?.();
    expect(a).not.toHaveBeenCalled();
  });
});
