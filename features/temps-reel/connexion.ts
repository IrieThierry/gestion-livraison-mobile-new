import { create } from 'zustand';

/** Délais avant chaque nouvelle tentative de connexion ; le dernier se répète. */
export const DELAIS_RECONNEXION_MS = [1000, 2000, 5000, 10000, 30000];

/** `http(s)://hôte[/]` -> `ws(s)://hôte/ws`. */
export function urlWebSocket(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  return `${base.replace(/^http/i, 'ws')}/ws`;
}

/** Vrai tant que le socket est authentifié (après `pret`) : le polling est alors suspendu. */
export const useTempsReelStore = create<{ connecte: boolean }>(() => ({ connecte: false }));

/** Vrai après `{"type":"pret"}` ; faux dès que le socket tombe (le polling reprend alors). */
export function useTempsReelConnecte(): boolean {
  return useTempsReelStore((s) => s.connecte);
}

export interface MessageNotification {
  type: 'notification';
  id: string;
  notificationType: string;
}

interface Options {
  apiBase: string;
  /** Lu à chaque (re)connexion : un jeton rafraîchi entre-temps est repris. */
  lireToken: () => Promise<string | null>;
  onNotification: (message: MessageNotification) => void;
}

export interface Connexion {
  /** Arrêt définitif (déconnexion, démontage) : aucune reconnexion. */
  fermer: () => void;
  /** App en arrière-plan : ferme le socket sans programmer de reconnexion. */
  mettreEnPause: () => void;
  /** Retour au premier plan : reconnecte tout de suite (délais remis à zéro). */
  reprendre: () => void;
}

/** Connexion WebSocket avec reconnexion à délai croissant. */
export function ouvrirConnexion({ apiBase, lireToken, onNotification }: Options): Connexion {
  const url = urlWebSocket(apiBase);
  let socket: WebSocket | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let indexDelai = 0;
  let arrete = false;
  let enPause = false;
  /** Invalide les lectures de jeton en cours quand la connexion est coupée entre-temps. */
  let generation = 0;

  const effacerMinuteur = () => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = null;
  };

  const couperSocket = () => {
    const ws = socket;
    socket = null;
    useTempsReelStore.setState({ connecte: false });
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };

  const programmer = () => {
    if (arrete || enPause) return;
    const delai = DELAIS_RECONNEXION_MS[Math.min(indexDelai, DELAIS_RECONNEXION_MS.length - 1)];
    indexDelai += 1;
    minuteur = setTimeout(() => void connecter(), delai);
  };

  async function connecter() {
    minuteur = null;
    if (arrete || enPause) return;
    const maGeneration = ++generation;
    let token: string | null = null;
    try {
      token = await lireToken();
    } catch {
      token = null;
    }
    if (arrete || enPause || maGeneration !== generation) return;
    if (!token) {
      programmer();
      return;
    }
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      if (socket === ws) ws.send(JSON.stringify({ type: 'auth', token }));
    };
    ws.onmessage = (evt: MessageEvent) => {
      if (socket !== ws) return;
      let message: { type?: string } | null;
      try {
        message = JSON.parse(String(evt.data));
      } catch {
        return;
      }
      if (message?.type === 'pret') {
        indexDelai = 0;
        useTempsReelStore.setState({ connecte: true });
      } else if (message?.type === 'notification') {
        onNotification(message as MessageNotification);
      }
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      useTempsReelStore.setState({ connecte: false });
      programmer(); // y compris après 1008 (jeton expiré) : le prochain appel API le rafraîchit
    };
  }

  void connecter();

  return {
    fermer() {
      arrete = true;
      generation += 1;
      effacerMinuteur();
      couperSocket();
    },
    mettreEnPause() {
      if (arrete || enPause) return;
      enPause = true;
      generation += 1;
      effacerMinuteur();
      couperSocket();
    },
    reprendre() {
      if (arrete || !enPause) return;
      enPause = false;
      indexDelai = 0;
      void connecter();
    },
  };
}
