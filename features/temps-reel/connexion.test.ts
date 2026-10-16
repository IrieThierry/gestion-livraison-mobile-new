import { DELAIS_RECONNEXION_MS, ouvrirConnexion, urlWebSocket, useTempsReelStore } from './connexion';

class FauxWebSocket {
  static instances: FauxWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e?: { code: number }) => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(public url: string) {
    FauxWebSocket.instances.push(this);
  }
  send(m: string) {
    this.sent.push(m);
  }
  close() {
    this.closed = true;
  }
  ouvrir() {
    this.onopen?.();
  }
  recevoir(o: unknown) {
    this.onmessage?.({ data: JSON.stringify(o) });
  }
  tomber(code = 1006) {
    this.onclose?.({ code });
  }
}

const dernier = () => FauxWebSocket.instances[FauxWebSocket.instances.length - 1];
const vider = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function demarrer(token: string | null = 'jwt') {
  const onNotification = jest.fn();
  const lireToken = jest.fn(async () => token);
  const c = ouvrirConnexion({ apiBase: 'https://api.test', lireToken, onNotification });
  return { c, onNotification, lireToken };
}

beforeEach(() => {
  jest.useFakeTimers();
  FauxWebSocket.instances = [];
  (global as unknown as { WebSocket: unknown }).WebSocket = FauxWebSocket;
  useTempsReelStore.setState({ connecte: false });
});
afterEach(() => jest.useRealTimers());

describe('urlWebSocket', () => {
  it('http -> ws, https -> wss, ajoute /ws', () => {
    expect(urlWebSocket('http://10.0.0.1:8089')).toBe('ws://10.0.0.1:8089/ws');
    expect(urlWebSocket('https://api.exemple.ci/')).toBe('wss://api.exemple.ci/ws');
  });
});

