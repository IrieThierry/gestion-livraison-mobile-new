import { create } from 'zustand';

/** Délais avant chaque nouvelle tentative de connexion ; le dernier se répète. */
export const DELAIS_RECONNEXION_MS = [1000, 2000, 5000, 10000, 30000];

/** Après un refus d'authentification (fermeture 1008), on attend directement le délai maximal. */
export const DELAI_APRES_REFUS_MS = DELAIS_RECONNEXION_MS[DELAIS_RECONNEXION_MS.length - 1];

/** Code de fermeture WebSocket « policy violation » : authentification refusée ou attendue. */
export const CODE_REFUS = 1008;

/**
 * Silence maximal toléré (le serveur envoie `{"type":"ping"}` toutes les 25 s) : au-delà, la connexion est tenue
 * pour morte (connexion à moitié ouverte), le socket est fermé et l'on repasse au polling avec reconnexion.
 */
export const SILENCE_MAX_MS = 60_000;

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
  /** Appelé à chaque `pret` : relire ce qui a pu être créé pendant que rien n'était ni lu ni poussé. */
  onPret?: () => void;
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
export function ouvrirConnexion({ apiBase, lireToken, onNotification, onPret }: Options): Connexion {
  const url = urlWebSocket(apiBase);
  let socket: WebSocket | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let garde: ReturnType<typeof setTimeout> | null = null;
  let indexDelai = 0;
  let arrete = false;
  let enPause = false;
  /** Invalide les lectures de jeton en cours quand la connexion est coupée entre-temps. */
  let generation = 0;

  const effacerMinuteur = () => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = null;
  };

  const arreterGarde = () => {
    if (garde) clearTimeout(garde);
    garde = null;
  };

  const couperSocket = () => {
    arreterGarde();
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
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      socket = null;
      programmer();
      return;
    }
    socket = ws;

    /** Fin de ce socket (fermeture ou silence) : retour au polling et reconnexion. */
    const perdu = (code?: number) => {
      if (socket !== ws) return;
      socket = null;
      arreterGarde();
      useTempsReelStore.setState({ connecte: false });
      // Après 1008 (jeton expiré ou refusé), pas de rafale : le prochain appel API rafraîchit le jeton.
      if (code === CODE_REFUS) indexDelai = DELAIS_RECONNEXION_MS.length - 1;
      programmer();
    };

    /** Chien de garde : réarmé à chaque message reçu (pret, ping, notification…). */
    const armerGarde = () => {
      arreterGarde();
      garde = setTimeout(() => {
        garde = null;
        if (socket !== ws) return;
        // Un socket à moitié ouvert peut ne jamais émettre `close` : on n'attend pas l'événement.
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // déjà fermé
        }
        perdu();
      }, SILENCE_MAX_MS);
    };

    ws.onopen = () => {
      if (socket !== ws) return;
      armerGarde();
      ws.send(JSON.stringify({ type: 'auth', token }));
    };
    ws.onmessage = (evt: MessageEvent) => {
      if (socket !== ws) return;
      armerGarde();
      let message: { type?: string } | null;
      try {
        message = JSON.parse(String(evt.data));
      } catch {
        return;
      }
      if (message?.type === 'pret') {
        indexDelai = 0;
        useTempsReelStore.setState({ connecte: true });
        onPret?.();
      } else if (message?.type === 'notification') {
        onNotification(message as MessageNotification);
      }
      // `ping` et types inconnus : ignorés (le chien de garde est déjà réarmé).
    };
    ws.onclose = (evt?: { code?: number }) => perdu(evt?.code);
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
