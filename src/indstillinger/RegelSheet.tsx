import { useId, useState, type FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import { primaryAction, type FieldKind, type Requirement } from '../components/field.ts';
import { Sheet } from '../components/Sheet.tsx';
import { SheetAction } from '../components/SheetAction.tsx';
import { t } from '../strings/index.ts';
import { rpcErrorText } from '../supabase/rpcErrors.ts';
import type { IndstillingAendringer, Indstillinger } from './indstillinger.ts';
import {
  udkastResultat,
  type IndstillingNoegle,
  type Regel,
  type TekstFelt,
  type TilNoegle,
  type Udkast,
  type UdkastResultat,
  type ValgFelt,
} from './regel.ts';
import '../frikob/Frikob.css';
import '../medlemmer/felter.css';
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
 * once; Gem saves every changed field in one call and closes. Errors show
 * under the switch or field that caused them. Mount it with a new `key` per
 * opening, so the fields and the one-time ID start fresh.
 */
export function RegelSheet({ open, onOpenChange, regel, indstillinger, gem }: RegelSheetProps) {
  // The fields start from the values stored when the sheet opened.
  const [start] = useState(indstillinger);
  const [udkast, setUdkast] = useState<Udkast>({});
  const [busy, setBusy] = useState(false);
  const [gemFejl, setGemFejl] = useState<{ tekst: string; noegle: IndstillingNoegle | null } | null>(null);
  const [switchFejl, setSwitchFejl] = useState<Partial<Record<TilNoegle, string>>>({});
  const [klientId] = useState(() => crypto.randomUUID());

  const r = udkastResultat(regel, start, udkast);
  const handling = primaryAction(
    regel.sektioner
      .flatMap((s) => s.felter)
      .filter((felt) => r.synlige.has(felt.noegle))
      .map((felt): Requirement => [!r.fejl[felt.noegle], t('aarsag.retFelt', { felt: feltLabel(felt, r) })]),
    { busy, unchanged: !r.aendret },
  );

  function skriv(noegle: IndstillingNoegle, tekst: string) {
    setUdkast((u) => ({ ...u, [noegle]: tekst }));
    setGemFejl(null);
  }

  /** A switch flips at once; a refusal flips it back and says why under it. */
  function skift(noegle: TilNoegle, til: boolean) {
    setSwitchFejl((f) => ({ ...f, [noegle]: undefined }));
    gem({ [noegle]: til }).catch((e: unknown) => setSwitchFejl((f) => ({ ...f, [noegle]: rpcErrorText(e) })));
  }

  async function gemUdkast(event: FormEvent) {
    event.preventDefault();
    if (!r.kanGemme || busy) return;
    const noegler = Object.keys(r.aendringer) as IndstillingNoegle[];
    setBusy(true);
    setGemFejl(null);
    try {
      await gem(r.aendringer, klientId);
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
      dirty={r.aendret}
      footer={
        <SheetAction
          form={FORM_ID}
          disabled={!r.kanGemme || busy}
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
                fejl={switchFejl[sektion.til.noegle]}
                onSkift={(til) => sektion.til && skift(sektion.til.noegle, til)}
              />
            )}
            {sektion.felter
              .filter((felt) => r.synlige.has(felt.noegle))
              .map((felt) =>
                felt.art === 'valg' ? (
                  <ValgFeltVis key={felt.noegle} felt={felt} r={r} onValg={(v) => skriv(felt.noegle, v)} />
                ) : (
                  <TekstFeltVis
                    key={felt.noegle}
                    felt={felt}
                    r={r}
                    gemFejl={gemFejl?.noegle === felt.noegle ? gemFejl.tekst : null}
                    onSkriv={(tekst) => skriv(felt.noegle, tekst)}
                  />
                ),
              )}
            {sektion.note && <p className="felt-note">{sektion.note}</p>}
          </section>
        ))}
      </form>
    </Sheet>
  );
}

function RegelSwitch({
  label,
  til,
  fejl,
  onSkift,
}: {
  label: string;
  til: boolean;
  fejl: string | undefined;
  onSkift: (til: boolean) => void;
}) {
  const fejlId = useId();
  return (
    <>
      <div className="regel-switch">
        <span className="regel-switch__label">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={til}
          aria-label={label}
          aria-describedby={fejl ? fejlId : undefined}
          className="indst-switch"
          onClick={() => onSkift(!til)}
        >
          <span className="indst-switch__knop" />
        </button>
      </div>
      {fejl && (
        <p id={fejlId} className="felt-fejl" role="alert">
          {fejl}
        </p>
      )}
    </>
  );
}

function feltLabel(felt: { label: string | ((laes: UdkastResultat['laes']) => string) }, r: UdkastResultat) {
  return typeof felt.label === 'function' ? felt.label(r.laes) : felt.label;
}

/** The keyboard for a rule field: whole numbers, decimals ("1,5", Placeringer) or text. */
const FELT_ART: Record<TekstFelt<IndstillingNoegle>['inputMode'], FieldKind> = {
  numeric: 'integer',
  decimal: 'decimal',
  text: 'text',
};

function TekstFeltVis({
  felt,
  r,
  gemFejl,
  onSkriv,
}: {
  felt: TekstFelt<IndstillingNoegle>;
  r: UdkastResultat;
  gemFejl: string | null;
  onSkriv: (tekst: string) => void;
}) {
  // Only complain once the Admin has changed something.
  const fejl = gemFejl ?? (r.aendret ? (r.fejl[felt.noegle] ?? null) : null);
  return (
    <Field
      label={feltLabel(felt, r)}
      kind={FELT_ART[felt.inputMode]}
      unit={felt.enhed}
      value={r.laes(felt.noegle)}
      onChange={onSkriv}
      error={fejl}
      errorIsAlert={gemFejl !== null}
      note={felt.note}
    />
  );
}

function ValgFeltVis({
  felt,
  r,
  onValg,
}: {
  felt: ValgFelt<IndstillingNoegle>;
  r: UdkastResultat;
  onValg: (vaerdi: string) => void;
}) {
  const valgt = r.laes(felt.noegle);
  return (
    <div role="radiogroup" aria-label={feltLabel(felt, r)} className="frikob-valg regel-valg">
      {felt.valg.map((v) => {
        const erValgt = v.vaerdi === valgt;
        return (
          <button
            key={v.vaerdi}
            type="button"
            role="radio"
            aria-checked={erValgt}
            className={`frikob-valg__raekke${erValgt ? ' frikob-valg__raekke--valgt' : ''}`}
            onClick={() => onValg(v.vaerdi)}
          >
            <span className="frikob-valg__radio" aria-hidden="true" />
            <span className="frikob-valg__tekst">
              <span className="frikob-valg__navn">{v.navn}</span>
              {v.under && <span className="frikob-valg__under">{v.under}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
