import { initialer } from './initialer.ts';
import './Avatar.css';

interface AvatarProps {
  navn: string;
  /** Diameter in px. */
  size?: number;
  /** Your own avatar: main colour instead of pale blue. */
  egen?: boolean;
  /** A Medlem who has not logged in yet: dashed ring, no fill. */
  stiplet?: boolean;
  /** A former (Udmeldt) Medlem: grey. */
  tidligere?: boolean;
}

/** A Medlem's initials on a round tile. */
export function Avatar({ navn, size = 44, egen = false, stiplet = false, tidligere = false }: AvatarProps) {
  const variant = egen ? ' avatar--egen' : stiplet ? ' avatar--stiplet' : tidligere ? ' avatar--tidligere' : '';
  return (
    <span
      className={`avatar${variant}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initialer(navn)}
    </span>
  );
}
