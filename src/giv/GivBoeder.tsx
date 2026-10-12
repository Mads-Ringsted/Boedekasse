import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useBodekasse } from '../bodekasse/BodekasseProvider.tsx';
import { frikobIGiv, frikobRegler } from '../frikob/frikob.ts';
import { FrikobTag } from '../frikob/FrikobTag.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { T } from '../components/T.tsx';
import { KategoriFormSheet } from '../kategorier/KategoriFormSheet.tsx';
import { formatKr, t } from '../strings/index.ts';
import { supabase } from '../supabase/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import { useHent } from '../supabase/useHent.ts';
import { EngangsboedeSheet } from './EngangsboedeSheet.tsx';
import type { Forvalg } from './GivBoederProvider.tsx';
import { GivPersonSheet } from './GivPersonSheet.tsx';
import { hentGiv, type Modtager } from './hentGiv.ts';
import { KategoriVaelger } from './KategoriVaelger.tsx';
import { boederTekst, linjeTekst, navneliste, personerTekst } from './tekst.ts';
import {
  antalFor,
  engangsFor,
  erValgt,
  faellesAntal,
  fjernEngangsAlle,
  fjernEngangsPerson,
  fravaelgAlle,
  givLinjer,
  INGEN_REGLER,
  minusAlle,
  minusPerson,
  nytValg,
  opsummer,
  plusAlle,
  plusPerson,
  skiftPerson,
  tilfoejEngangsAlle,
  tilfoejEngangsPerson,
  vaelgAlle,
  type Opsummering,
  type Valg,
} from './valg.ts';
import './GivBoeder.css';

/** What `giv_boeder` answered; the Fortryd toast needs it. */
export interface Givet {
  batchId: string;
  antal: number;
  beloeb: number;
}

interface GivBoederProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forvalg: Forvalg;
  onGivet: (givet: Givet) => void;
}

type Trin = 1 | 2 | 3;

/**
 * Giv bøder: 1 Hvem → 2 Hvad → give, or 3 "Tilpas pr. person" (with 3b for
 * one person). One submit is one `giv_boeder` call. Mount it with a new
 * `key` per opening so the selection and the one-time ID start fresh.
 */
