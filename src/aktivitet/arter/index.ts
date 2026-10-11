import type { Beskriver } from '../visning.ts';
import { ankeIndgivet } from './anke.ts';
import { bodeAnnulleret, gebyrAnnulleret } from './annulleringer.ts';
import { boederGivet } from './boeder.ts';
import { frikobAnnulleret, frikobKoebt } from './frikob.ts';
import { bodekategoriArkiveret, bodekategoriOmpriset, bodekategoriOprettet } from './kategorier.ts';
import { medlemGenoptaget, medlemTilfoejet, medlemTilmeldt, medlemUdmeldt } from './medlemmer.ts';
import { konkurrenceAnnulleret, konkurrenceRegistreret } from './konkurrence.ts';
import { betalingAfvist, betalingBekraeftet, haevning, haevningAnnulleret, indbetaling, indbetalingAnnulleret } from './penge.ts';
import { bodekasseOprettet, saesonAfsluttet, saesonStartet } from './saeson.ts';

/**
 * Every feed entry kind the app can show, by `haendelse.art`. An entry of a
 * kind not listed here is left out of the feed.
 *
 * To add a kind: write a `Beskriver` in its own file here (see `kategorier.ts`;
 * `faelles.ts` has data and Gebyr helpers), then add one line below.
 * `beskrivRaekke` adds the generic parts: when the row the entry points at
 * (ref_tabel/ref_id) is annulled, it is struck through, tagged Annulleret,
 * with "annulleret af X · note".
 */
export const ARTER: Record<string, Beskriver> = {
  boeder_givet: boederGivet,
  bodekategori_oprettet: bodekategoriOprettet,
  bodekategori_ompriset: bodekategoriOmpriset,
  bodekategori_arkiveret: bodekategoriArkiveret,
  medlem_tilfoejet: medlemTilfoejet,
  medlem_tilmeldt: medlemTilmeldt,
  medlem_udmeldt: medlemUdmeldt,
  medlem_genoptaget: medlemGenoptaget,
  bodekasse_oprettet: bodekasseOprettet,
  saeson_startet: saesonStartet,
  saeson_afsluttet: saesonAfsluttet,
  indbetaling,
  indbetaling_annulleret: indbetalingAnnulleret,
  bode_annulleret: bodeAnnulleret,
  gebyr_annulleret: gebyrAnnulleret,
  anke_indgivet: ankeIndgivet,
  frikob_koebt: frikobKoebt,
  frikob_annulleret: frikobAnnulleret,
  betaling_bekraeftet: betalingBekraeftet,
  betaling_afvist: betalingAfvist,
  konkurrence_registreret: konkurrenceRegistreret,
  konkurrence_annulleret: konkurrenceAnnulleret,
  haevning,
  haevning_annulleret: haevningAnnulleret,
};
