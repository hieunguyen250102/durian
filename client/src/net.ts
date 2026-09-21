import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { ChatMessage, ClientAction, GameView, JoinResult } from '../../shared/types';

// Set VITE_SERVER_URL when the client and server are deployed separately (Vercel + Render).
const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

export const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

// Tracks whether the latest state carries an event that happened while we were watching, so
// animations play for live moves but not when (re)loading into a room.
let lastState: GameView | null = null;
let fresh = false;
socket.on('state', (v: GameView) => {
  fresh = !!lastState && lastState.roomCode === v.roomCode && (v.event?.seq ?? 0) > (lastState.event?.seq ?? 0);
  lastState = v;
});
export const eventIsFresh = () => fresh;

interface Session {
  roomCode: string;
  sessionId: string;
  name: string;
}

// Per-tab so several tabs can play as different people; survives a page refresh.
const SESSION_KEY = 'durian.session';
const NAME_KEY = 'durian.name';

function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function saveSession(s: Session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    localStorage.setItem(NAME_KEY, s.name);
  } catch {
    /* storage unavailable */
  }
}
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}
export function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [view, setView] = useState<GameView | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [rejoining, setRejoining] = useState(() => !!loadSession());
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const notify = useCallback((text: string) => setToast({ id: Date.now(), text }), []);

  useEffect(() => {
    const rejoin = () => {
      setConnected(true);
      const s = loadSession();
      if (!s) return setRejoining(false);
      socket.emit('join', s, (r: JoinResult) => {
        setRejoining(false);
        if (!r.ok) {
          clearSession();
          setView(null);
          notify(r.error);
        }
      });
    };
    const onDisconnect = () => setConnected(false);
    const onKicked = (msg: string) => {
      lastState = null;
      setChat([]);
      clearSession();
      setView(null);
      notify(msg);
    };
    const onChat = (m: ChatMessage) => setChat((c) => [...c.slice(-99), m]);
    socket.on('connect', rejoin);
    socket.on('disconnect', onDisconnect);
    socket.on('state', setView);
    socket.on('kicked', onKicked);
    socket.on('chatHistory', setChat);
    socket.on('chat', onChat);
    if (socket.connected) rejoin();
    return () => {
      socket.off('connect', rejoin);
      socket.off('disconnect', onDisconnect);
      socket.off('state', setView);
      socket.off('kicked', onKicked);
      socket.off('chatHistory', setChat);
      socket.off('chat', onChat);
    };
  }, [notify]);

  const join = useCallback(
    (name: string, roomCode?: string) =>
      new Promise<JoinResult>((resolve) => {
        socket.emit('join', { name, roomCode }, (r: JoinResult) => {
          if (r.ok) {
            saveSession({ roomCode: r.roomCode, sessionId: r.sessionId, name });
            const url = new URL(window.location.href);
            url.searchParams.set('room', r.roomCode);
            window.history.replaceState(null, '', url);
          } else notify(r.error);
          resolve(r);
        });
      }),
    [notify],
  );

  const act = useCallback(
    (action: ClientAction) => {
      socket.emit('action', action, (r: { ok: boolean; error?: string }) => {
        if (!r.ok && r.error) notify(r.error);
      });
    },
    [notify],
  );

  const sendChat = useCallback(
    (text: string) => {
      socket.emit('chat', text, (r: { ok: boolean; error?: string }) => {
        if (!r.ok && r.error) notify(r.error);
      });
    },
    [notify],
  );

  const leave = useCallback(() => {
    socket.emit('leave');
    lastState = null;
    setChat([]);
    clearSession();
    setView(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  }, []);

  return { connected, view, toast, notify, join, act, leave, rejoining, chat, sendChat };
}
