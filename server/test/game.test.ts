import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/game';
import type { Card, FruitCard } from '../../shared/types';

const fruit = (id: string, a: [string, number], b: [string, number]): FruitCard => ({
  id,
  kind: 'fruit',
  halves: [
    { fruit: a[0] as FruitCard['halves'][0]['fruit'], count: a[1] },
    { fruit: b[0] as FruitCard['halves'][0]['fruit'], count: b[1] },
  ],
});

function setup(n = 3) {
  const room = new Room('TEST', () => 0);
  const players = Array.from({ length: n }, (_, i) => room.addPlayer(`P${i}`));
  room.act(players[0].id, { type: 'start' });
  return { room, players };
}

/** Replace the dealt inventory and the top of the draw pile with known cards. */
function rig(room: Room, inventory: Card[], draws: Card[]) {
  room.players.forEach((p, i) => (p.card = inventory[i]));
  room.tableCard = inventory[room.players.length] ?? null;
  room.deck = [...draws].reverse();
}

test('3 players: deal one card each, no table card', () => {
  const { room } = setup(3);
  assert.equal(room.phase, 'turn');
  assert.ok(room.players.every((p) => p.card));
  assert.equal(room.tableCard, null);
  assert.equal(room.deck.length, 31 - 3);
});

test('2 players get an extra face-up inventory card', () => {
  const { room } = setup(2);
  assert.ok(room.tableCard);
  assert.equal(room.deck.length, 31 - 3);
});

test('players cannot see their own card', () => {
  const { room, players } = setup(3);
  const view = room.viewFor(players[1].id);
  assert.equal(view.players[1].card, null);
  assert.ok(view.players[0].card);
});

test('calling when orders fit the inventory penalizes the caller', () => {
  const { room, players } = setup(3);
  const [a, b] = players;
  rig(
    room,
    [fruit('i1', ['strawberry', 1], ['banana', 2]), fruit('i2', ['strawberry', 2], ['grape', 1]), fruit('i3', ['durian', 1], ['banana', 3])],
    [fruit('d1', ['strawberry', 3], ['grape', 1])],
  );
  room.act(a.id, { type: 'draw' });
  room.act(a.id, { type: 'choose', side: 0 }); // 3 strawberries of 3 in stock
  room.act(b.id, { type: 'call' });
  assert.equal(room.reveal!.loserId, b.id);
  assert.deepEqual(b.tokens, [1]);
});

test('over-ordering penalizes the called-on player and tokens go lowest first', () => {
  const { room, players } = setup(3);
  const [a, b, c] = players;
  rig(
    room,
    [fruit('i1', ['strawberry', 1], ['banana', 2]), fruit('i2', ['strawberry', 1], ['grape', 1]), fruit('i3', ['durian', 1], ['banana', 3])],
    [fruit('d1', ['grape', 1], ['durian', 2]), fruit('d2', ['grape', 2], ['banana', 1])],
  );
  room.act(a.id, { type: 'draw' });
  room.act(a.id, { type: 'choose', side: 0 }); // 1 grape
  room.act(b.id, { type: 'draw' });
  room.act(b.id, { type: 'choose', side: 0 }); // 2 grapes -> total 3 > 1
  room.act(c.id, { type: 'call' });
  assert.equal(room.reveal!.loserId, b.id);
  assert.deepEqual(room.reveal!.overFruits, ['grape']);
  assert.deepEqual(room.remainingTokens, [2, 3, 4, 5, 6, 7]);
  // Next round starts left of the penalized player once everyone is ready.
  for (const p of players) room.act(p.id, { type: 'ready' });
  assert.equal(room.activeId, c.id);
  assert.equal(room.round, 2);
});

test('gorilla drawn as an order flips an earlier order and locks it', () => {
  const { room, players } = setup(3);
  const [a, b, c] = players;
  rig(
    room,
    [fruit('i1', ['strawberry', 1], ['banana', 2]), fruit('i2', ['strawberry', 1], ['grape', 1]), fruit('i3', ['durian', 1], ['banana', 3])],
    [fruit('d1', ['grape', 1], ['durian', 3]), { id: 'g', kind: 'gorilla', gorilla: 'murphy' }],
  );
  room.act(a.id, { type: 'draw' });
  room.act(a.id, { type: 'choose', side: 0 });
  room.act(b.id, { type: 'draw' });
  assert.equal(room.phase, 'gorilla');
  const orderId = room.orders[0].id;
  room.act(b.id, { type: 'flip', orderId });
  assert.equal(room.orders[0].side, 1);
  assert.equal(room.orders[0].lockedBy, 'murphy');
  assert.equal(room.activeId, c.id);
  // 3 durians ordered, 1 in stock -> b (the called-on player) is penalized.
  room.act(c.id, { type: 'call' });
  assert.equal(room.reveal!.loserId, b.id);
});

test('gorillas in inventory cancel orders: Mitch removes 3s, Hannah removes bananas', () => {
  const { room, players } = setup(3);
  const [a, b, c] = players;
  rig(
    room,
    [{ id: 'gm', kind: 'gorilla', gorilla: 'mitch' }, { id: 'gh', kind: 'gorilla', gorilla: 'hannah' }, fruit('i3', ['durian', 1], ['grape', 2])],
    [fruit('d1', ['strawberry', 3], ['grape', 1]), fruit('d2', ['banana', 2], ['durian', 1])],
  );
  room.act(a.id, { type: 'draw' });
  room.act(a.id, { type: 'choose', side: 0 }); // 3 strawberries - cancelled by Mitch
  room.act(b.id, { type: 'draw' });
  room.act(b.id, { type: 'choose', side: 0 }); // 2 bananas - cancelled by Hannah
  room.act(c.id, { type: 'call' });
  assert.equal(room.reveal!.cancelledOrderIds.length, 2);
  assert.equal(room.reveal!.loserId, c.id);
});

test('game ends at 7 points; fewest points wins', () => {
  const { room, players } = setup(3);
  const [a, b, c] = players;
  a.tokens = [1, 2];
  b.tokens = [3];
  room.remainingTokens = [4, 5, 6, 7];
  rig(
    room,
    [fruit('i1', ['strawberry', 1], ['banana', 2]), fruit('i2', ['strawberry', 1], ['grape', 1]), fruit('i3', ['durian', 1], ['banana', 3])],
    [fruit('d1', ['grape', 3], ['durian', 1])],
  );
  room.act(a.id, { type: 'draw' });
  room.act(a.id, { type: 'choose', side: 0 });
  room.act(b.id, { type: 'call' }); // a over-ordered grapes -> a gets 4 -> 7 points
  assert.equal(room.phase, 'gameOver');
  assert.deepEqual(room.winnerIds, [c.id]);
});

test('cannot act out of turn or call with no previous player', () => {
  const { room, players } = setup(3);
  assert.throws(() => room.act(players[1].id, { type: 'draw' }));
  assert.throws(() => room.act(players[0].id, { type: 'call' }));
});

test('chat messages are trimmed, capped and tagged as emotes', () => {
  const { room, players } = setup(2);
  const msg = room.addChat(players[0].id, '  xin   chào\n ');
  assert.equal(msg.text, 'xin chào');
  assert.equal(msg.kind, 'text');
  assert.equal(room.addChat(players[1].id, '😂').kind, 'emote');
  assert.equal(room.addChat(players[0].id, 'a'.repeat(500)).text.length, 200);
  assert.throws(() => room.addChat(players[0].id, '   '));
  assert.throws(() => room.addChat('nobody', 'hi'));
});