export function GivBoeder({ open, onOpenChange, forvalg, onGivet }: GivBoederProps) {
  const { bodekasseId, medlemId } = useBodekasse();
  const hentet = useHent(() => hentGiv(bodekasseId, medlemId), [bodekasseId, medlemId]);
  const data = hentet.status === 'ready' ? hentet.data : null;
  // Frikøb: nobody gets a Bødekategori they have bought out.
  const regler = useMemo(() => (data ? frikobRegler(data.frikoeb) : INGEN_REGLER), [data]);

  const [valg, setValg] = useState<Valg>(() =>
    nytValg({ personer: forvalg.medlemId ? [forvalg.medlemId] : [], kategoriId: forvalg.kategoriId }),
  );
  const [trin, setTrin] = useState<Trin>(forvalg.medlemId ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // One ID per opening, so "Prøv igen" after a lost answer never gives twice.
  const [klientId] = useState(() => crypto.randomUUID());

  // Step 3b and Ny bødekategori stack on top; keyed per opening.
  const [personId, setPersonId] = useState<string | null>(null);
  const [personAaben, setPersonAaben] = useState(false);
  const [nyNr, setNyNr] = useState(0);
  const [nyAaben, setNyAaben] = useState(false);
  // Engangsbøde: for everyone picked (step 2, null) or one person (3b).
  const [engangs, setEngangs] = useState<{ nr: number; open: boolean; personId: string | null }>({
    nr: 0,
    open: false,
    personId: null,
  });

  const modtagere = data?.modtagere ?? [];
  const kategorier = data?.kategorier ?? [];
  const modtagerFor = new Map(modtagere.map((m) => [m.id, m]));
  const sum = opsummer(valg, kategorier);
  const valgte = valg.personer.flatMap((id) => modtagerFor.get(id) ?? []);
  // In sentences you are "dig" ("Gælder for dig og Emil") or "du" ("Du har Frikøb").
  const valgteDig = valgte.map((m) => iSaetning(m, 'giv.dig'));
  const valgteDu = valgte.map((m) => iSaetning(m, 'giv.du'));
  const person = personId ? modtagerFor.get(personId) : undefined;

  function aendr(f: (v: Valg) => Valg) {
    setFejl(null);
    setValg(f);
  }

  function aabnEngangs(forPerson: string | null) {
    setEngangs((e) => ({ nr: e.nr + 1, open: true, personId: forPerson }));
  }

  async function giv() {
    if (busy || sum.antal === 0) return;
    setBusy(true);
    setFejl(null);
    const { data: svar, error } = await supabase.rpc('giv_boeder', {
      p_klient_id: klientId,
      p_bodekasse: bodekasseId,
      p_linjer: givLinjer(valg),
    });
    setBusy(false);
    if (error) {
      setFejl(rpcErrorText(error));
      return;
    }
    const { batch_id, antal, beloeb } = svar as { batch_id: string; antal: number; beloeb: number };
    onGivet({ batchId: batch_id, antal, beloeb });
  }

  const tilbage = (
    <>
      <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
      {t('sheet.tilbage')}
    </>
  );

  const fejlLinje = fejl && (
    <p className="giv__fejl" role="alert">
      {fejl}
    </p>
  );

  const givKnap = (
    <button type="button" className="giv__primaer" disabled={busy || sum.antal === 0} onClick={() => void giv()}>
      {sum.antal === 0
        ? t('giv.givTom')
        : t('giv.giv', { boeder: boederTekst(sum.antal), beloeb: formatKr(sum.beloeb) })}
    </button>
  );

  let indhold;
  let footer;
  if (hentet.status === 'error') {
    indhold = (
      <button type="button" className="giv__fejl giv__fejl--hent" onClick={hentet.reload}>
        {rpcErrorText(hentet.error)}
      </button>
    );
  } else if (!data) {
    indhold = null;
  } else if (trin === 1) {
    const alleValgt = modtagere.length > 0 && modtagere.every((m) => erValgt(valg, m.id));
    indhold = (
      <>
        <div className="giv__vaelg-alle">
          <button
            type="button"
            onClick={() =>
              aendr((v) => (alleValgt ? fravaelgAlle(v) : vaelgAlle(v, modtagere.map((m) => m.id), regler)))
            }
          >
            {t(alleValgt ? 'giv.fravaelgAlle' : 'giv.vaelgAlle')}
          </button>
        </div>
        <div className="giv__personer">
          {modtagere.map((m) => (
            <PersonFlise
              key={m.id}
              modtager={m}
              valgt={erValgt(valg, m.id)}
              onClick={() => aendr((v) => skiftPerson(v, m.id, regler))}
            />
          ))}
        </div>
        {/* Only you so far: you can fine yourself, but point to inviting others. */}
        {modtagere.every((m) => m.egen) && <p className="giv__tom">{t('giv.ingenAndre')}</p>}
      </>
    );
    footer = (
      <div className="giv__footer">
        <button
          type="button"
          className="giv__primaer"
          disabled={valg.personer.length === 0}
          onClick={() => setTrin(2)}
        >
          {t('giv.naeste', { antal: valg.personer.length })}
          <ArrowRight size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    );
  } else if (trin === 2) {
    indhold = (
      <>
        <div className="giv__gaelder">
          <span className="giv__stak" aria-hidden="true">
            {valgte.slice(0, 4).map((m) => (
              <Avatar key={m.id} navn={m.navn} size={28} egen />
            ))}
          </span>
          <span>
            <T
              id="giv.gaelderFor"
              values={{ navne: <strong key="n">{navneliste(valgteDig.map((m) => m.kortNavn))}</strong> }}
            />
          </span>
        </div>
        <KategoriVaelger
          kategorier={kategorier}
          antal={(k) => faellesAntal(valg, k)}
          onPlus={(k) => aendr((v) => plusAlle(v, k, regler))}
          onMinus={(k) => aendr((v) => minusAlle(v, k))}
          tag={(k) => {
            const f = frikobIGiv(valgteDu, k.id, regler);
            if (f) return <FrikobTag tekst={stort(t('frikob.harFrikob', { navne: navneliste(f.holdere) }))} />;
            return k.ofteBrugt && <span className="kategori-tag">{t('kategorier.ofteBrugt')}</span>;
          }}
          note={(k) => {
            const f = frikobIGiv(valgteDig, k.id, regler);
            if (!f || f.modtagere.length === 0) return null;
            return <span className="giv-kat__note">{t('frikob.givesKunTil', { navne: navneliste(f.modtagere) })}</span>;
          }}
          deaktiveret={(k) => frikobIGiv(valgte, k.id, regler)?.modtagere.length === 0}
          onNy={() => {
            setNyNr((n) => n + 1);
            setNyAaben(true);
          }}
          engangs={valg.faellesEngangs}
          onFjernEngangs={(id) => aendr((v) => fjernEngangsAlle(v, id))}
          onEngangs={() => aabnEngangs(null)}
        />
      </>
    );
    footer = (
      <div className="giv__footer giv__footer--skygge">
        <Opsummeringslinje sum={sum} modtagerFor={modtagerFor} />
        {fejlLinje}
        <div className="giv__knapper">
          <button type="button" className="giv__sekundaer" onClick={() => setTrin(3)}>
            {t('giv.tilpas')}
          </button>
          {givKnap}
        </div>
      </div>
    );
  } else {
    const medBoeder = sum.personer.filter((p) => p.antal > 0).length;
    indhold = (
      <div className="giv__kort-liste">
        {sum.personer.map((p) => {
          const m = modtagerFor.get(p.id);
          if (!m) return null;
          const aabn3b = () => {
            setPersonId(p.id);
            setPersonAaben(true);
          };
          return (
            <section key={p.id} className="giv-kort" aria-label={m.kortNavn}>
              <button type="button" className="giv-kort__top" onClick={aabn3b}>
                <Avatar navn={m.navn} stiplet={!m.loggetInd} />
                <span className="giv-kort__navn">{m.kortNavn}</span>
                <span className="giv-kort__beloeb">{formatKr(p.beloeb)}</span>
                <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" className="giv-kort__chevron" />
              </button>
              {p.linjer.length > 0 && (
                <ul className="giv-kort__linjer">
                  {p.linjer.map((l) => (
                    <li key={l.kategoriId}>
                      <span>{l.engangs ? l.navn : t('giv.gange', { antal: l.antal, navn: l.navn })}</span>
                      <span className="giv-kort__linje-beloeb">{formatKr(l.beloeb)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="giv-kort__tilfoej" onClick={aabn3b}>
                <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                {t('giv.tilfoejBoede')}
              </button>
            </section>
          );
        })}
      </div>
    );
    footer = (
      <div className="giv__footer">
        <div className="giv__total">
          <span>{t('giv.tilPersoner', { boeder: boederTekst(sum.antal), personer: personerTekst(medBoeder) })}</span>
          <span className="giv__total-beloeb">{formatKr(sum.beloeb)}</span>
        </div>
        {fejlLinje}
        {givKnap}
      </div>
    );
  }

  const personSum = sum.personer.find((p) => p.id === personId);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="full"
      title={t('giv.titel')}
      leadingLabel={trin === 1 ? undefined : tilbage}
      onLeading={trin === 1 ? undefined : () => setTrin((n) => (n - 1) as Trin)}
      trailing={t('giv.trin', { nr: trin })}
      top={
        <div className="giv__fremskridt" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= trin ? 'giv__fremskridt--naaet' : undefined} />
          ))}
        </div>
      }
      footer={footer}
    >
      <div className="giv">{indhold}</div>

      {person && personSum && (
        <GivPersonSheet
          key={`person-${person.id}`}
          open={personAaben}
          onOpenChange={setPersonAaben}
          modtager={person}
          kategorier={kategorier}
          antal={(k) => antalFor(valg, person.id, k)}
          onPlus={(k) => aendr((v) => plusPerson(v, person.id, k, regler))}
          onMinus={(k) => aendr((v) => minusPerson(v, person.id, k))}
          kanFaa={(k) => regler.kanFaa(person.id, k)}
          engangs={engangsFor(valg, person.id)}
          onFjernEngangs={(id) => aendr((v) => fjernEngangsPerson(v, person.id, id))}
          onEngangs={() => aabnEngangs(person.id)}
          sum={personSum}
        />
      )}

      {engangs.nr > 0 && (
        <EngangsboedeSheet
          key={`engangs-${engangs.nr}`}
          open={engangs.open}
          onOpenChange={(open) => setEngangs((e) => ({ ...e, open }))}
          modtagere={engangs.personId ? (person ? [iSaetning(person, 'giv.dig')] : []) : valgteDig}
          onTilfoej={({ grund, beloeb }) => {
            const ny = { id: crypto.randomUUID(), grund, beloeb };
            const forPerson = engangs.personId;
            setEngangs((e) => ({ ...e, open: false }));
            aendr((v) => (forPerson ? tilfoejEngangsPerson(v, forPerson, ny) : tilfoejEngangsAlle(v, ny)));
          }}
        />
      )}

      {nyNr > 0 && (
        <KategoriFormSheet
          key={`ny-${nyNr}`}
          open={nyAaben}
          onOpenChange={setNyAaben}
          stacked
          onSaved={(id) => {
            setNyAaben(false);
            hentet.reload();
            aendr((v) => plusAlle(v, id, regler));
          }}
        />
      )}
    </Sheet>
  );
}

/** You inside a sentence: "dig" or "du"; anyone else keeps their short name. */
function iSaetning(m: Modtager, form: 'giv.dig' | 'giv.du'): Modtager {
  return m.egen ? { ...m, kortNavn: t(form) } : m;
}

/** "du har Frikøb" → "Du har Frikøb". */
const stort = (s: string) => s.charAt(0).toLocaleUpperCase('da') + s.slice(1);

function PersonFlise({ modtager, valgt, onClick }: { modtager: Modtager; valgt: boolean; onClick: () => void }) {
  return (
    <button type="button" className="giv-flise" aria-pressed={valgt} onClick={onClick}>
      <Avatar navn={modtager.navn} size={56} egen={valgt} stiplet={!valgt && !modtager.loggetInd} />
      <span className="giv-flise__navn">{modtager.kortNavn}</span>
      {valgt && (
        <span className="giv-flise__flueben" aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Step 2's footer line: what each gets, or per person when it differs. */
function Opsummeringslinje({ sum, modtagerFor }: { sum: Opsummering; modtagerFor: Map<string, Modtager> }) {
  if (sum.antal === 0) return <div className="giv__opsummering">{t('giv.ingenValgt')}</div>;
  if (sum.hver) {
    return (
      <div className="giv__opsummering">
        <T
          id="giv.tilHver"
          values={{ boeder: boederTekst(sum.hver.antal), beloeb: <strong key="b">{formatKr(sum.beloeb)}</strong> }}
        />
      </div>
    );
  }
  return (
    <div className="giv__opsummering giv__opsummering--pr-person">
      {sum.personer
        .filter((p) => p.antal > 0)
        .map((p) => (
          <span key={p.id}>
            <T
              id="giv.personLinje"
              values={{
                navn: <strong key="n">{modtagerFor.get(p.id)?.kortNavn ?? ''}</strong>,
                linjer: linjeTekst(p.linjer),
              }}
            />
          </span>
        ))}
    </div>
  );
}
