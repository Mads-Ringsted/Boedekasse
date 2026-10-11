import type { Beskriver } from '../visning.ts';
import { boederGivet } from './boeder.ts';
import { bodekategoriArkiveret, bodekategoriOmpriset, bodekategoriOprettet } from './kategorier.ts';
import { medlemTilfoejet, medlemTilmeldt } from './medlemmer.ts';
import { konkurrenceAnnulleret, konkurrenceRegistreret } from './konkurrence.ts';
import { bodekasseOprettet, saesonStartet } from './saeson.ts';

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
  bodekasse_oprettet: bodekasseOprettet,
  saeson_startet: saesonStartet,
  konkurrence_registreret: konkurrenceRegistreret,
  konkurrence_annulleret: konkurrenceAnnulleret,
};
