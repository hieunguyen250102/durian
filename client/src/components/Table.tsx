import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useAnimationControls } from 'framer-motion';
import type { ChatMessage, ClientAction, GameView } from '../../../shared/types';
import { isMuted, setMuted, sfx } from '../sound';
import { eventIsFresh } from '../net';
import { GORILLA_META } from '../meta';
import { CardFace } from './Card';
import { Bell, Deck, OrderBoard, TableCard, TokenPile, WastedGorillas } from './Center';
import { GameOver, RevealPanel } from './Reveal';
import { RulesButton } from './Rules';
import { Seat, type SeatProps } from './Seat';
import { ChatPanel, useBubbles, useUnread } from './Chat';

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Reveal stages after the bell rings:
 * 1 = bell ringing, 2 = cards flipped and tally counting, 3 = verdict and token flies, 4 = game-over screen.
 * Clients that load mid-reveal jump straight to the final stage.
 */
function useEventEffects(view: GameView, shake: () => void) {
  const [stage, setStage] = useState(4);
  const [ringKey, setRingKey] = useState(0);
  const [dealRound, setDealRound] = useState<number | null>(null);
  const lastSeq = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ev = view.event;
    if (!ev) return;
    if (!eventIsFresh() || ev.seq === lastSeq.current) {
      lastSeq.current = ev.seq;
      return;
    }
    lastSeq.current = ev.seq;
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

    switch (ev.type) {
      case 'deal':
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setStage(4);
        setDealRound(ev.round);
        for (let i = 0; i <= view.players.length; i++) sfx.card(i * 0.15);
        later(view.players.length * 150 + 500, () => sfx.flip());
        break;
      case 'draw':
        sfx.card();
        later(250, ev.card.kind === 'gorilla' ? sfx.gorilla : sfx.flip);
        break;
      case 'order':
        sfx.pop();
        break;
      case 'flip':
        sfx.gorilla();
        later(300, sfx.flip);
        break;
      case 'wasted':
        sfx.gorilla();
        break;
      case 'bell': {
        setStage(1);
        setRingKey((k) => k + 1);
        sfx.bell();
        shake();
        later(1500, () => {
          setStage(2);
          sfx.flip();
        });
        later(3700, () => {
          setStage(3);
          sfx.angry();
          shake();
        });
        if (view.phase === 'gameOver') {
          later(5600, () => {
            setStage(4);
            sfx.win();
          });
        }
        break;
      }
      case 'join':
        sfx.tick();
        break;
    }
  }, [view.event?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { stage, ringKey, dealRound };
}

