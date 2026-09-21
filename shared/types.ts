// Types shared by the server (authoritative game state) and the client (rendering).

export const FRUITS = ['strawberry', 'banana', 'grape', 'durian'] as const;
export type Fruit = (typeof FRUITS)[number];

export const GORILLAS = ['mitch', 'murphy', 'hannah'] as const;
export type GorillaId = (typeof GORILLAS)[number];

export interface Half {
  fruit: Fruit;
  count: number;
}

export interface FruitCard {
  id: string;
  kind: 'fruit';
  halves: [Half, Half];
}

export interface GorillaCard {
  id: string;
  kind: 'gorilla';
  gorilla: GorillaId;
}

export type Card = FruitCard | GorillaCard;

/** A fruit card sitting on the order board. `side` is the half facing the ✓. */
export interface Order {
  id: string;
  card: FruitCard;
  side: 0 | 1;
  by: string;
  /** Gorilla placed next to the order after flipping it; locks it from further flips. */
  lockedBy?: GorillaId;
}

/** A gorilla drawn as an order when there was nothing left to flip. */
export interface WastedGorilla {
  gorilla: GorillaId;
  by: string;
}

export type Phase = 'lobby' | 'turn' | 'choosing' | 'gorilla' | 'reveal' | 'gameOver';

export type FruitTally = Record<Fruit, number>;

export interface RevealInfo {
  callerId: string;
  calledId: string;
  inventory: FruitTally;
  ordered: FruitTally;
  /** Orders cancelled by gorillas sitting in the inventory. */
  cancelledOrderIds: string[];
  inventoryGorillas: GorillaId[];
  overFruits: Fruit[];
  loserId: string;
  token: number;
  readyIds: string[];
}

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  tokens: number[];
  /** The player's inventory card. `null` for the viewer's own card until revealed. */
  card: Card | null;
  hasCard: boolean;
  avatar: number;
  isBot: boolean;
}

export type GameEvent =
  | { type: 'deal'; round: number }
  | { type: 'draw'; playerId: string; card: Card }
  | { type: 'order'; playerId: string; orderId: string }
  | { type: 'flip'; playerId: string; orderId: string; gorilla: GorillaId }
  | { type: 'wasted'; playerId: string; gorilla: GorillaId }
  | { type: 'bell'; callerId: string; calledId: string }
  | { type: 'penalty'; playerId: string; token: number }
  | { type: 'gameOver'; winnerIds: string[] }
  | { type: 'join'; playerId: string }
  | { type: 'leave'; playerId: string };

export interface LogEntry {
  id: number;
  text: string;
  tone?: 'info' | 'good' | 'bad';
}

export interface GameView {
  roomCode: string;
  you: string;
  phase: Phase;
  round: number;
  players: PlayerView[];
  activePlayerId: string | null;
  prevActivePlayerId: string | null;
  deckCount: number;
  /** Extra face-up inventory card in 2-player games. */
  tableCard: Card | null;
  orders: Order[];
  wasted: WastedGorilla[];
  /** Card drawn by the active player, visible to everyone while they decide. */
  pending: Card | null;
  reveal: RevealInfo | null;
  remainingTokens: number[];
  winnerIds: string[];
  log: LogEntry[];
  event: (GameEvent & { seq: number }) | null;
}

export type ClientAction =
  | { type: 'start' }
  | { type: 'addBot' }
  | { type: 'draw' }
  | { type: 'choose'; side: 0 | 1 }
  | { type: 'flip'; orderId: string }
  | { type: 'call' }
  | { type: 'ready' }
  | { type: 'forceNext' }
  | { type: 'backToLobby' }
  | { type: 'kick'; playerId: string };

export interface JoinPayload {
  roomCode?: string;
  name: string;
  /** Secret issued by the server on first join; lets a player reconnect to their seat. */
  sessionId?: string;
}

export type JoinResult =
  | { ok: true; roomCode: string; playerId: string; sessionId: string }
  | { ok: false; error: string };

export interface ChatMessage {
  id: number;
  playerId: string;
  name: string;
  avatar: number;
  text: string;
  /** Quick reactions render as a big floating emoji instead of a text bubble. */
  kind: 'text' | 'emote';
  at: number;
}

export const QUICK_EMOTES = ['😂', '😱', '😡', '🤔', '👏', '🍌', '🔔', '🙏'] as const;
export const CHAT_MAX_LENGTH = 200;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 7;
export const LOSE_AT = 7;
