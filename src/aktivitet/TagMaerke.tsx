import type { Tag } from './visning.ts';
import './TagMaerke.css';

/** A small status tag ("Anket", "Annulleret" …) in its tone. */
export function TagMaerke({ tag }: { tag: Tag }) {
  return <span className={`tag-maerke tag-maerke--${tag.tone}`}>{tag.tekst}</span>;
}
