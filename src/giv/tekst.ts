import { t } from '../strings/index.ts';

/** "1 bøde" / "5 bøder". */
export const boederTekst = (antal: number) => (antal === 1 ? t('giv.boede') : t('giv.boeder', { antal }));

/** "1 person" / "2 personer". */
export const personerTekst = (antal: number) => (antal === 1 ? t('giv.person') : t('giv.personer', { antal }));

/** "Jonas", "Jonas og Emil", "Jonas, Emil og Kasper". */
export const navneliste = (navne: readonly string[]) =>
  new Intl.ListFormat('da', { style: 'long', type: 'conjunction' }).format(navne);

/** "2× For sent, Spildt drikke" (no "1×"). */
export const linjeTekst = (linjer: readonly { navn: string; antal: number }[]) =>
  linjer.map((l) => (l.antal > 1 ? t('giv.gange', { antal: l.antal, navn: l.navn }) : l.navn)).join(', ');
