import { buildDeck, emptyTally } from '../../shared/deck';
import { FRUITS, type Card, type ClientAction, type GameView, type Half } from '../../shared/types';
import type { Room } from './game';

/**
 * Bots decide from their own GameView, so they see exactly what a human in their seat would:
 * everyone else's card but not their own, and never the draw pile.
 */

/** Cards the bot cannot see: its own inventory card plus the draw pile, all equally likely. */
function unseenCards(view: GameView): Card[] {
  const seen = new Set<string>();
  for (const p of view.players) if (p.card) seen.add(p.card.id);
  if (view.tableCard) seen.add(view.tableCard.id);
  for (const o of view.orders) {
    seen.add(o.card.id);
    if (o.lockedBy) seen.add(`g-${o.lockedBy}`);
  }
  for (const w of view.wasted) seen.add(`g-${w.gorilla}`);
  if (view.pending) seen.add(view.pending.id);
  return buildDeck().filter((c) => !seen.has(c.id));
}

function overflows(inventory: Card[], orders: Half[]) {
  const stock = emptyTally();
  const gorillas = new Set<string>();
  for (const c of inventory) {
    if (c.kind === 'gorilla') gorillas.add(c.gorilla);
    else for (const h of c.halves) stock[h.fruit] += h.count;
  }
  const ordered = emptyTally();
  for (const h of orders) {
    if (gorillas.has('mitch') && h.count === 3) continue;
    if (gorillas.has('hannah') && h.fruit === 'banana') continue;
    ordered[h.fruit] += h.count;
  }
  return FRUITS.some((f) => ordered[f] > stock[f]);
}

/** Probability that `orders` exceed the inventory, averaging over what the bot's own card could be. */
export function overflowChance(view: GameView, orders: Half[]) {
  const known: Card[] = view.players.filter((p) => p.id !== view.you && p.card).map((p) => p.card!);
  if (view.tableCard) known.push(view.tableCard);
  const candidates = unseenCards(view);
  if (candidates.length === 0) return overflows(known, orders) ? 1 : 0;
  let over = 0;
  for (const c of candidates) if (overflows([...known, c], orders)) over++;
  return over / candidates.length;
}

const currentOrders = (view: GameView) => view.orders.map((o) => o.card.halves[o.side]);

/** Pick the option with the lowest risk; ties are broken at random so bots don't look scripted. */
function safest<T>(options: T[], risk: (o: T) => number, rng: () => number): T {
  const scored = options.map((o) => ({ o, r: risk(o) + rng() * 0.01 }));
  scored.sort((a, b) => a.r - b.r);
  return scored[0].o;
}

export function decide(view: GameView, rng: () => number = Math.random): ClientAction | null {
  if (view.activePlayerId !== view.you) return null;
  const orders = currentOrders(view);

  if (view.phase === 'turn') {
    const canCall = !!view.prevActivePlayerId && view.prevActivePlayerId !== view.you;
    if (view.deckCount === 0) return canCall ? { type: 'call' } : null;
    // A little personality: some bots are braver than others on any given turn.
    const threshold = 0.45 + rng() * 0.2;
    if (canCall && overflowChance(view, orders) >= threshold) return { type: 'call' };
    return { type: 'draw' };
  }

  if (view.phase === 'choosing' && view.pending?.kind === 'fruit') {
    const card = view.pending;
    const side = safest<0 | 1>([0, 1], (s) => overflowChance(view, [...orders, card.halves[s]]), rng);
    return { type: 'choose', side };
  }

  if (view.phase === 'gorilla') {
    const flippable = view.orders.filter((o) => !o.lockedBy);
    if (flippable.length === 0) return null;
    const pick = safest(
      flippable,
      (target) =>
        overflowChance(
          view,
          view.orders.map((o) => o.card.halves[o.id === target.id ? (o.side === 0 ? 1 : 0) : o.side]),
        ),
      rng,
    );
    return { type: 'flip', orderId: pick.id };
  }
  return null;
}

export interface BotMove {
  botId: string;
  action: ClientAction;
  delay: number;
}

/** The next bot move for a room, with a human-feeling delay so animations can play out. */
export function nextBotMove(room: Room, rng: () => number = Math.random): BotMove | null {
  // Don't let bots play on in an abandoned room.
  if (room.isEmpty) return null;

  if (room.phase === 'reveal' && room.reveal) {
    const bot = room.players.find((p) => p.isBot && !room.reveal!.readyIds.includes(p.id));
    return bot ? { botId: bot.id, action: { type: 'ready' }, delay: 3500 + rng() * 1000 } : null;
  }

  const active = room.players.find((p) => p.id === room.activeId);
  if (!active?.isBot) return null;
  const action = decide(room.viewFor(active.id), rng);
  if (!action) return null;
  const justDealt = room.event?.type === 'deal';
  const delay =
    action.type === 'choose' || action.type === 'flip'
      ? 1100 + rng() * 700
      : (justDealt ? 2600 : 1400) + rng() * 1200;
  return { botId: active.id, action, delay };
}
