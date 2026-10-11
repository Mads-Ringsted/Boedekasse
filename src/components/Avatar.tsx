import { initialer } from './initialer.ts';
import './Avatar.css';

interface AvatarProps {
  navn: string;
  /** Diameter in px. */
  size?: number;
  /** Your own avatar: main colour instead of pale blue. */
  egen?: boolean;
}

/** A Medlem's initials on a round tile. */
export function Avatar({ navn, size = 44, egen = false }: AvatarProps) {
  return (
    <span
      className={`avatar${egen ? ' avatar--egen' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initialer(navn)}
    </span>
  );
}
