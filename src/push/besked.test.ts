import { describe, expect, it } from 'vitest';
import { laesPushBesked, pushMaal } from './besked.ts';

describe('laesPushBesked (what the service worker shows)', () => {
  it('reads the sender’s payload', () => {
    expect(laesPushBesked('{"titel":"Ny bøde i Holdet","tekst":"Jonas gav dig For sent","url":"/profil?bodekasse=x"}')).toEqual({
      titel: 'Ny bøde i Holdet',
      tekst: 'Jonas gav dig For sent',
      url: '/profil?bodekasse=x',
    });
  });

  it('still shows something for a payload it can’t read (iOS revokes push after a silent one)', () => {
    expect(laesPushBesked('ikke json')).toEqual({ titel: 'Bødekasse', tekst: 'ikke json', url: '/' });
    expect(laesPushBesked(null)).toEqual({ titel: 'Bødekasse', tekst: '', url: '/' });
  });
});

describe('pushMaal (where a tap goes)', () => {
  const origin = 'https://boedekasse.example';

  it('opens the in-app path', () => {
    expect(pushMaal('/profil?bodekasse=x', origin)).toBe('https://boedekasse.example/profil?bodekasse=x');
  });

  it('never leaves the app', () => {
    expect(pushMaal('https://evil.example/', origin)).toBe('https://boedekasse.example/');
    expect(pushMaal('//evil.example/x', origin)).toBe('https://boedekasse.example/');
  });
});
