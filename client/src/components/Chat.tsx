import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CHAT_MAX_LENGTH, QUICK_EMOTES, type ChatMessage } from '../../../shared/types';
import { AVATAR_COLORS, AVATAR_EMOJI } from '../meta';

const time = (at: number) => new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function ChatPanel({
  messages,
  you,
  onSend,
  autoFocus = false,
}: {
  messages: ChatMessage[];
  you: string;
  onSend: (text: string) => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Follow new messages unless the reader has scrolled up to read history.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    stick.current = true;
  };

  return (
    <div className="chat">
      <div
        className="chat-list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.length === 0 && <div className="chat-empty">Chưa có tin nhắn. Chào mọi người đi! 👋</div>}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const mine = m.playerId === you;
            const grouped = i > 0 && messages[i - 1].playerId === m.playerId && m.at - messages[i - 1].at < 60_000;
            return (
              <motion.div
                key={m.id}
                className={`msg${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}${m.kind === 'emote' ? ' emote' : ''}`}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              >
                {!mine && !grouped && (
                  <span className="msg-avatar" style={{ background: AVATAR_COLORS[m.avatar % 7] }}>
                    {AVATAR_EMOJI[m.avatar % 7]}
                  </span>
                )}
                <div className="msg-body">
                  {!mine && !grouped && <span className="msg-name">{m.name}</span>}
                  <span className="msg-text" title={time(m.at)}>
                    {m.text}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="emotes">
        {QUICK_EMOTES.map((e) => (
          <motion.button key={e} whileHover={{ scale: 1.25, y: -2 }} whileTap={{ scale: 0.85 }} onClick={() => send(e)}>
            {e}
          </motion.button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
          setDraft('');
        }}
      >
        <input
          value={draft}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Nhắn gì đó…"
          autoFocus={autoFocus}
          onChange={(e) => setDraft(e.target.value)}
          enterKeyHint="send"
        />
        <button className="btn secondary small" disabled={!draft.trim()} aria-label="Gửi">
          ➤
        </button>
      </form>
    </div>
  );
}

/** Tracks messages from others that arrived while the chat was hidden. */
export function useUnread(messages: ChatMessage[], you: string, visible: boolean) {
  const [seenId, setSeenId] = useState(() => messages.at(-1)?.id ?? 0);
  const lastId = messages.at(-1)?.id ?? 0;
  useEffect(() => {
    if (visible) setSeenId(lastId);
  }, [visible, lastId]);
  return messages.filter((m) => m.id > seenId && m.playerId !== you).length;
}

/**
 * Recent message per player, used for speech bubbles above seats. Each bubble lingers a few
 * seconds, longer for longer text.
 */
export function useBubbles(messages: ChatMessage[]) {
  const [bubbles, setBubbles] = useState<Record<string, ChatMessage>>({});
  const seen = useRef(messages.at(-1)?.id ?? 0);
  useEffect(() => {
    const fresh = messages.filter((m) => m.id > seen.current);
    if (fresh.length === 0) return;
    seen.current = fresh.at(-1)!.id;
    for (const m of fresh) {
      setBubbles((b) => ({ ...b, [m.playerId]: m }));
      const ttl = m.kind === 'emote' ? 2200 : Math.min(7000, 2500 + m.text.length * 60);
      window.setTimeout(() => {
        setBubbles((b) => {
          if (b[m.playerId]?.id !== m.id) return b;
          const { [m.playerId]: _, ...rest } = b;
          return rest;
        });
      }, ttl);
    }
  }, [messages]);
  return bubbles;
}
