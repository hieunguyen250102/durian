import { useRef } from 'react';
import { motion } from 'framer-motion';
import type { Card, Half } from '../../../shared/types';
import { FRUIT_META, GORILLA_META } from '../meta';

function HalfView({ half, dim, onClick }: { half: Half; dim?: boolean; onClick?: () => void }) {
  const meta = FRUIT_META[half.fruit];
  return (
    <div
      className={`half n${half.count}${dim ? ' dim' : ''}${onClick ? ' pickable' : ''}`}
      style={{ background: meta.tint }}
      onClick={onClick}
    >
      <div className="fruits">
        {Array.from({ length: half.count }, (_, i) => (
          <img key={i} src={meta.img} alt={meta.name} draggable={false} />
        ))}
      </div>
      <span className="count" style={{ background: meta.color }}>
        {half.count}
      </span>
    </div>
  );
}

/** Face of a card. `dimSide` greys out the half that was not ordered. */
export function CardFace({
  card,
  dimSide,
  onPick,
}: {
  card: Card;
  dimSide?: 0 | 1;
  onPick?: (side: 0 | 1) => void;
}) {
  if (card.kind === 'gorilla') {
    return <div className="card-face gorilla" style={{ backgroundImage: `url(${GORILLA_META[card.gorilla].img})` }} />;
  }
  return (
    <div className="card-face fruit">
      <HalfView half={card.halves[0]} dim={dimSide === 0} onClick={onPick && (() => onPick(0))} />
      <div className="divider" />
      <HalfView half={card.halves[1]} dim={dimSide === 1} onClick={onPick && (() => onPick(1))} />
    </div>
  );
}

export function CardBack() {
  return <div className="card-face back" />;
}

/** A card that animates between face down and face up. */
export function FlipCard({
  card,
  faceUp,
  className = '',
  delay = 0,
  startFaceDown = false,
}: {
  card: Card | null;
  faceUp: boolean;
  className?: string;
  delay?: number;
  startFaceDown?: boolean;
}) {
  const showFront = faceUp && !!card;
  // The delay only staggers the first (deal) flip; later flips such as the reveal happen at once.
  const first = useRef(true);
  return (
    <div className={`card flip ${className}`}>
      <motion.div
        className="flip-inner"
        initial={startFaceDown ? { rotateY: 180 } : false}
        animate={{ rotateY: showFront ? 0 : 180 }}
        transition={{ duration: 0.6, delay: first.current ? delay : 0, ease: [0.3, 1.4, 0.5, 1] }}
        onAnimationComplete={() => (first.current = false)}
      >
        <div className="flip-front">{card ? <CardFace card={card} /> : <CardBack />}</div>
        <div className="flip-back">
          <CardBack />
        </div>
      </motion.div>
    </div>
  );
}
