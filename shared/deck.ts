import type { Card, FruitCard, Fruit, GorillaCard, Order, FruitTally } from './types';

/**
 * The official per-card breakdown of the 28 fruit cards is not published. This list follows the
 * rulebook's constraints: two different fruits per card, one half shows 1 fruit and the other 2–3,
 * strawberries are the most common and durians the least common.
 * Halves: strawberry 18, banana 14, grape 14, durian 10.
 * Format: [single fruit, multi fruit, multi count]. Swap in the real list here when it is known.
 */
const FRUIT_CARD_SPECS: [Fruit, Fruit, 2 | 3][] = [
  ['strawberry', 'banana', 2],
  ['strawberry', 'banana', 3],
  ['strawberry', 'grape', 2],
  ['strawberry', 'grape', 3],
  ['strawberry', 'durian', 2],
  ['strawberry', 'durian', 3],
  ['banana', 'strawberry', 2],
  ['banana', 'strawberry', 3],
  ['grape', 'strawberry', 2],
  ['grape', 'strawberry', 3],
  ['durian', 'strawberry', 2],
  ['durian', 'strawberry', 3],
  ['banana', 'grape', 2],
  ['banana', 'grape', 3],
  ['grape', 'banana', 2],
  ['grape', 'banana', 3],
  ['banana', 'durian', 2],
  ['durian', 'banana', 2],
  ['grape', 'durian', 2],
  ['durian', 'grape', 3],
  ['strawberry', 'banana', 2],
  ['strawberry', 'grape', 2],
  ['banana', 'strawberry', 2],
  ['grape', 'strawberry', 3],
  ['strawberry', 'durian', 2],
  ['durian', 'strawberry', 2],
  ['banana', 'grape', 2],
  ['grape', 'banana', 3],
];

export function buildDeck(): Card[] {
  const fruitCards: FruitCard[] = FRUIT_CARD_SPECS.map(([single, multi, count], i) => ({
    id: `f${i + 1}`,
    kind: 'fruit',
    // Alternate which side holds the single fruit so the deck looks varied.
    halves: i % 2 === 0
      ? [{ fruit: single, count: 1 }, { fruit: multi, count }]
      : [{ fruit: multi, count }, { fruit: single, count: 1 }],
  }));
  const gorillas: GorillaCard[] = [
    { id: 'g-mitch', kind: 'gorilla', gorilla: 'mitch' },
    { id: 'g-murphy', kind: 'gorilla', gorilla: 'murphy' },
    { id: 'g-hannah', kind: 'gorilla', gorilla: 'hannah' },
  ];
  return [...fruitCards, ...gorillas];
}

export function emptyTally(): FruitTally {
  return { strawberry: 0, banana: 0, grape: 0, durian: 0 };
}

/** Both halves of every inventory card count toward the stock. Gorillas add nothing. */
export function tallyInventory(cards: Card[]): FruitTally {
  const t = emptyTally();
  for (const c of cards) {
    if (c.kind !== 'fruit') continue;
    for (const h of c.halves) t[h.fruit] += h.count;
  }
  return t;
}

export function orderedHalf(o: Order) {
  return o.card.halves[o.side];
}
