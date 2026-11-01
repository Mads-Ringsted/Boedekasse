import { useContext, useState } from 'react';
import { BilledFejlContext } from '../billeder/billedFejl.ts';
import { visBillede } from '../billeder/billede.ts';
import { initialer } from './initialer.ts';
import './Avatar.css';

interface AvatarProps {
  navn: string;
  /** Diameter in px. */
  size?: number;
  /** Your own avatar: main colour instead of pale blue. */
  egen?: boolean;
  /** A Medlem who has not logged in yet: dashed ring, no fill, never a picture. */
  stiplet?: boolean;
  /** A former (Udmeldt) Medlem: grey (a picture is greyed out). */
  tidligere?: boolean;
  /** The Medlem's Profilbillede URL: `useBilleder().billede(medlemId)`. Initials without one. */
  billede?: string;
}

/** A Medlem's picture, or their initials, on a round tile. Initials if the picture fails to load. */
export function Avatar({ navn, size = 44, egen = false, stiplet = false, tidligere = false, billede }: AvatarProps) {
  const [fejletUrl, setFejletUrl] = useState<string>();
  const meldFejl = useContext(BilledFejlContext);
  const variant = egen ? ' avatar--egen' : stiplet ? ' avatar--stiplet' : tidligere ? ' avatar--tidligere' : '';
  const medBillede = visBillede({ url: billede, stiplet, tidligere, fejletUrl });
  return (
    <span
      className={`avatar${variant}${medBillede ? ' avatar--billede' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {medBillede ? (
        <img
          className="avatar__billede"
          src={billede}
          alt=""
          draggable={false}
          onError={() => {
            setFejletUrl(billede);
            if (billede) meldFejl(billede);
          }}
        />
      ) : (
        initialer(navn)
      )}
    </span>
  );
}