export function Table({
  view,
  act,
  leave,
  connected,
  chat,
  sendChat,
}: {
  view: GameView;
  act: (a: ClientAction) => void;
  leave: () => void;
  connected: boolean;
  chat: ChatMessage[];
  sendChat: (text: string) => void;
}) {
  const [areaRef, size] = useSize<HTMLDivElement>();
  const shakeCtl = useAnimationControls();
  const shake = () => void shakeCtl.start({ x: [0, -10, 9, -7, 6, -3, 0], transition: { duration: 0.5 } });
  const { stage, ringKey, dealRound } = useEventEffects(view, shake);
  const [muted, setMutedState] = useState(isMuted());
  const [logOpen, setLogOpen] = useState(false);
  const [sideTab, setSideTab] = useState<'chat' | 'log'>('chat');
  const drawerMode = useMediaQuery('(max-width: 900px)');
  const chatVisible = sideTab === 'chat' && (!drawerMode || logOpen);
  const unread = useUnread(chat, view.you, chatVisible);
  const bubbles = useBubbles(chat);
  const lastChat = chat.at(-1);
  useEffect(() => {
    if (lastChat && lastChat.playerId !== view.you && Date.now() - lastChat.at < 3000) sfx.tick();
  }, [lastChat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hideGameOver, setHideGameOver] = useState(false);

  const n = view.players.length;
  const meIdx = Math.max(0, view.players.findIndex((p) => p.id === view.you));
  const me = view.players[meIdx];
  const myTurn = view.activePlayerId === view.you;
  const revealing = view.phase === 'reveal' || view.phase === 'gameOver';
  const r = view.reveal;
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? '';
  const active = view.players.find((p) => p.id === view.activePlayerId);

  const canDraw = myTurn && view.phase === 'turn' && view.deckCount > 0;
  const canCall = myTurn && view.phase === 'turn' && !!view.prevActivePlayerId && view.prevActivePlayerId !== view.you;
  const mustCall = myTurn && view.phase === 'turn' && view.deckCount === 0;

  useEffect(() => {
    if (view.phase !== 'gameOver') setHideGameOver(false);
  }, [view.phase]);

  // ---- geometry: seats on an ellipse, you at the bottom, next player (your left) clockwise ----
  const compact = size.w < 700;
  const cardW = Math.max(74, Math.min(170, size.w * (compact ? 0.2 : 0.15)));
  const seatH = cardW / 2.35 + 70;
  const rx = Math.max(0, size.w / 2 - cardW / 2 - 14);
  const ry = Math.max(0, size.h / 2 - seatH / 2 - 6);
  const centerW = n === 2 ? Math.min(600, size.w - 24) : Math.min(560, size.w - 2 * (cardW + 16));
  const centerH = Math.min(380, size.h - 2 * seatH - 4);

  // During the reveal the penalty token waits in the pile until the verdict, then flies to the loser.
  const heldToken = revealing && r && stage < 3 ? r.token : null;
  const pileTokens = heldToken ? [...view.remainingTokens, heldToken] : view.remainingTokens;

  const seats: (SeatProps & { key: string })[] = view.players.map((p, i) => {
    const rel = (i - meIdx + n) % n;
    const theta = ((90 + (rel * 360) / n) * Math.PI) / 180;
    const firstIdx = view.players.findIndex((q) => q.id === view.activePlayerId);
    const dealOrder = (i - Math.max(0, firstIdx) + n) % n;
    let tag: SeatProps['tag'];
    if (revealing && r) {
      if (stage >= 3 && p.id === r.loserId) tag = { text: `😡 +${r.token}`, tone: 'loser' };
      else if (p.id === r.callerId) tag = { text: '🔔 Gọi quản lý', tone: 'caller' };
      else if (p.id === r.calledId) tag = { text: 'Bị gọi', tone: 'called' };
      if (view.phase === 'gameOver' && stage >= 4 && view.winnerIds.includes(p.id)) tag = { text: '👑 Thắng', tone: 'winner' };
    } else if (p.id === view.activePlayerId) tag = { text: 'Đang đi', tone: 'active' };
    else if (p.id === view.prevActivePlayerId) tag = { text: 'Vừa đi', tone: 'prev' };
    return {
      key: p.id,
      player: p,
      x: Math.cos(theta) * rx,
      y: Math.sin(theta) * ry,
      isMe: p.id === view.you,
      faceUp: p.id === view.you ? revealing && stage >= 2 : true,
      tokens: p.id === r?.loserId && heldToken ? p.tokens.filter((t) => t !== heldToken) : p.tokens,
      tag,
      dealKey: `${view.round}-${p.id}`,
      deal: dealRound === view.round ? { delay: dealOrder * 0.15 } : null,
      shaking: revealing && stage === 3 && p.id === r?.loserId,
      bubble: bubbles[p.id],
      onKick: me?.isHost && !p.connected && p.id !== view.you ? () => act({ type: 'kick', playerId: p.id }) : undefined,
    };
  });

  let status: React.ReactNode;
  let actions: React.ReactNode = null;
  if (view.phase === 'turn') {
    if (myTurn) {
      status = mustCall ? 'Hết bài! Bạn phải gọi quản lý.' : 'Đến lượt bạn: nhận thêm đơn hay gọi quản lý?';
      actions = (
        <>
          <button className="btn primary" disabled={!canDraw} onClick={() => act({ type: 'draw' })}>
            🃏 Nhận đơn
          </button>
          <button className="btn danger" disabled={!canCall} onClick={() => act({ type: 'call' })}>
            🔔 Gọi quản lý{view.prevActivePlayerId ? ` (${name(view.prevActivePlayerId)})` : ''}
          </button>
        </>
      );
    } else status = <>Đang chờ <b>{active?.name}</b> quyết định…</>;
  } else if (view.phase === 'choosing') {
    status = myTurn ? 'Chạm vào nửa thẻ bạn muốn nhận đơn.' : <><b>{active?.name}</b> đang chọn đơn…</>;
  } else if (view.phase === 'gorilla') {
    status = myTurn ? 'Khỉ đột! Chạm vào một đơn trên bảng để lật ngược.' : <><b>{active?.name}</b> đang chọn đơn để lật…</>;
  } else if (view.phase === 'reveal' && r) {
    const ready = r.readyIds.includes(view.you);
    const waiting = view.players.filter((p) => p.connected && !r.readyIds.includes(p.id)).length;
    status = stage < 3 ? 'Quản lý đang kiểm kho…' : `Vòng tiếp theo bắt đầu khi mọi người sẵn sàng (còn ${waiting}).`;
    if (stage >= 3)
      actions = (
        <>
          <button className="btn primary" disabled={ready} onClick={() => act({ type: 'ready' })}>
            {ready ? '✓ Đã sẵn sàng' : '▶ Sẵn sàng vòng mới'}
          </button>
          {me?.isHost && (
            <button className="btn ghost" onClick={() => act({ type: 'forceNext' })}>
              Bắt đầu luôn
            </button>
          )}
        </>
      );
  } else if (view.phase === 'gameOver') {
    status = stage < 4 ? 'Quản lý đang kiểm kho…' : `Ván kết thúc! Người thắng: ${view.winnerIds.map(name).join(', ')}`;
    if (stage >= 4 && hideGameOver)
      actions = (
        <button className="btn primary" onClick={() => setHideGameOver(false)}>
          🏆 Xem kết quả
        </button>
      );
  }

  return (
    <div className="game">
      <header className="topbar">
        <div className="tb-left">
          <img src="/assets/fruit_durian.webp" alt="" className="tb-logo" />
          <span className="tb-title">DURIAN</span>
          <span className="pill">Phòng {view.roomCode}</span>
          <span className="pill">Vòng {view.round}</span>
        </div>
        <div className="tb-right">
          <RulesButton />
          <button
            className="btn ghost small"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn ghost small log-toggle" onClick={() => setLogOpen((o) => !o)} title="Chat & nhật ký">
            💬
            <AnimatePresence>
              {unread > 0 && (
                <motion.span className="unread" key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            className="btn ghost small"
            onClick={() => window.confirm('Rời phòng? Bạn sẽ mất ghế trong ván này.') && leave()}
          >
            Rời
          </button>
        </div>
      </header>

      {!connected && <div className="conn-banner">Mất kết nối, đang thử kết nối lại…</div>}

      <LayoutGroup>
        <motion.main
          className="table-area"
          ref={areaRef}
          animate={shakeCtl}
          style={{ '--card-w': `${cardW}px` } as React.CSSProperties}
        >
          <div className="felt" />
          {size.w > 0 && (
            <>
              <div
                className={`center${revealing && stage >= 2 ? ' revealing' : ''}`}
                style={{ width: centerW, height: Math.max(170, centerH) }}
              >
                <div className="center-col side">
                  <Deck count={view.deckCount} canDraw={canDraw} onDraw={() => act({ type: 'draw' })} />
                  <TokenPile tokens={pileTokens} />
                  <TableCard view={view} dealKey={`${view.round}-table`} deal={dealRound === view.round} />
                </div>
                <div className="center-col main">
                  <OrderBoard
                    view={view}
                    canFlip={myTurn && view.phase === 'gorilla'}
                    onFlip={(orderId) => act({ type: 'flip', orderId })}
                    showCancelled={revealing && stage >= 2}
                  />
                </div>
                <div className="center-col side">
                  <Bell canRing={canCall} ringKey={ringKey} onRing={() => act({ type: 'call' })} />
                  <WastedGorillas view={view} />
                </div>

                <AnimatePresence>
                  {revealing && stage >= 2 && <RevealPanel key={`reveal-${view.round}`} view={view} stage={stage} />}
                </AnimatePresence>
              </div>

              {seats.map(({ key, ...s }) => (
                <Seat key={key} {...s} />
              ))}

              <AnimatePresence>
                {revealing && stage === 1 && r && (
                  <motion.div
                    className="bell-callout"
                    initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                  >
                    <span className="big">🔔 GỌI QUẢN LÝ!</span>
                    <span>
                      {name(r.callerId)} ➜ {name(r.calledId)}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {view.phase === 'choosing' && view.pending && (
                  <motion.div
                    key="spot"
                    className="spotlight"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="card big"
                      initial={{ scale: 0.2, rotateY: 180, y: -40 }}
                      animate={{ scale: 1, rotateY: 0, y: 0 }}
                      transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                    >
                      <CardFace
                        card={view.pending}
                        onPick={myTurn ? (side) => act({ type: 'choose', side }) : undefined}
                      />
                    </motion.div>
                    <p>{myTurn ? 'Chọn nửa thẻ bạn muốn nhận làm đơn hàng' : `${active?.name} đang chọn đơn…`}</p>
                  </motion.div>
                )}
                {view.phase === 'gorilla' && view.pending?.kind === 'gorilla' && (
                  <motion.div
                    key="gorilla"
                    className="gorilla-banner"
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="card mid"
                      initial={{ scale: 0.2, rotate: -30 }}
                      animate={{ scale: 1, rotate: [0, -4, 4, -2, 0] }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    >
                      <CardFace card={view.pending} />
                    </motion.div>
                    <p>
                      <b>{GORILLA_META[view.pending.gorilla].name}</b> xuất hiện!{' '}
                      {myTurn ? 'Chọn một đơn để lật ngược.' : `${active?.name} đang chọn đơn để lật…`}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.main>
      </LayoutGroup>

      <aside className={`log${logOpen ? ' open' : ''}`}>
        <div className="side-tabs">
          <button className={sideTab === 'chat' ? 'on' : ''} onClick={() => setSideTab('chat')}>
            💬 Chat
            {unread > 0 && sideTab !== 'chat' && <span className="unread inline">{unread}</span>}
          </button>
          <button className={sideTab === 'log' ? 'on' : ''} onClick={() => setSideTab('log')}>
            📜 Nhật ký
          </button>
          {drawerMode && (
            <button className="side-close" onClick={() => setLogOpen(false)} aria-label="Đóng">
              ✕
            </button>
          )}
        </div>
        {sideTab === 'chat' ? (
          <ChatPanel messages={chat} you={view.you} onSend={sendChat} />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {[...view.log].reverse().map((l) => (
                <motion.li
                  key={l.id}
                  className={l.tone ?? ''}
                  initial={{ opacity: 0, x: 30, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                >
                  {l.text}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </aside>

      <footer className="actionbar">
        <motion.div className="status" key={String(status && view.phase + view.activePlayerId)} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          {status}
        </motion.div>
        <div className="actions">{actions}</div>
      </footer>

      <AnimatePresence>
        {view.phase === 'gameOver' && stage >= 4 && !hideGameOver && (
          <GameOver
            view={view}
            isHost={!!me?.isHost}
            onLobby={() => act({ type: 'backToLobby' })}
            onLeave={leave}
            onClose={() => setHideGameOver(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
