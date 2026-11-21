import { StatAvatar } from './dele.tsx';

/**
 * A Medlem's avatar with the Barometer's clown makeover: 1 = full clown
 * (rainbow wig, hat, red nose, smile), 2 = hat and nose, 3 = nose, 0 = none.
 * `size` is the avatar's diameter; the hat and wig stick out around it.
 */
export function KlovnAvatar({ medlemId, niveau, size }: { medlemId: string; niveau: 0 | 1 | 2 | 3; size: number }) {
  if (niveau === 1) {
    // Drawn on a 150×138 box with an 88px avatar at (31, 34).
    const k = size / 88;
    return (
      <span className="klovn" style={{ width: 150 * k, height: 138 * k }}>
        <svg className="klovn__lag" width={150 * k} height={138 * k} viewBox="0 0 150 138" aria-hidden="true">
          <circle cx="26" cy="74" r="14" fill="var(--color-danger)" />
          <circle cx="20" cy="94" r="13" fill="var(--color-success)" />
          <circle cx="30" cy="54" r="12" fill="var(--color-accent-text)" />
          <circle cx="124" cy="74" r="14" fill="var(--color-danger)" />
          <circle cx="130" cy="94" r="13" fill="var(--color-success)" />
          <circle cx="120" cy="54" r="12" fill="var(--color-accent-text)" />
        </svg>
        <span className="klovn__avatar" style={{ left: 31 * k, top: 34 * k }}>
          <StatAvatar medlemId={medlemId} size={size} />
        </span>
        <svg className="klovn__lag" width={150 * k} height={138 * k} viewBox="0 0 150 138" aria-hidden="true">
          <polygon points="75,0 98,42 52,42" fill="var(--color-rose)" />
          <circle cx="70" cy="22" r="3" fill="#FFFFFF" />
          <circle cx="81" cy="32" r="3" fill="#FFFFFF" />
          <circle cx="64" cy="36" r="3" fill="#FFFFFF" />
          <circle cx="75" cy="2" r="7" fill="#FFFFFF" />
          <rect x="48" y="38" width="54" height="8" rx="4" fill="#FFFFFF" />
          <circle cx="75" cy="92" r="11" fill="var(--color-klovn-naese)" />
          <circle cx="72" cy="89" r="3" fill="var(--color-klovn-glans)" />
          <path d="M58 106 Q75 118 92 106" fill="none" stroke="var(--color-klovn-naese)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (niveau === 2) {
    // A 44×56 box with a 40px avatar at (2, 14).
    const k = size / 40;
    return (
      <span className="klovn" style={{ width: 44 * k, height: 56 * k }}>
        <span className="klovn__avatar" style={{ left: 2 * k, top: 14 * k }}>
          <StatAvatar medlemId={medlemId} size={size} />
        </span>
        <svg className="klovn__lag" width={44 * k} height={56 * k} viewBox="0 0 44 56" aria-hidden="true">
          <polygon points="22,1 32,17 12,17" fill="var(--color-rose)" />
          <circle cx="22" cy="2" r="3" fill="#FFFFFF" />
          <rect x="10" y="15" width="24" height="4" rx="2" fill="#FFFFFF" />
          <circle cx="22" cy="40" r="5" fill="var(--color-klovn-naese)" />
        </svg>
      </span>
    );
  }
  if (niveau === 3) {
    return (
      <span className="klovn" style={{ width: size, height: size }}>
        <span className="klovn__avatar" style={{ left: 0, top: 0 }}>
          <StatAvatar medlemId={medlemId} size={size} />
        </span>
        <span
          className="klovn__naese"
          style={{ left: size * 0.375, top: size * 0.575, width: size * 0.25, height: size * 0.25 }}
          aria-hidden="true"
        />
      </span>
    );
  }
  return <StatAvatar medlemId={medlemId} size={size} />;
}
