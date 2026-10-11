import { supabase } from '../../supabase/index.ts';
import { kanAnnullereBoede } from './annuller.ts';
import { AnnullerFelt } from './AnnullerFelt.tsx';
import type { BoedeHandlingProps } from './handlinger.ts';

/**
 * "Annullér bøde" on the Bøde detail sheet (#62): for the giver while it was
 * never appealed, and for Admins on any Bøde, in the latest Sæson. After it
 * goes through, the sheet reloads and shows "Annulleret af …".
 */
export function AnnullerBoede({ boede, mig, iSenesteSaeson, aendret }: BoedeHandlingProps) {
  if (!kanAnnullereBoede(boede, mig, iSenesteSaeson)) return null;
  return (
    <AnnullerFelt
      knap="annuller.boede"
      annuller={(klientId, note) =>
        supabase.rpc('annuller_bode', { p_klient_id: klientId, p_bode: boede.id, p_note: note })
      }
      onAnnulleret={aendret}
    />
  );
}
