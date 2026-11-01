import { describe, expect, it } from 'vitest';
import { base64UrlTilBytes, notifikationTilstand, praeferencer, type EnhedPush } from './push.ts';

const installeret: EnhedPush = {
  installeret: true,
  understoettet: true,
  harNoegle: true,
  tilladelse: 'default',
  abonneret: false,
};

describe('notifikationTilstand (which card Profil shows)', () => {
  it('asks you to install the app in a browser tab', () => {
    expect(notifikationTilstand({ ...installeret, installeret: false })).toBe('installer');
  });

  it('offers "Slå notifikationer til" in the installed app', () => {
    expect(notifikationTilstand(installeret)).toBe('slaaTil');
  });

  it('shows the toggles once this device is subscribed', () => {
    expect(notifikationTilstand({ ...installeret, tilladelse: 'granted', abonneret: true })).toBe('til');
  });

  it('offers to subscribe again when permission is granted but the subscription is gone', () => {
    expect(notifikationTilstand({ ...installeret, tilladelse: 'granted' })).toBe('slaaTil');
  });

  it('explains where to allow them after you said no', () => {
    expect(notifikationTilstand({ ...installeret, tilladelse: 'denied' })).toBe('blokeret');
  });

  it('says push is not available on a device without Web Push (e.g. iOS before 16.4)', () => {
    expect(notifikationTilstand({ ...installeret, understoettet: false })).toBe('ikkeUnderstoettet');
  });

  it('says push is not available when the app has no VAPID key', () => {
    expect(notifikationTilstand({ ...installeret, harNoegle: false })).toBe('ikkeUnderstoettet');
  });
});

describe('praeferencer', () => {
  it('has every kind on when nothing is stored, except the opt-in Aktivitet fra andre', () => {
    expect(praeferencer(null)).toEqual({
      bode_modtaget: true,
      anke_afstemning: true,
      anke_resultat: true,
      betalingsmelding_venter: true,
      betaling_bekraeftet: true,
      automatisk_gebyr: true,
      betalingspaamindelse: true,
      andres_aktivitet: false,
    });
  });

  it('keeps Aktivitet fra andre off when other toggles are stored without it', () => {
    expect(praeferencer({ bode_modtaget: false }).andres_aktivitet).toBe(false);
  });

  it('keeps Aktivitet fra andre on once it is turned on', () => {
    expect(praeferencer({ andres_aktivitet: true }).andres_aktivitet).toBe(true);
  });

  it('keeps what is stored', () => {
    expect(praeferencer({ bode_modtaget: false, anke_resultat: true }).bode_modtaget).toBe(false);
  });
});

describe('base64UrlTilBytes (the VAPID public key for PushManager.subscribe)', () => {
  it('decodes base64url without padding', () => {
    // "Bøde" in UTF-8 is 42 c3 b8 64 65; base64url "QsO4ZGU".
    expect([...base64UrlTilBytes('QsO4ZGU')]).toEqual([0x42, 0xc3, 0xb8, 0x64, 0x65]);
  });

  it('decodes the url-safe characters', () => {
    expect([...base64UrlTilBytes('-_8')]).toEqual([0xfb, 0xff]);
  });
});
