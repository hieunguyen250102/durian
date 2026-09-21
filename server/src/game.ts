import { buildDeck, emptyTally, orderedHalf, tallyInventory } from '../../shared/deck';
import {
  CHAT_MAX_LENGTH,
  FRUITS,
  LOSE_AT,
  QUICK_EMOTES,
  type ChatMessage,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Card,
  type ClientAction,
  type GameEvent,
  type GameView,
  type GorillaId,
  type LogEntry,
  type Order,
  type Phase,
  type RevealInfo,
  type WastedGorilla,
} from '../../shared/types';

export class GameError extends Error {}

export interface Player {
  id: string;
  sessionId: string;
  name: string;
  tokens: number[];
  connected: boolean;
  card: Card | null;
  avatar: number;
  isBot?: boolean;
}

const BOT_NAMES = ['Bot Mít', 'Bot Ổi', 'Bot Xoài', 'Bot Chôm', 'Bot Na', 'Bot Me', 'Bot Cóc'];

const GORILLA_NAMES: Record<GorillaId, string> = {
  mitch: 'Anh Mitch',
  murphy: 'Em Murphy',
  hannah: 'Chị Hannah',
};

const FRUIT_NAMES = { strawberry: 'dâu', banana: 'chuối', grape: 'nho', durian: 'sầu riêng' } as const;

