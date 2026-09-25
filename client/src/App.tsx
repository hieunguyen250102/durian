import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from './net';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { Table } from './components/Table';

// Warm the image cache so cards don't pop in mid-animation.
const PRELOAD = [
  'card_back', 'card_stand', 'order_board', 'handbell',
  'fruit_strawberry', 'fruit_banana', 'fruit_grape', 'fruit_durian',
  'gorilla_mitch_cancel_three', 'gorilla_murphy_zero', 'gorilla_hanna_unlimited_banana',
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `anger_0${n}`),
];

export function App() {
  const { connected, view, toast, join, act, leave, rejoining, chat, sendChat, account, login, logout } = useGame();
  const [shownToast, setShownToast] = useState(toast);

  useEffect(() => {
    for (const name of PRELOAD) new Image().src = `/assets/${name}.webp`;
  }, []);

  useEffect(() => {
    setShownToast(toast);
    if (!toast) return;
    const t = setTimeout(() => setShownToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  let screen;
  if (!view) screen = (
      <Home connected={connected} busy={rejoining} onJoin={join} account={account} onLogin={login} onLogout={logout} />
    );
  else if (view.phase === 'lobby') screen = <Lobby view={view} act={act} leave={leave} chat={chat} sendChat={sendChat} />;
  else screen = (
      <Table view={view} act={act} leave={leave} connected={connected} chat={chat} sendChat={sendChat} />
    );

  return (
    <>
      {screen}
      <AnimatePresence>
        {shownToast && (
          <motion.div
            key={shownToast.id}
            className="toast"
            initial={{ y: -60, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: -60, x: '-50%', opacity: 0 }}
          >
            {shownToast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
