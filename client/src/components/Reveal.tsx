import { useEffect, useState } from 'react';
import { animate, AnimatePresence, motion } from 'framer-motion';
import { FRUITS, type GameView } from '../../../shared/types';
import { FRUIT_META, GORILLA_META, sum, tokenImg } from '../meta';
import { Avatar } from './Lobby';

function CountUp({ to, delay }: { to: number; delay: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 0.8, delay, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to, delay]);
  return <>{v}</>;
}

/** Result panel shown over the middle of the table after the bell. */
export function RevealPanel({ view, stage }: { view: GameView; stage: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const r = view.reveal;
  if (!r) return null;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const loser = view.players.find((p) => p.id === r.loserId);
  const max = Math.max(1, ...FRUITS.map((f) => Math.max(r.inventory[f], r.ordered[f])));
  const over = r.overFruits.length > 0;

  if (collapsed) {
    return (
      <motion.button className="reveal-mini" onClick={() => setCollapsed(false)} initial={{ scale: 0 }} animate={{ scale: 1 }}>
        📋 Xem kết quả
      </motion.button>
    );
  }

  return (
    <motion.div
      className="reveal"
      initial={{ scale: 0.6, opacity: 0, y: 30 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <button className="collapse" onClick={() => setCollapsed(true)} title="Thu nhỏ để xem bàn">
        –
      </button>
      <h3>
        🔔 <b>{name(r.callerId)}</b> gọi quản lý vì <b>{name(r.calledId)}</b>
      </h3>

      <div className="cols">
        {FRUITS.map((f, i) => {
          const bad = r.overFruits.includes(f);
          return (
            <motion.div
              key={f}
              className={`col${bad && stage >= 3 ? ' bad' : ''}`}
              initial={{ y: 20, opacity: 0 }}
              animate={bad && stage >= 3 ? { y: 0, x: [0, -5, 5, -3, 3, 0], opacity: 1 } : { y: 0, opacity: 1 }}
              transition={{ delay: stage >= 3 ? 0 : i * 0.12, duration: 0.45 }}
            >
              <img src={FRUIT_META[f].img} alt={FRUIT_META[f].name} />
              <div className="meter">
                <motion.div
                  className="bar inv"
                  initial={{ height: 0 }}
                  animate={{ height: `${(r.inventory[f] / max) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.8 }}
                />
                <motion.div
                  className="bar ord"
                  initial={{ height: 0 }}
                  animate={{ height: `${(r.ordered[f] / max) * 100}%` }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.8 }}
                />
              </div>
              <div className="nums">
                <span title="Kho">
                  <CountUp to={r.inventory[f]} delay={0.2 + i * 0.12} />
                </span>
                <span title="Đơn">
                  <CountUp to={r.ordered[f]} delay={0.5 + i * 0.12} />
                </span>
              </div>
              <motion.span
                className="verdict"
                initial={{ scale: 0 }}
                animate={{ scale: stage >= 3 ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 12, delay: i * 0.08 }}
              >
                {bad ? '❌' : '✅'}
              </motion.span>
            </motion.div>
          );
        })}
        <div className="legend">
          <span className="inv">Kho</span>
          <span className="ord">Đơn</span>
        </div>
      </div>

      {r.inventoryGorillas.length > 0 && (
        <div className="reveal-gorillas">
          {r.inventoryGorillas.map((g) => (
            <span key={g}>
              <img src={GORILLA_META[g].img} alt="" />
              {GORILLA_META[g].inventory}
            </span>
          ))}
          {r.cancelledOrderIds.length > 0 && <em>{r.cancelledOrderIds.length} đơn bị hủy</em>}
        </div>
      )}

      <AnimatePresence>
        {stage >= 3 && loser && (
          <motion.div
            className={`verdict-banner${over ? ' over' : ' early'}`}
            initial={{ scale: 2.2, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            <motion.img
              src={tokenImg(r.token)}
              alt=""
              animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
              transition={{ duration: 0.7, delay: 0.3 }}
            />
            <div>
              <strong>
                {over ? 'Thiếu hàng!' : 'Đủ hàng!'} Quản lý nổi giận với {loser.name}!
              </strong>
              <span>
                {over
                  ? `${name(r.calledId)} nhận đơn vượt kho.`
                  : `${name(r.callerId)} gọi quản lý quá sớm.`}{' '}
                Nhận token {r.token} → tổng {sum(loser.tokens)} điểm.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const CONFETTI = ['strawberry', 'banana', 'grape', 'durian'] as const;

export function GameOver({
  view,
  isHost,
  onLobby,
  onLeave,
  onClose,
}: {
  view: GameView;
  isHost: boolean;
  onLobby: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const ranked = [...view.players].sort(
    (a, b) => sum(a.tokens) - sum(b.tokens) || a.tokens.length - b.tokens.length,
  );
  const iWon = view.winnerIds.includes(view.you);
  return (
    <motion.div className="modal-backdrop gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="confetti" aria-hidden>
        {Array.from({ length: 36 }, (_, i) => (
          <motion.img
            key={i}
            src={FRUIT_META[CONFETTI[i % 4]].img}
            style={{ left: `${(i * 29) % 100}%`, width: 22 + (i % 4) * 8 }}
            initial={{ y: -120, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 540 }}
            transition={{ duration: 3 + (i % 5) * 0.6, delay: (i % 12) * 0.15, repeat: Infinity, repeatDelay: 1, ease: 'easeIn' }}
          />
        ))}
      </div>
      <motion.div
        className="modal gameover-card"
        initial={{ scale: 0.5, y: 60 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14 }}
      >
        <button className="close" onClick={onClose} aria-label="Xem bàn">
          ✕
        </button>
        <h2>{iWon ? '🎉 Bạn là nhân viên xuất sắc!' : 'Kết thúc ca làm!'}</h2>
        <ol className="ranking">
          {ranked.map((p, i) => {
            const fired = sum(p.tokens) >= 7;
            const won = view.winnerIds.includes(p.id);
            return (
              <motion.li
                key={p.id}
                className={`${won ? 'won' : ''}${fired ? ' fired' : ''}`}
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.12 }}
              >
                <span className="rank">{won ? '👑' : i + 1}</span>
                <Avatar index={p.avatar} size={34} />
                <span className="rname">
                  {p.isBot && '🤖 '}
                  {p.name}
                </span>
                <span className="rtokens">
                  {p.tokens.map((t) => (
                    <img key={t} src={tokenImg(t)} alt={`${t}`} />
                  ))}
                </span>
                <b>{sum(p.tokens)}</b>
                {fired && <span className="fired-tag">Bị đuổi việc!</span>}
              </motion.li>
            );
          })}
        </ol>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onLeave}>
            Rời phòng
          </button>
          {isHost ? (
            <button className="btn primary big" onClick={onLobby}>
              🔁 Chơi ván mới
            </button>
          ) : (
            <span className="waiting">Chờ chủ phòng mở ván mới…</span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
