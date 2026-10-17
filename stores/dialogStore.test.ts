import { dialog } from '../lib/dialog';
import { useDialogStore } from './dialogStore';

describe('dialogStore.show', () => {
  it('success puis confirm : le second n a pas d autoDismissMs', () => {
    dialog.success('Fait');
    expect(useDialogStore.getState().autoDismissMs).toBe(1800);
    dialog.confirm({ title: 'Sûr ?', onConfirm: jest.fn() });
    const s = useDialogStore.getState();
    expect(s.autoDismissMs).toBeUndefined();
    expect(s.open).toBe(true);
    expect(s.title).toBe('Sûr ?');
  });

  it('les actions et le message ne fuient pas non plus', () => {
    dialog.warning('A', 'message', { actions: [{ label: 'X' }] });
    dialog.success('B');
    const s = useDialogStore.getState();
    expect(s.message).toBeUndefined();
    expect(s.actions).toBeUndefined();
  });
});
