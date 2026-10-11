import { ChevronLeft } from 'lucide-react';
import './BackButton.css';

/** "‹ Tilbage" (or the previous screen's name) at the top of a pushed screen. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </button>
  );
}