let idCounter = 0;
const newId = (prefix: string) => `${prefix}${(++idCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export class Room {
  players: Player[] = [];
  hostId: string | null = null;
  phase: Phase = 'lobby';
  round = 0;
  deck: Card[] = [];
  tableCard: Card | null = null;
  orders: Order[] = [];
  wasted: WastedGorilla[] = [];
  pending: Card | null = null;
  activeId: string | null = null;
  prevId: string | null = null;
  reveal: RevealInfo | null = null;
  remainingTokens: number[] = [];
  winnerIds: string[] = [];
  log: LogEntry[] = [];
  event: (GameEvent & { seq: number }) | null = null;
  chat: ChatMessage[] = [];
  lastActivity = Date.now();
  private chatSeq = 0;
  private seq = 0;
  private logSeq = 0;

  constructor(
    public code: string,
    private rng: () => number = Math.random,
  ) {}

  // ---------- membership ----------

  addBot(): Player {
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${this.players.length + 1}`;
    return this.addPlayer(name, true);
  }

  addPlayer(name: string, isBot = false): Player {
    if (this.phase !== 'lobby') throw new GameError('Ván đang diễn ra, không thể vào thêm.');
    if (this.players.length >= MAX_PLAYERS) throw new GameError(`Phòng đã đủ ${MAX_PLAYERS} người.`);
    const used = new Set(this.players.map((p) => p.avatar));
    const avatar = [0, 1, 2, 3, 4, 5, 6].find((a) => !used.has(a)) ?? 0;
    const player: Player = {
      id: newId('p'),
      sessionId: newId('s') + Math.random().toString(36).slice(2),
      name: name.trim().slice(0, 16) || 'Nhân viên',
      tokens: [],
      connected: true,
      card: null,
      avatar,
      isBot,
    };
    this.players.push(player);
    if (!isBot) this.hostId ??= player.id;
    this.addLog(`${player.name} vào phòng.`);
    this.emit({ type: 'join', playerId: player.id });
    return player;
  }

  findBySession(sessionId: string) {
    return this.players.find((p) => p.sessionId === sessionId);
  }

  setConnected(playerId: string, connected: boolean) {
    const p = this.get(playerId);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    this.lastActivity = Date.now();
    this.addLog(connected ? `${p.name} đã kết nối lại.` : `${p.name} mất kết nối.`);
    // A disconnected player can't press "ready"; re-check whether the round can advance.
    if (!connected && this.phase === 'reveal') this.maybeAdvanceFromReveal();
  }

  removePlayer(playerId: string) {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return;
    const [p] = this.players.splice(idx, 1);
    this.addLog(`${p.name} rời phòng.`);
    this.emit({ type: 'leave', playerId });
    if (this.hostId === playerId) this.hostId = this.players.find((q) => !q.isBot)?.id ?? null;

    if (this.phase === 'lobby' || this.phase === 'gameOver') return;
    if (this.players.length < MIN_PLAYERS) {
      this.addLog('Không đủ người chơi, quay về phòng chờ.', 'bad');
      this.toLobby();
      return;
    }
    // Inventory and orders no longer add up without them; replay the round.
    const next = this.players[idx % this.players.length];
    this.addLog('Chia lại vòng vì có người rời đi.');
    this.startRound(next.id);
  }

  /** True when no human is connected; bots alone never keep a room alive. */
  get isEmpty() {
    return this.players.every((p) => p.isBot || !p.connected);
  }

  get hasHumans() {
    return this.players.some((p) => !p.isBot);
  }

  // ---------- chat ----------

  addChat(playerId: string, raw: unknown): ChatMessage {
    const p = this.get(playerId);
    if (!p) throw new GameError('Bạn không ở trong phòng này.');
    // Collapse whitespace and strip control characters; React escapes the rest on render.
    const text = String(raw ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CHAT_MAX_LENGTH);
    if (!text) throw new GameError('Tin nhắn trống.');
    const msg: ChatMessage = {
      id: ++this.chatSeq,
      playerId,
      name: p.name,
      avatar: p.avatar,
      text,
      kind: (QUICK_EMOTES as readonly string[]).includes(text) ? 'emote' : 'text',
      at: Date.now(),
    };
    this.chat.push(msg);
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80);
    this.lastActivity = Date.now();
    return msg;
  }

  // ---------- actions ----------

  act(playerId: string, action: ClientAction) {
    const player = this.get(playerId);
    if (!player) throw new GameError('Bạn không ở trong phòng này.');
    this.lastActivity = Date.now();
    switch (action.type) {
      case 'start':
        return this.start(playerId);
      case 'draw':
        return this.draw(playerId);
      case 'choose':
        return this.choose(playerId, action.side);
      case 'flip':
        return this.flip(playerId, action.orderId);
      case 'call':
        return this.call(playerId);
      case 'ready':
        return this.ready(playerId);
      case 'forceNext':
        this.requireHost(playerId);
        if (this.phase !== 'reveal') throw new GameError('Chưa thể sang vòng mới.');
        return this.startRound(this.nextOf(this.reveal!.loserId));
      case 'backToLobby':
        this.requireHost(playerId);
        if (this.phase !== 'gameOver') throw new GameError('Ván chưa kết thúc.');
        return this.toLobby();
      case 'kick':
        return this.kick(playerId, action.playerId);
      case 'addBot':
        this.requireHost(playerId);
        if (this.phase !== 'lobby') throw new GameError('Chỉ thêm bot được trong phòng chờ.');
        this.addBot();
        return;
      default:
        throw new GameError('Hành động không hợp lệ.');
    }
  }

  private start(playerId: string) {
    this.requireHost(playerId);
    if (this.phase !== 'lobby') throw new GameError('Ván đã bắt đầu.');
    if (this.players.length < MIN_PLAYERS) throw new GameError(`Cần ít nhất ${MIN_PLAYERS} người chơi.`);
    for (const p of this.players) p.tokens = [];
    this.remainingTokens = [1, 2, 3, 4, 5, 6, 7];
    this.winnerIds = [];
    this.round = 0;
    const first = this.players[Math.floor(this.rng() * this.players.length)];
    this.addLog(`Ván mới bắt đầu! ${first.name} vừa ăn trái cây gần nhất nên đi trước.`, 'good');
    this.startRound(first.id);
  }

  private draw(playerId: string) {
    this.requireTurn(playerId, 'turn');
    const card = this.deck.pop();
    if (!card) throw new GameError('Chồng bài đã hết, bạn phải gọi quản lý.');
    const name = this.get(playerId)!.name;
    this.emit({ type: 'draw', playerId, card });
    if (card.kind === 'fruit') {
      this.pending = card;
      this.phase = 'choosing';
      return;
    }
    if (this.orders.some((o) => !o.lockedBy)) {
      this.pending = card;
      this.phase = 'gorilla';
      this.addLog(`${name} rút được ${GORILLA_NAMES[card.gorilla]}! Chọn một đơn để lật.`);
      return;
    }
    this.wasted.push({ gorilla: card.gorilla, by: playerId });
    this.addLog(`${name} rút được ${GORILLA_NAMES[card.gorilla]} nhưng không còn đơn nào để lật.`);
    this.emit({ type: 'wasted', playerId, gorilla: card.gorilla });
    this.endTurn();
  }

  private choose(playerId: string, side: 0 | 1) {
    this.requireTurn(playerId, 'choosing');
    if (side !== 0 && side !== 1) throw new GameError('Nửa thẻ không hợp lệ.');
    const card = this.pending;
    if (!card || card.kind !== 'fruit') throw new GameError('Không có thẻ để nhận đơn.');
    const order: Order = { id: newId('o'), card, side, by: playerId };
    this.orders.push(order);
    this.pending = null;
    const h = orderedHalf(order);
    this.addLog(`${this.get(playerId)!.name} nhận đơn ${h.count} ${FRUIT_NAMES[h.fruit]}.`);
    this.emit({ type: 'order', playerId, orderId: order.id });
    this.endTurn();
  }

  private flip(playerId: string, orderId: string) {
    this.requireTurn(playerId, 'gorilla');
    const card = this.pending;
    if (!card || card.kind !== 'gorilla') throw new GameError('Không có khỉ đột để dùng.');
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) throw new GameError('Không tìm thấy đơn.');
    if (order.lockedBy) throw new GameError('Đơn này đã bị lật rồi, không thể lật lại.');
    order.side = order.side === 0 ? 1 : 0;
    order.lockedBy = card.gorilla;
    this.pending = null;
    const h = orderedHalf(order);
    this.addLog(`${this.get(playerId)!.name} lật một đơn thành ${h.count} ${FRUIT_NAMES[h.fruit]}.`);
    this.emit({ type: 'flip', playerId, orderId, gorilla: card.gorilla });
    this.endTurn();
  }

  private call(playerId: string) {
    this.requireTurn(playerId, 'turn');
    const calledId = this.prevId;
    if (!calledId || calledId === playerId) throw new GameError('Chưa có ai để gọi quản lý.');

    const inventoryCards = this.players.map((p) => p.card).filter((c): c is Card => !!c);
    if (this.tableCard) inventoryCards.push(this.tableCard);
    const inventory = tallyInventory(inventoryCards);
    const inventoryGorillas = inventoryCards.flatMap((c) => (c.kind === 'gorilla' ? [c.gorilla] : []));

    const cancelledOrderIds: string[] = [];
    const ordered = emptyTally();
    for (const o of this.orders) {
      const h = orderedHalf(o);
      const cancelled =
        (inventoryGorillas.includes('mitch') && h.count === 3) ||
        (inventoryGorillas.includes('hannah') && h.fruit === 'banana');
      if (cancelled) cancelledOrderIds.push(o.id);
      else ordered[h.fruit] += h.count;
    }
    const overFruits = FRUITS.filter((f) => ordered[f] > inventory[f]);
    const loserId = overFruits.length > 0 ? calledId : playerId;
    const token = this.remainingTokens.shift()!;
    const loser = this.get(loserId)!;
    loser.tokens.push(token);

    this.reveal = {
      callerId: playerId,
      calledId,
      inventory,
      ordered,
      cancelledOrderIds,
      inventoryGorillas,
      overFruits,
      loserId,
      token,
      readyIds: [],
    };
    const caller = this.get(playerId)!;
    const called = this.get(calledId)!;
    this.addLog(`🔔 ${caller.name} rung chuông gọi quản lý vì ${called.name}!`);
    this.addLog(
      overFruits.length > 0
        ? `Thiếu hàng (${overFruits.map((f) => FRUIT_NAMES[f]).join(', ')})! Quản lý nổi giận với ${called.name}.`
        : `Đủ hàng! Quản lý nổi giận với ${caller.name} vì gọi quá sớm.`,
      'bad',
    );
    this.addLog(`${loser.name} nhận token giận dữ ${token}.`, 'bad');

    const points = (p: Player) => p.tokens.reduce((a, b) => a + b, 0);
    if (points(loser) >= LOSE_AT) {
      const min = Math.min(...this.players.map(points));
      const lowest = this.players.filter((p) => points(p) === min);
      const minCount = Math.min(...lowest.map((p) => p.tokens.length));
      this.winnerIds = lowest.filter((p) => p.tokens.length === minCount).map((p) => p.id);
      this.phase = 'gameOver';
      this.addLog(`${loser.name} bị đuổi việc! Người thắng: ${this.winnerIds.map((id) => this.get(id)!.name).join(', ')} 🎉`, 'good');
    } else {
      this.phase = 'reveal';
    }
    this.emit({ type: 'bell', callerId: playerId, calledId });
  }

  private ready(playerId: string) {
    if (this.phase !== 'reveal' || !this.reveal) throw new GameError('Chưa thể sang vòng mới.');
    if (!this.reveal.readyIds.includes(playerId)) this.reveal.readyIds.push(playerId);
    this.maybeAdvanceFromReveal();
  }

  private kick(hostId: string, targetId: string) {
    this.requireHost(hostId);
    const target = this.get(targetId);
    if (!target || targetId === hostId) throw new GameError('Không thể mời người này ra.');
    if (this.phase !== 'lobby' && this.phase !== 'gameOver' && target.connected) {
      throw new GameError('Trong ván chỉ có thể mời ra người đã mất kết nối.');
    }
    this.removePlayer(targetId);
  }

  // ---------- flow ----------

  private maybeAdvanceFromReveal() {
    if (this.phase !== 'reveal' || !this.reveal) return;
    const waiting = this.players.filter((p) => p.connected && !this.reveal!.readyIds.includes(p.id));
    if (waiting.length === 0) this.startRound(this.nextOf(this.reveal.loserId));
  }

  private startRound(firstId: string) {
    this.round += 1;
    this.deck = shuffle(buildDeck(), this.rng);
    for (const p of this.players) p.card = this.deck.pop()!;
    this.tableCard = this.players.length === 2 ? this.deck.pop()! : null;
    this.orders = [];
    this.wasted = [];
    this.pending = null;
    this.reveal = null;
    this.activeId = firstId;
    this.prevId = null;
    this.phase = 'turn';
    this.addLog(`— Vòng ${this.round} — ${this.get(firstId)!.name} đi trước.`);
    this.emit({ type: 'deal', round: this.round });
  }

  private endTurn() {
    this.prevId = this.activeId;
    this.activeId = this.nextOf(this.activeId!);
    this.phase = 'turn';
  }

  private toLobby() {
    this.phase = 'lobby';
    this.round = 0;
    this.deck = [];
    this.tableCard = null;
    this.orders = [];
    this.wasted = [];
    this.pending = null;
    this.reveal = null;
    this.activeId = null;
    this.prevId = null;
    this.winnerIds = [];
    for (const p of this.players) {
      p.card = null;
      p.tokens = [];
    }
  }

  // ---------- helpers ----------

  get(id: string) {
    return this.players.find((p) => p.id === id);
  }

  nextOf(id: string) {
    const idx = this.players.findIndex((p) => p.id === id);
    return this.players[(idx + 1) % this.players.length].id;
  }

  private requireHost(playerId: string) {
    if (this.hostId !== playerId) throw new GameError('Chỉ chủ phòng mới làm được việc này.');
  }

  private requireTurn(playerId: string, phase: Phase) {
    if (this.activeId !== playerId) throw new GameError('Chưa đến lượt bạn.');
    if (this.phase !== phase) throw new GameError('Không thể làm việc này lúc này.');
  }

  private addLog(text: string, tone?: LogEntry['tone']) {
    this.log.push({ id: ++this.logSeq, text, tone });
    if (this.log.length > 60) this.log.splice(0, this.log.length - 60);
  }

  private emit(event: GameEvent) {
    this.event = { ...event, seq: ++this.seq };
  }

  viewFor(viewerId: string): GameView {
    const revealed = this.phase === 'reveal' || this.phase === 'gameOver';
    return {
      roomCode: this.code,
      you: viewerId,
      phase: this.phase,
      round: this.round,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.id === this.hostId,
        connected: p.connected,
        tokens: p.tokens,
        // Players never see their own inventory card until the manager is called.
        card: p.id === viewerId && !revealed ? null : p.card,
        hasCard: !!p.card,
        avatar: p.avatar,
        isBot: !!p.isBot,
      })),
      activePlayerId: this.activeId,
      prevActivePlayerId: this.prevId,
      deckCount: this.deck.length,
      tableCard: this.tableCard,
      orders: this.orders,
      wasted: this.wasted,
      pending: this.pending,
      reveal: this.reveal,
      remainingTokens: this.remainingTokens,
      winnerIds: this.winnerIds,
      log: this.log.slice(-30),
      event: this.event,
    };
  }
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