describe('ouvrirConnexion', () => {
  it('envoie auth au open (jeton hors URL) puis passe connecte après pret', async () => {
    demarrer();
    await vider();
    const ws = dernier();
    expect(ws.url).toBe('wss://api.test/ws');
    ws.ouvrir();
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', token: 'jwt' });
    expect(useTempsReelStore.getState().connecte).toBe(false);
    ws.recevoir({ type: 'pret' });
    expect(useTempsReelStore.getState().connecte).toBe(true);
  });

  it('transmet les notifications et ignore le JSON invalide', async () => {
    const { onNotification } = demarrer();
    await vider();
    const ws = dernier();
    ws.ouvrir();
    ws.onmessage?.({ data: 'pas du json' });
    ws.recevoir({ type: 'notification', id: 'n1', notificationType: 'LOCALISATION_PARTAGEE' });
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onNotification.mock.calls[0][0].id).toBe('n1');
  });

  it('reconnecte avec les délais croissants, le dernier se répétant, remis à zéro après pret', async () => {
    demarrer();
    await vider();
    for (let i = 0; i < DELAIS_RECONNEXION_MS.length + 1; i++) {
      const attendu = DELAIS_RECONNEXION_MS[Math.min(i, DELAIS_RECONNEXION_MS.length - 1)];
      const n = FauxWebSocket.instances.length;
      dernier().tomber();
      jest.advanceTimersByTime(attendu - 1);
      await vider();
      expect(FauxWebSocket.instances.length).toBe(n);
      jest.advanceTimersByTime(1);
      await vider();
      expect(FauxWebSocket.instances.length).toBe(n + 1);
    }
    dernier().ouvrir();
    dernier().recevoir({ type: 'pret' });
    dernier().tomber();
    expect(useTempsReelStore.getState().connecte).toBe(false);
    const n = FauxWebSocket.instances.length;
    jest.advanceTimersByTime(DELAIS_RECONNEXION_MS[0]);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(n + 1);
  });

  it('1008 (jeton refusé) reprogramme aussi avec attente', async () => {
    demarrer();
    await vider();
    dernier().tomber(1008);
    expect(FauxWebSocket.instances.length).toBe(1);
    jest.advanceTimersByTime(DELAIS_RECONNEXION_MS[0]);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(2);
  });

  it('relit le jeton à chaque connexion', async () => {
    const { lireToken } = demarrer();
    await vider();
    dernier().tomber();
    jest.advanceTimersByTime(DELAIS_RECONNEXION_MS[0]);
    await vider();
    expect(lireToken).toHaveBeenCalledTimes(2);
  });

  it('sans jeton : pas de socket, nouvelle tentative plus tard', async () => {
    const { lireToken } = demarrer(null);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(0);
    jest.advanceTimersByTime(DELAIS_RECONNEXION_MS[0]);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(0);
    expect(lireToken).toHaveBeenCalledTimes(2);
  });

  it('fermer() : close, plus de reconnexion, connecte=false, onclose neutralisé', async () => {
    const { c } = demarrer();
    await vider();
    const ws = dernier();
    ws.ouvrir();
    ws.recevoir({ type: 'pret' });
    c.fermer();
    expect(ws.closed).toBe(true);
    expect(ws.onclose).toBeNull();
    expect(useTempsReelStore.getState().connecte).toBe(false);
    jest.advanceTimersByTime(60000);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(1);
  });

  it('fermer() pendant la lecture du jeton : aucun socket', async () => {
    const { c } = demarrer();
    c.fermer();
    await vider();
    expect(FauxWebSocket.instances.length).toBe(0);
  });

  it('fermer() annule une reconnexion programmée', async () => {
    const { c } = demarrer();
    await vider();
    dernier().tomber();
    c.fermer();
    jest.advanceTimersByTime(60000);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(1);
  });

  it('un ancien socket tardif n agit plus', async () => {
    const { c, onNotification } = demarrer();
    await vider();
    const ancien = dernier();
    c.mettreEnPause();
    c.reprendre();
    await vider();
    expect(FauxWebSocket.instances.length).toBe(2);
    ancien.recevoir({ type: 'pret' });
    ancien.recevoir({ type: 'notification', id: 'x', notificationType: 'A' });
    ancien.tomber();
    expect(useTempsReelStore.getState().connecte).toBe(false);
    expect(onNotification).not.toHaveBeenCalled();
  });

  describe('AppState (pause / reprise)', () => {
    it('mettreEnPause : close sans reconnexion programmée, connecte=false', async () => {
      const { c } = demarrer();
      await vider();
      const ws = dernier();
      ws.ouvrir();
      ws.recevoir({ type: 'pret' });
      c.mettreEnPause();
      expect(ws.closed).toBe(true);
      expect(useTempsReelStore.getState().connecte).toBe(false);
      jest.advanceTimersByTime(60000);
      await vider();
      expect(FauxWebSocket.instances.length).toBe(1);
    });

    it('mettreEnPause annule aussi une reconnexion déjà programmée', async () => {
      const { c } = demarrer();
      await vider();
      dernier().tomber();
      c.mettreEnPause();
      jest.advanceTimersByTime(60000);
      await vider();
      expect(FauxWebSocket.instances.length).toBe(1);
    });

    it('reprendre : nouvelle connexion immédiate, délais remis à zéro', async () => {
      const { c } = demarrer();
      await vider();
      dernier().tomber();
      jest.advanceTimersByTime(DELAIS_RECONNEXION_MS[0]);
      await vider();
      dernier().tomber(); // index avancé
      c.mettreEnPause();
      c.reprendre();
      await vider();
      expect(FauxWebSocket.instances.length).toBe(3);
      dernier().tomber();
      jest.advanceTimersByTime(DELAIS_RECONNEXION_MS[0]);
      await vider();
      expect(FauxWebSocket.instances.length).toBe(4);
    });

    it('reprendre sans pause préalable ne double pas la connexion', async () => {
      const { c } = demarrer();
      await vider();
      c.reprendre();
      await vider();
      expect(FauxWebSocket.instances.length).toBe(1);
    });

    it('reprendre après fermer() ne fait rien', async () => {
      const { c } = demarrer();
      await vider();
      c.fermer();
      c.reprendre();
      await vider();
      expect(FauxWebSocket.instances.length).toBe(1);
    });
  });
});
