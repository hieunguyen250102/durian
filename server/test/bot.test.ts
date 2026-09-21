import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/game';
import { decide, nextBotMove, overflowChance } from '../src/bot';
import type { Card, FruitCard } from '../../shared/types';

const fruit = (id: string, a: [FruitCard['halves'][0]['fruit'], number], b: [FruitCard['halves'][0]['fruit'], number]): FruitCard => ({
  id,
  kind: 'fruit',
  halves: [
    { fruit: a[0], count: a[1] },
    { fruit: b[0], count: b[1] },
  ],
});

function roomWithBots(bots: number) {
  const room = new Room('BOTS', () => 0);
  const host = room.addPlayer('Host');
  for (let i = 0; i < bots; i++) room.act(host.id, { type: 'addBot' });
  return { room, host };
}

test('host can add bots in the lobby and they count toward the player minimum', () => {
  const { room, host } = roomWithBots(2);
  assert.equal(room.players.filter((p) => p.isBot).length, 2);
  assert.equal(room.hostId, host.id);
  room.act(host.id, { type: 'start' });
  assert.equal(room.phase, 'turn');
});

test('bots never see their own card', () => {
  const { room, host } = roomWithBots(1);
  room.act(host.id, { type: 'start' });
  const bot = room.players[1];
  assert.equal(room.viewFor(bot.id).players[1].card, null);
});

test('bot calls when the orders clearly exceed any possible stock', () => {
  const { room, host } = roomWithBots(2);
  room.act(host.id, { type: 'start' });
  const [h, b1, b2] = room.players;
  const inv: Card[] = [fruit('f1', ['strawberry', 1], ['banana', 2]), fruit('f2', ['strawberry', 1], ['grape', 2]), fruit('f3', ['banana', 1], ['grape', 3])];
  room.players.forEach((p, i) => (p.card = inv[i]));
  // Durian stock is at most 3 (only from b2's unknown card), yet 5 durians are on order.
  room.orders = [
    { id: 'o1', card: fruit('f4', ['grape', 1], ['durian', 3]), side: 1, by: h.id },
    { id: 'o2', card: fruit('f5', ['durian', 2], ['strawberry', 1]), side: 0, by: b1.id },
  ];
  room.activeId = b2.id;
  room.prevId = b1.id;
  assert.equal(overflowChance(room.viewFor(b2.id), room.orders.map((o) => o.card.halves[o.side])), 1);
  assert.deepEqual(decide(room.viewFor(b2.id), () => 0.5), { type: 'call' });
});

test('bot picks the safer half when taking an order', () => {
  const { room, host } = roomWithBots(2);
  room.act(host.id, { type: 'start' });
  const bot = room.players[1];
  room.players.forEach((p) => (p.card = fruit(`x${p.id}`, ['strawberry', 1], ['banana', 2])));
  room.players[0].card = fruit('f1', ['strawberry', 1], ['banana', 2]);
  room.players[2].card = fruit('f7', ['banana', 1], ['strawberry', 3]);
  room.activeId = bot.id;
  room.phase = 'choosing';
  // 3 durians would almost surely overflow; 1 strawberry is safe.
  room.pending = fruit('f6', ['durian', 3], ['strawberry', 1]);
  assert.deepEqual(decide(room.viewFor(bot.id), () => 0.5), { type: 'choose', side: 1 });
});

test('games between the host and bots always reach game over', () => {
  for (let seed = 1; seed <= 20; seed++) {
    let x = seed;
    const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    const room = new Room('SIM', rng);
    const host = room.addPlayer('Host');
    for (let i = 0; i < 2 + (seed % 5); i++) room.act(host.id, { type: 'addBot' });
    room.act(host.id, { type: 'start' });
    let steps = 0;
    while (room.phase !== 'gameOver' && steps++ < 5000) {
      // The human host plays with the same strategy as the bots.
      if (room.phase === 'reveal' && !room.reveal!.readyIds.includes(host.id)) {
        room.act(host.id, { type: 'ready' });
        continue;
      }
      if (room.activeId === host.id && room.phase !== 'reveal') {
        const action = decide(room.viewFor(host.id), rng);
        assert.ok(action, `host stuck in phase ${room.phase} (seed ${seed})`);
        room.act(host.id, action);
        continue;
      }
      const move = nextBotMove(room, rng);
      assert.ok(move, `stuck in phase ${room.phase} (seed ${seed})`);
      room.act(move.botId, move.action);
    }
    assert.equal(room.phase, 'gameOver', `seed ${seed} did not finish`);
    assert.ok(room.winnerIds.length > 0);
  }
});
