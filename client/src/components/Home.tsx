import { useState } from 'react';
import { motion } from 'framer-motion';
import { useEmailLogin } from 'oink-kit/react';
import type { Session as Account } from 'oink-kit/client';
import { authClient, savedName } from '../net';
import { FRUIT_META } from '../meta';
import { FRUITS } from '../../../shared/types';
import { RulesButton } from './Rules';

export function Home({
  connected,
  busy,
  onJoin,
  account,
  onLogin,
  onLogout,
}: {
  connected: boolean;
  busy: boolean;
  onJoin: (name: string, roomCode?: string) => Promise<unknown>;
  account: Account | null;
  onLogin: (account: Account) => void;
  onLogout: () => void;
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

        {account ? (
          <>
            <div className="account">
              <span>
                <span className="dot">●</span> {account.user.email}
              </span>
              <button type="button" className="link" onClick={onLogout}>
                Đăng xuất
              </button>
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

            {account.user.canHost ? (
              <>
                <button className="btn primary big" disabled={disabled} onClick={() => submit()}>
                  🏪 Tạo phòng mới
                </button>
                <div className="or">hoặc vào phòng có sẵn</div>
              </>
            ) : (
              <p className="hint">Tài khoản này vào được phòng có sẵn, không tạo phòng mới được.</p>
            )}
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
          </>
        ) : (
          <LoginForm onLogin={onLogin} />
        )}

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

/** Email → 6-digit code. The behaviour lives in oink-kit's useEmailLogin; this is only Durian's look. */
function LoginForm({ onLogin }: { onLogin: (account: Account) => void }) {
  const login = useEmailLogin(authClient, { onLogin });
  const { email, code, busy, error, notice, devCode, cooldown } = login;

  if (login.step === 'email') {
    return (
      <form
        className="login"
        onSubmit={(e) => {
          e.preventDefault();
          void login.send();
        }}
      >
        <p className="hint">Đăng nhập bằng email: mình sẽ gửi cho bạn một mã 6 số.</p>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            placeholder="ban@vidu.com"
            onChange={(e) => login.setEmail(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="btn primary big" disabled={!login.emailOk || busy}>
          {busy ? 'Đang gửi…' : '✉️ Gửi mã đăng nhập'}
        </button>
      </form>
    );
  }

  return (
    <form
      className="login"
      onSubmit={(e) => {
        e.preventDefault();
        void login.verify();
      }}
    >
      <p className="hint">
        Đã gửi mã tới <b>{email.trim()}</b>. Xem cả thư mục Spam nếu chưa thấy.
      </p>
      <input
        ref={login.codeRef}
        className="code-input otp"
        value={code}
        onChange={(e) => login.typeCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        aria-label="Mã 6 số"
        autoFocus
      />
      {devCode && (
        <p className="hint">
          Máy chủ chưa cấu hình gửi mail (chế độ dev), mã là{' '}
          <button type="button" className="link" onClick={() => void login.verify(devCode)}>
            {devCode}
          </button>
        </p>
      )}
      {notice && !error && <p className="hint">{notice}</p>}
      {error && <p className="login-error">{error}</p>}
      <button type="submit" className="btn primary big" disabled={code.length !== 6 || busy}>
        {busy ? 'Đang kiểm tra…' : 'Xác nhận'}
      </button>
      <div className="login-links">
        <button type="button" className="link" onClick={login.changeEmail}>
          ← Đổi email
        </button>
        <button type="button" className="link" disabled={cooldown > 0 || busy} onClick={() => void login.send()}>
          {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
        </button>
      </div>
    </form>
  );
}
