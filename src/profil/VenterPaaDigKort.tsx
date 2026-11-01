import { hentKanAnkes } from '../anke/hentAnke.ts';
import { KanAnkesRaekker } from '../anke/profilDel.tsx';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { hentMeldinger } from '../betal/hentBetal.ts';
import { MinMeldingKort } from '../betal/MinMeldingKort.tsx';
import { t } from '../strings/index.ts';
import { useHent } from '../supabase/useHent.ts';
import type { ProfilDelProps } from './handlinger.ts';
import { venterPaaDig } from './venterPaaDig.ts';

async function hentVenter(bodekasseId: string, medlemId: string) {
  const [meldinger, kanAnkes] = await Promise.all([hentMeldinger(bodekasseId), hentKanAnkes(bodekasseId, medlemId)]);
  return { meldinger, ...kanAnkes };
}

/**
 * "Venter på dig" on your own profile: your Betalingsmelding that afventer
 * (with Fortryd), then each Bøde you can still appeal. Hidden when empty.
 */
export function VenterPaaDigKort({ profil, visning, mig, opdater }: ProfilDelProps) {
  const { bodekasseId } = useBodekasse();
  // `profil` is a new object after every profile reload.
  const hentet = useHent(
    () => (visning.egen ? hentVenter(bodekasseId, profil.id) : Promise.resolve(null)),
    [bodekasseId, profil, visning.egen],
  );
  if (hentet.status !== 'ready' || !hentet.data) return null;
  const venter = venterPaaDig({ ...hentet.data, migId: profil.id });
  if (!venter) return null;

  return (
    <section className="profil__venter" aria-labelledby="profil-venter">
      <h2 id="profil-venter" className="profil__sektion">
        {t('profil.venterPaaDig')}
      </h2>
      {venter.melding && (
        <MinMeldingKort
          key={venter.melding.id}
          melding={venter.melding}
          erAdmin={mig.erAdmin}
          paaSkaerm
          onFortrudt={opdater}
        />
      )}
      <KanAnkesRaekker anker={venter.anker} regler={hentet.data.regler} onSendt={opdater} />
    </section>
  );
}
