import { AnimatePresence, motion } from 'framer-motion';
import type { ChatMessage, PlayerView } from '../../../shared/types';
import { FlipCard } from './Card';
import { Avatar } from './Lobby';
import { sum, tokenImg } from '../meta';

export interface SeatProps {
  player: PlayerView;
  x: number;
  y: number;
  isMe: boolean;
  faceUp: boolean;
  tokens: number[];
  tag?: { text: string; tone: 'active' | 'prev' | 'caller' | 'called' | 'loser' | 'winner' };
  /** Round key: remounting the card replays the deal animation. */
  dealKey: string;
  deal: { delay: number } | null;
  shaking: boolean;
  bubble?: ChatMessage;
  onKick?: () => void;
}

export function Seat({ player, x, y, isMe, faceUp, tokens, tag, dealKey, deal, shaking, bubble, onKick }: SeatProps) {
  return (
    <div
      className={`seat${isMe ? ' me' : ''}${tag?.tone === 'active' ? ' active' : ''}${player.connected ? '' : ' offline'}`}
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
    >
      <motion.div
        className="seat-inner"
        animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 0], rotate: [0, -2, 2, -1, 1, 0] } : { x: 0, rotate: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="stand-wrap">
          {player.hasCard && (
            <motion.div
              key={dealKey}
              className="dealt"
              initial={deal ? { x: -x, y: -y, scale: 0.35, rotate: -160, opacity: 0 } : false}
              animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 16, delay: deal?.delay ?? 0 }}
            >
              <FlipCard
                card={player.card}
                faceUp={faceUp}
                className="seat-card"
                delay={deal ? deal.delay + 0.5 : 0}
                startFaceDown={!!deal}
              />
              {isMe && !faceUp && <span className="secret">?</span>}
            </motion.div>
          )}
          <img className="stand" src="/assets/card_stand.webp" alt="" draggable={false} />
        </div>

        <div className="nameplate">
          <Avatar index={player.avatar} size={30} />
          <div className="who">
            <span className="pname">
              {player.isBot && '🤖 '}
              {player.name}
              {isMe && <em> (bạn)</em>}
            </span>
            <span className="points">{sum(player.tokens)} điểm giận</span>
          </div>
          <div className="tokens">
            {tokens.map((t) => (
              <motion.img
                key={t}
                layoutId={`token-${t}`}
                src={tokenImg(t)}
                className="token"
                alt={`Token ${t}`}
                transition={{ type: 'spring', stiffness: 90, damping: 14 }}
              />
            ))}
          </div>
        </div>

        <AnimatePresence>
          {tag && (
            <motion.span
              key={tag.text}
              className={`seat-tag ${tag.tone}`}
              initial={{ scale: 0, y: 6 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              {tag.text}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {bubble &&
            (bubble.kind === 'emote' ? (
              <motion.span
                key={bubble.id}
                className="emote-float"
                initial={{ y: 10, scale: 0.3, opacity: 0 }}
                animate={{ y: -70, scale: [0.3, 1.6, 1.3], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2, ease: 'easeOut' }}
              >
                {bubble.text}
              </motion.span>
            ) : (
              <motion.span
                key={bubble.id}
                className={`speech${y < 0 ? ' below' : ''}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              >
                {bubble.text}
              </motion.span>
            ))}
        </AnimatePresence>
        {!player.connected && (
          <span className="offline-badge">
            Mất kết nối
            {onKick && (
              <button className="kick" onClick={onKick} title="Mời ra khỏi phòng">
                ✕
              </button>
            )}
          </span>
        )}
      </motion.div>
    </div>
  );
}
