import { useState } from 'react';
import { motion } from 'framer-motion';
import { savedName } from '../net';
import { FRUIT_META } from '../meta';
import { FRUITS } from '../../../shared/types';
import { RulesButton } from './Rules';

export function Home({
  connected,
  busy,
  onJoin,
}: {
  connected: boolean;
  busy: boolean;
  onJoin: (name: string, roomCode?: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '');
  const [pending, setPending] = useState(false);
  const disabled = !connected || busy || pending || !name.trim();

  const submit = async (roomCode?: string) => {
    setPending(true);
    await onJoin(name.trim(), roomCode);
    setPending(false);
  };

  return (
    <div className="home">
      <div className="floaters" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <motion.img
            key={i}
            src={FRUIT_META[FRUITS[i % 4]].img}
            className="floater"
            style={{ left: `${(i * 37) % 100}%`, width: 36 + ((i * 13) % 40) }}
            initial={{ y: '110vh', rotate: 0 }}
            animate={{ y: '-20vh', rotate: i % 2 ? 360 : -360 }}
            transition={{ duration: 14 + (i % 5) * 3, repeat: Infinity, delay: i * 1.3, ease: 'linear' }}
          />
        ))}
      </div>

      <motion.div
        className="home-card"
        initial={{ y: 40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
      >
        <div className="logo">
          <motion.img
            src="/assets/fruit_durian.webp"
            alt=""
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ repeat: Infinity, duration: 3, repeatDelay: 1 }}
          />
          <h1>DURIAN</h1>
          <p>Cửa hàng trái cây của quản lý khó tính</p>
        </div>

        <label className="field">
          <span>Tên của bạn</span>
          <input
            value={name}
            maxLength={16}
            placeholder="VD: Hiếu"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !disabled && submit(code || undefined)}
          />
        </label>

        <button className="btn primary big" disabled={disabled} onClick={() => submit()}>
          🏪 Tạo phòng mới
        </button>

        <div className="or">hoặc vào phòng có sẵn</div>
        <div className="join-row">
          <input
            className="code-input"
            value={code}
            maxLength={4}
            placeholder="MÃ"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && !disabled && code.length === 4 && submit(code)}
          />
          <button className="btn secondary" disabled={disabled || code.length !== 4} onClick={() => submit(code)}>
            Vào phòng
          </button>
        </div>

        {!connected && (
          <p className="hint">
            <span className="spinner" /> Đang kết nối máy chủ… Máy chủ miễn phí có thể cần ~30–60 giây để khởi động.
          </p>
        )}
        <div className="home-foot">
          <RulesButton />
          <span>2–7 người chơi · Oink Games</span>
        </div>
      </motion.div>
    </div>
  );
}
