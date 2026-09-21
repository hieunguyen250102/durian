import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MAX_PLAYERS, MIN_PLAYERS, type ChatMessage, type ClientAction, type GameView } from '../../../shared/types';
import { AVATAR_COLORS, AVATAR_EMOJI } from '../meta';
import { RulesButton } from './Rules';
import { ChatPanel } from './Chat';

export function Avatar({ index, size = 44 }: { index: number; size?: number }) {
  return (
    <span className="avatar" style={{ background: AVATAR_COLORS[index % 7], width: size, height: size, fontSize: size * 0.5 }}>
      {AVATAR_EMOJI[index % 7]}
    </span>
  );
}

export function Lobby({
  view,
  act,
  leave,
  chat,
  sendChat,
}: {
  view: GameView;
  act: (a: ClientAction) => void;
  leave: () => void;
  chat: ChatMessage[];
  sendChat: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const me = view.players.find((p) => p.id === view.you);
  const isHost = !!me?.isHost;
  const link = `${window.location.origin}/?room=${view.roomCode}`;

  const copy = async () => {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) await navigator.share({ title: 'Durian', url: link });
      else await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="lobby">
      <motion.div className="lobby-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="lobby-head">
          <div>
            <div className="label">Mã phòng</div>
            <div className="room-code">{view.roomCode}</div>
          </div>
          <button className="btn secondary" onClick={copy}>
            {copied ? '✓ Đã sao chép' : '🔗 Mời bạn bè'}
          </button>
        </div>

        <div className="label">
          Nhân viên ({view.players.length}/{MAX_PLAYERS})
        </div>
        <div className="lobby-seats">
          <AnimatePresence>
            {view.players.map((p) => (
              <motion.div
                key={p.id}
                layout
                className={`lobby-seat${p.connected ? '' : ' offline'}`}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Avatar index={p.avatar} />
                <span className="name">
                  {p.name}
                  {p.id === view.you && <em> (bạn)</em>}
                </span>
                {p.isBot && <span className="bot-tag">🤖 Bot</span>}
                {p.isHost && <span className="badge">Chủ phòng</span>}
                {isHost && p.id !== view.you && (
                  <button className="kick" title="Mời ra" onClick={() => act({ type: 'kick', playerId: p.id })}>
                    ✕
                  </button>
                )}
              </motion.div>
            ))}
            {Array.from({ length: MAX_PLAYERS - view.players.length }, (_, i) =>
              isHost && i === 0 ? (
                <motion.button
                  key="add-bot"
                  layout
                  className="lobby-seat empty add-bot"
                  onClick={() => act({ type: 'addBot' })}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span className="avatar ghost">🤖</span>
                  <span className="name">+ Thêm bot</span>
                </motion.button>
              ) : (
                <div key={`empty${i}`} className="lobby-seat empty">
                  <span className="avatar ghost">?</span>
                  <span className="name">Ghế trống</span>
                </div>
              ),
            )}
          </AnimatePresence>
        </div>

        <div className="label">Trò chuyện</div>
        <div className="lobby-chat">
          <ChatPanel messages={chat} you={view.you} onSend={sendChat} />
        </div>

        <div className="lobby-actions">
          <button className="btn ghost" onClick={leave}>
            ← Rời phòng
          </button>
          <RulesButton className="btn ghost" />
          {isHost ? (
            <button
              className="btn primary big"
              disabled={view.players.length < MIN_PLAYERS}
              onClick={() => act({ type: 'start' })}
            >
              {view.players.length < MIN_PLAYERS ? `Cần ít nhất ${MIN_PLAYERS} người` : '🛎️ Mở cửa hàng!'}
            </button>
          ) : (
            <span className="waiting">Đang chờ chủ phòng bắt đầu…</span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
