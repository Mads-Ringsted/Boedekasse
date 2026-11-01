import { useId, useState, type FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import { primaryAction, visibleError } from '../components/fieldRules.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { IndstillingAendringer, Indstillinger } from './indstillinger.ts';
import { Switch } from './raekker.tsx';
import {
  feltLabel,
  skiftAendringer,
  udkastResultat,
  type IndstillingNoegle,
  type Regel,
  type TekstFelt,
  type TilNoegle,
  type Udkast,
  type UdkastResultat,
  type ValgFelt,
} from './regel.ts';
import '../medlemmer/felter.css';
import '../styles/valg-liste.css';
import './Indstillinger.css';

const FORM_ID = 'regel';

export interface RegelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regel: Regel;
  /** The live settings: switches show what is saved right now. */
  indstillinger: Indstillinger;
  /** `useIndstillinger().gem`: saves, throws the RPC error. */
  gem: (aendringer: IndstillingAendringer, klientId?: string) => Promise<void>;
}

/**
 * One rule's detail sheet (#94): per section, the switch first and then its
 * fields, which stay editable while the switch is off. A switch saves at
 * once, and turning it on also saves its section's changed fields (see
 * `skiftAendringer`); Gem saves every changed field in one call and closes.
 * Errors show under the switch or field that caused them. Mount it with a
 * new `key` per opening, so the fields and the one-time ID start fresh.
 */
