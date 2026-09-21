import { AnimatePresence, motion } from 'framer-motion';
import { FRUITS, type GameView, type Order } from '../../../shared/types';
import { emptyTally, orderedHalf } from '../../../shared/deck';
import { CardFace, FlipCard } from './Card';
import { FRUIT_META, GORILLA_META, tokenImg } from '../meta';

export function Deck({ count, canDraw, onDraw }: { count: number; canDraw: boolean; onDraw: () => void }) {
  const layers = Math.min(6, Math.ceil(count / 5));
  return (
    <motion.button
      className={`deck${canDraw ? ' armed' : ''}`}
      disabled={!canDraw}
      onClick={onDraw}
      whileHover={canDraw ? { y: -4, rotate: -2 } : undefined}
      whileTap={canDraw ? { scale: 0.95 } : undefined}
      title={canDraw ? 'Rút bài để nhận đơn' : undefined}
    >
      {Array.from({ length: layers }, (_, i) => (
        <div key={i} className="deck-layer" style={{ transform: `translate(${-i * 1.5}px, ${-i * 2}px)` }} />
      ))}
      {count === 0 && <div className="deck-empty">Hết bài</div>}
      <span className="deck-count">{count}</span>
      {canDraw && <span className="deck-hint">Rút bài</span>}
    </motion.button>
  );
}

