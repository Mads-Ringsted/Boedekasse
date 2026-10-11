import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { T } from '../components/T.tsx';
import { t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { authErrorText } from './errors.ts';
import { CODE_LENGTH, cleanCode, looksLikeEmail, normalizeEmail } from './input.ts';
import {
  clearPendingLogin,
  loadPendingLogin,
  resendWaitSeconds,
  savePendingLogin,
  type PendingLogin,
} from './pending.ts';
import './LogInd.css';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const store = () => storage() ?? noStorage;

async function sendCode(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
}

/**
 * Log ind: email → "Send kode" → "Tjek din mail" with six digit boxes.
 * The pending email and step are saved, so a relaunch returns to the code.
 * A successful code logs in; the AuthProvider then swaps the screen.
 */
export function LogInd() {
  const [pending, setPending] = useState<PendingLogin | null>(() => loadPendingLogin(store()));
  const [email, setEmail] = useState(pending?.email ?? '');

  const onSent = (sent: PendingLogin) => {
    savePendingLogin(store(), sent);
    setPending(sent);
  };

  if (pending) {
    return (
      <CodeStep
        pending={pending}
        onResent={onSent}
        onBack={() => {
          clearPendingLogin(store());
          setPending(null);
        }}
      />
    );
  }
  return <EmailStep email={email} onEmailChange={setEmail} onSent={onSent} />;
}

function EmailStep({
  email,
  onEmailChange,
  onSent,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onSent: (pending: PendingLogin) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = looksLikeEmail(email);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const normalized = normalizeEmail(email);
    const { error } = await sendCode(normalized);
    setBusy(false);
    if (error) setError(authErrorText(error));
    else onSent({ email: normalized, sentAt: Date.now() });
  }

  return (
    <form className="login login--email" onSubmit={submit} noValidate>
      <img className="login__logo" src="/app-icon.svg" width={56} height={56} alt="" />
      <h1 className="login__title">{t('logInd.titel')}</h1>
      <p className="login__lead">{t('logInd.intro')}</p>

      <label className="login__field">
        <span className="login__label">{t('logInd.email')}</span>
        <input
          className="login__input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          value={email}
          onChange={(e) => {
            onEmailChange(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </label>
      {error && (
        <p id="login-error" className="login__error" role="alert">
          {error}
        </p>
      )}

      <button className="login__primary" type="submit" disabled={!valid || busy}>
        {t('logInd.sendKode')}
      </button>
    </form>
  );
}

function CodeStep({
  pending,
  onResent,
  onBack,
}: {
  pending: PendingLogin;
  onResent: (pending: PendingLogin) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on arrival and again after a failed check (the input is disabled while checking).
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const wait = resendWaitSeconds(pending, now);
  useEffect(() => {
    if (wait === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [wait]);

  async function verify(token: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'email' });
    if (error) {
      setBusy(false);
      setError(authErrorText(error));
      setCode('');
    } else {
      clearPendingLogin(store()); // the AuthProvider now shows the app
    }
  }

  async function resend() {
    if (wait > 0 || busy) return;
    setError(null);
    setNotice(null);
    const { error } = await sendCode(pending.email);
    if (error) {
      setError(authErrorText(error));
    } else {
      const sentAt = Date.now();
      setNow(sentAt);
      setCode('');
      setNotice(t('logInd.nyKodeSendt'));
      onResent({ email: pending.email, sentAt });
      inputRef.current?.focus();
    }
  }

  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <div className="login login--code">
      <button className="login__back" type="button" onClick={onBack}>
        <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
        {t('sheet.tilbage')}
      </button>

      <h1 className="login__title">{t('logInd.tjekMail')}</h1>
      <p className="login__lead">
        <T id="logInd.kodeSendt" values={{ email: <span className="login__email">{pending.email}</span> }} />
      </p>

      <label className="login__code">
        <input
          ref={inputRef}
          className="login__code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          disabled={busy}
          value={code}
          aria-label={t('logInd.kodeLabel')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const next = cleanCode(e.target.value);
            setCode(next);
            setError(null);
            if (next.length === CODE_LENGTH) void verify(next);
          }}
        />
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`login__digit${focused && !busy && i === activeIndex ? ' login__digit--active' : ''}`}
          >
            {code[i] ?? (focused && !busy && i === activeIndex ? <span className="login__caret" /> : null)}
          </span>
        ))}
      </label>

      {error && (
        <p id="login-error" className="login__error" role="alert">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="login__notice" role="status">
          {notice}
        </p>
      )}

      <button className="login__link" type="button" onClick={resend} disabled={wait > 0 || busy}>
        {wait > 0 ? t('logInd.sendNyKodeOm', { sekunder: wait }) : t('logInd.sendNyKode')}
      </button>
    </div>
  );
}