export function RegelSheet({ open, onOpenChange, regel, indstillinger, gem }: RegelSheetProps) {
  // The fields start from the values stored when the sheet opened, or when a switch saved them.
  const [start, setStart] = useState(indstillinger);
  const [udkast, setUdkast] = useState<Udkast>({});
  const [busy, setBusy] = useState(false);
  const [gemFejl, setGemFejl] = useState<{ tekst: string; noegle: IndstillingNoegle | null } | null>(null);
  const [switchFejl, setSwitchFejl] = useState<Partial<Record<TilNoegle, string>>>({});
  const [skifter, setSkifter] = useState<Partial<Record<TilNoegle, boolean>>>({});
  const [klientId] = useState(() => crypto.randomUUID());

  const resultat = udkastResultat(regel, start, udkast);
  const handling = primaryAction(resultat.krav, { busy, unchanged: !resultat.aendret });

  function skriv(noegle: IndstillingNoegle, tekst: string) {
    setUdkast((u) => ({ ...u, [noegle]: tekst }));
    setGemFejl(null);
  }

  /**
   * A switch flips at once. Turned on, it takes its section's changed fields
   * along, so the rule never runs with the old values; a wrong one keeps it
   * off. A refusal flips it back and says why under it.
   */
  async function skift(noegle: TilNoegle, til: boolean) {
    const skiftet = skiftAendringer(regel, start, udkast, noegle, til);
    if (!skiftet.ok) {
      setSwitchFejl((f) => ({ ...f, [noegle]: skiftet.fejl }));
      return;
    }
    setSwitchFejl((f) => ({ ...f, [noegle]: undefined }));
    setSkifter((s) => ({ ...s, [noegle]: true }));
    try {
      await gem(skiftet.vaerdi);
      const gemte = Object.keys(skiftet.vaerdi);
      setStart((s) => ({ ...s, ...skiftet.vaerdi }));
      setUdkast((u) => Object.fromEntries(Object.entries(u).filter(([n]) => !gemte.includes(n))));
    } catch (error) {
      setSwitchFejl((f) => ({ ...f, [noegle]: rpcErrorText(error) }));
    } finally {
      setSkifter((s) => ({ ...s, [noegle]: false }));
    }
  }

  async function gemUdkast(event: FormEvent) {
    event.preventDefault();
    if (!handling.enabled) return;
    const noegler = Object.keys(resultat.aendringer) as IndstillingNoegle[];
    setBusy(true);
    setGemFejl(null);
    try {
      await gem(resultat.aendringer, klientId);
      onOpenChange(false);
    } catch (error) {
      // Under the field when only one changed, else under the form.
      setGemFejl({ tekst: rpcErrorText(error), noegle: noegler.length === 1 ? noegler[0] : null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      height="partial"
      title={regel.titel}
      dirty={resultat.aendret}
      footer={
        <SheetAction
          form={FORM_ID}
          disabled={!handling.enabled}
          reason={handling.reason}
          error={gemFejl && gemFejl.noegle === null ? gemFejl.tekst : null}
        >
          {t('indstillinger.gem')}
        </SheetAction>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void gemUdkast(e)}>
        {regel.sektioner.map((sektion, i) => (
          <section key={i} className="regel-sektion">
            {sektion.titel && <h3 className="regel-sektion__titel">{sektion.titel}</h3>}
            {sektion.til && (
              <RegelSwitch
                label={sektion.til.label}
                til={Boolean(indstillinger[sektion.til.noegle])}
                skifter={Boolean(skifter[sektion.til.noegle])}
                fejl={switchFejl[sektion.til.noegle]}
                onSkift={(til) => sektion.til && void skift(sektion.til.noegle, til)}
              />
            )}
            {sektion.felter
              .filter((felt) => resultat.synlige.has(felt.noegle))
              .map((felt) =>
                felt.art === 'valg' ? (
                  <ValgFeltVis
                    key={felt.noegle}
                    felt={felt}
                    resultat={resultat}
                    onValg={(v) => skriv(felt.noegle, v)}
                  />
                ) : (
                  <TekstFeltVis
                    key={felt.noegle}
                    felt={felt}
                    resultat={resultat}
                    gemFejl={gemFejl?.noegle === felt.noegle ? gemFejl.tekst : null}
                    onSkriv={(tekst) => skriv(felt.noegle, tekst)}
                  />
                ),
              )}
            {sektion.note && <p className="field__note">{sektion.note}</p>}
          </section>
        ))}
      </form>
    </Sheet>
  );
}

function RegelSwitch({
  label,
  til,
  skifter,
  fejl,
  onSkift,
}: {
  label: string;
  til: boolean;
  /** Its save is under way: one tap, one save. */
  skifter: boolean;
  fejl: string | undefined;
  onSkift: (til: boolean) => void;
}) {
  const fejlId = useId();
  return (
    <>
      <div className="regel-switch">
        <span className="regel-switch__label">{label}</span>
        <Switch
          label={label}
          til={til}
          disabled={skifter}
          describedBy={fejl ? fejlId : undefined}
          onSkift={onSkift}
        />
      </div>
      {fejl && (
        <p id={fejlId} className="field__error" role="alert">
          {fejl}
        </p>
      )}
    </>
  );
}

function TekstFeltVis({
  felt,
  resultat,
  gemFejl,
  onSkriv,
}: {
  felt: TekstFelt<IndstillingNoegle>;
  resultat: UdkastResultat;
  gemFejl: string | null;
  onSkriv: (tekst: string) => void;
}) {
  const tekst = resultat.laes(felt.noegle);
  return (
    <Field
      label={feltLabel(felt, resultat.laes)}
      kind={felt.kind}
      unit={felt.enhed}
      value={tekst}
      onChange={onSkriv}
      error={gemFejl ?? visibleError(tekst, resultat.fejl[felt.noegle])}
      errorIsAlert={gemFejl !== null}
      note={felt.note}
    />
  );
}

function ValgFeltVis({
  felt,
  resultat,
  onValg,
}: {
  felt: ValgFelt<IndstillingNoegle>;
  resultat: UdkastResultat;
  onValg: (vaerdi: string) => void;
}) {
  const valgt = resultat.laes(felt.noegle);
  return (
    <div role="radiogroup" aria-label={feltLabel(felt, resultat.laes)} className="valg-liste regel-valg">
      {felt.valg.map((v) => {
        const erValgt = v.vaerdi === valgt;
        return (
          <button
            key={v.vaerdi}
            type="button"
            role="radio"
            aria-checked={erValgt}
            className={`valg-liste__raekke${erValgt ? ' valg-liste__raekke--valgt' : ''}`}
            onClick={() => onValg(v.vaerdi)}
          >
            <span className="valg-liste__radio" aria-hidden="true" />
            <span className="valg-liste__tekst">
              <span className="valg-liste__navn">{v.navn}</span>
              {v.under && <span className="valg-liste__under">{v.under}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