export function Bell({
  canRing,
  ringKey,
  onRing,
}: {
  canRing: boolean;
  /** Changes each time the bell is rung, replaying the ring animation. */
  ringKey: number;
  onRing: () => void;
}) {
  return (
    <div className="bell-wrap">
      <motion.button
        key={ringKey}
        className={`bell${canRing ? ' armed' : ''}`}
        disabled={!canRing}
        onClick={onRing}
        title={canRing ? 'Rung chuông gọi quản lý!' : 'Chuông'}
        whileHover={canRing ? { rotate: [0, -12, 10, -6, 0], transition: { duration: 0.5 } } : undefined}
        whileTap={canRing ? { scale: 0.9 } : undefined}
        initial={ringKey > 0 ? { rotate: 0, scale: 1 } : false}
        animate={
          ringKey > 0
            ? { rotate: [0, -32, 28, -24, 20, -14, 10, -5, 0], scale: [1, 1.35, 1.3, 1.25, 1.2, 1.12, 1.06, 1] }
            : { rotate: 0, scale: 1 }
        }
        transition={{ duration: 1.3, ease: 'easeOut' }}
      >
        <img src="/assets/handbell.webp" alt="Chuông" draggable={false} />
      </motion.button>
      {ringKey > 0 && (
        <div className="waves" key={`w${ringKey}`}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="wave"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 3.2, opacity: 0 }}
              transition={{ duration: 1.2, delay: i * 0.25, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}
      {canRing && <span className="bell-hint">Gọi quản lý</span>}
    </div>
  );
}

export function TokenPile({ tokens }: { tokens: number[] }) {
  // Highest at the bottom so the lowest (next to be taken) sits on top.
  const sorted = [...tokens].sort((a, b) => b - a);
  return (
    <div className="token-pile" title="Token giận dữ còn lại">
      {sorted.map((t, i) => (
        <motion.img
          key={t}
          layoutId={`token-${t}`}
          src={tokenImg(t)}
          className="token pile"
          style={{ zIndex: i, left: `${i * 9}%` }}
          alt={`Token ${t}`}
          transition={{ type: 'spring', stiffness: 90, damping: 14 }}
        />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  fresh,
  cancelled,
  flippable,
  onFlip,
}: {
  order: Order;
  fresh: boolean;
  cancelled: boolean;
  flippable: boolean;
  onFlip: () => void;
}) {
  return (
    <motion.div
      layout="position"
      className={`order${flippable ? ' flippable' : ''}${cancelled ? ' cancelled' : ''}`}
      onClick={flippable ? onFlip : undefined}
      // A fresh order drops in from the spotlight above the board.
      initial={fresh ? { y: -160, scale: 2.2, opacity: 0 } : false}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 170, damping: 20 }}
      title={flippable ? 'Lật đơn này' : undefined}
    >
      <motion.div
        className="order-rot"
        // Natural orientation shows half 1 on the right (the ✓ side); rotate 180° to put half 0 there.
        initial={fresh ? { rotate: 0 } : false}
        animate={{ rotate: order.side === 1 ? 0 : 180 }}
        transition={{ type: 'spring', stiffness: 120, damping: 12, delay: fresh ? 0.35 : 0 }}
      >
        <div className="card">
          <CardFace card={order.card} dimSide={order.side === 1 ? 0 : 1} />
        </div>
      </motion.div>
      {order.lockedBy && (
        <motion.img
          className="lock-badge"
          initial={{ scale: 4, y: -120, rotate: -40, opacity: 0 }}
          animate={{ scale: 1, y: 0, rotate: 10, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          src={GORILLA_META[order.lockedBy].img}
          alt={GORILLA_META[order.lockedBy].name}
        />
      )}
      {cancelled && (
        <motion.div className="cancel-mark" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          HỦY
        </motion.div>
      )}
    </motion.div>
  );
}

export function OrderBoard({
  view,
  canFlip,
  onFlip,
  showCancelled,
}: {
  view: GameView;
  canFlip: boolean;
  onFlip: (orderId: string) => void;
  showCancelled: boolean;
}) {
  const cancelled = new Set(showCancelled ? view.reveal?.cancelledOrderIds : []);
  const tally = emptyTally();
  for (const o of view.orders) {
    if (cancelled.has(o.id)) continue;
    const h = orderedHalf(o);
    tally[h.fruit] += h.count;
  }
  const freshId = view.event?.type === 'order' || view.event?.type === 'flip' ? view.event.orderId : null;
  const dense = view.orders.length > 8 ? (view.orders.length > 15 ? ' dense2' : ' dense') : '';

  return (
    <div className="board">
      <div className="board-head">
        <img src="/assets/order_board.webp" alt="Bảng đơn hàng" draggable={false} />
      </div>
      <div className={`orders${dense}`}>
        {view.orders.length === 0 && <div className="orders-empty">Chưa có đơn nào</div>}
        {view.orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            fresh={o.id === freshId && view.event?.type === 'order'}
            cancelled={cancelled.has(o.id)}
            flippable={canFlip && !o.lockedBy}
            onFlip={() => onFlip(o.id)}
          />
        ))}
      </div>
      <div className="tally">
        {FRUITS.map((f) => (
          <motion.span
            // Re-keyed on value change so the chip pops whenever its total changes.
            key={`${f}${tally[f]}`}
            className={`chip${tally[f] ? '' : ' zero'}`}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 12 }}
          >
            <img src={FRUIT_META[f].img} alt={FRUIT_META[f].name} />
            <b>{tally[f]}</b>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

export function WastedGorillas({ view }: { view: GameView }) {
  return (
    <div className="wasted">
      <AnimatePresence>
        {view.wasted.map((w) => (
          <motion.img
            key={w.gorilla}
            className="wasted-card"
            src={GORILLA_META[w.gorilla].img}
            alt={GORILLA_META[w.gorilla].name}
            title={`${GORILLA_META[w.gorilla].name} — không có đơn để lật`}
            initial={{ scale: 3, y: -80, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, y: 0, rotate: -6, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 140, damping: 12 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function TableCard({ view, dealKey, deal }: { view: GameView; dealKey: string; deal: boolean }) {
  if (!view.tableCard) return null;
  return (
    <div className="table-card">
      <motion.div
        key={dealKey}
        initial={deal ? { scale: 0.3, opacity: 0, rotate: 90 } : false}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14, delay: deal ? 0.9 : 0 }}
      >
        <FlipCard card={view.tableCard} faceUp className="seat-card" startFaceDown={deal} delay={deal ? 1.3 : 0} />
      </motion.div>
      <span>Kho chung</span>
    </div>
  );
}
