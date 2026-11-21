import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import {
  BAGGRUND,
  gemUdseende,
  laesUdseende,
  temaAttribut,
  themeColors,
  UDSEENDE_NOEGLE,
  UDSEENDER,
  type Udseende,
} from './udseende.ts';

function lager(start: Record<string, string> = {}) {
  const data = new Map(Object.entries(start));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const oedelagt = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('laesUdseende / gemUdseende (the choice per device)', () => {
  it('is Automatisk when nothing is saved', () => {
    expect(laesUdseende(lager())).toBe('auto');
  });

  it('reads back what was saved', () => {
    for (const valg of UDSEENDER) {
      const l = lager();
      gemUdseende(l, valg);
      expect(laesUdseende(l)).toBe(valg);
    }
  });

  it('stores Automatisk as no value', () => {
    const l = lager({ [UDSEENDE_NOEGLE]: 'moerk' });
    gemUdseende(l, 'auto');
    expect(l.data.has(UDSEENDE_NOEGLE)).toBe(false);
  });

  it('treats an unknown value as Automatisk', () => {
    expect(laesUdseende(lager({ [UDSEENDE_NOEGLE]: 'dark' }))).toBe('auto');
  });

  it('survives storage that throws', () => {
    expect(laesUdseende(oedelagt)).toBe('auto');
    expect(() => gemUdseende(oedelagt, 'lys')).not.toThrow();
  });
});

describe('temaAttribut / themeColors', () => {
  it('forces a theme only for Lys and Mørk', () => {
    expect(temaAttribut('auto')).toBeNull();
    expect(temaAttribut('lys')).toBe('light');
    expect(temaAttribut('moerk')).toBe('dark');
  });

  it('keeps one colour per phone setting on Automatisk', () => {
    expect(themeColors('auto')).toEqual({ light: BAGGRUND.light, dark: BAGGRUND.dark });
  });

  it('gives both tags the forced colour', () => {
    expect(themeColors('lys')).toEqual({ light: BAGGRUND.light, dark: BAGGRUND.light });
    expect(themeColors('moerk')).toEqual({ light: BAGGRUND.dark, dark: BAGGRUND.dark });
  });
});

describe('the pre-paint script in index.html', () => {
  const metaTags = [...indexHtml.matchAll(/<meta name="theme-color" media="([^"]+)" content="([^"]+)"/g)];
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? '';

  /** Runs the inline script against a fake page and returns what it set. */
  function koer(gemt: string | null) {
    const attributter: Record<string, string> = {};
    const tags = metaTags.map(([, media, content]) => {
      const tag = { media, content, setAttribute: (_: string, v: string) => (tag.content = v) };
      return tag;
    });
    const document = {
      documentElement: { setAttribute: (k: string, v: string) => (attributter[k] = v) },
      querySelectorAll: () => tags,
    };
    const localStorage = lager(gemt === null ? {} : { [UDSEENDE_NOEGLE]: gemt });
    new Function('localStorage', 'document', script)(localStorage, document);
    const farve = (ord: string) => tags.find((tag) => tag.media.includes(ord))?.content;
    return { tema: attributter['data-theme'] ?? null, light: farve('light'), dark: farve('dark') };
  }

  it('starts from the same colours as the module', () => {
    expect(metaTags).toHaveLength(2);
    expect(koer(null)).toEqual({ tema: null, ...BAGGRUND });
  });

  it('agrees with the module for every stored value', () => {
    for (const gemt of [...UDSEENDER, 'noget andet']) {
      const valg: Udseende = laesUdseende(lager({ [UDSEENDE_NOEGLE]: gemt }));
      expect(koer(gemt)).toEqual({ tema: temaAttribut(valg), ...themeColors(valg) });
    }
  });
});
