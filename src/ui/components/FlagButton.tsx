import { t } from '../strings.tr.ts';

interface Props {
  flagged: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/** Decision 12: ⚑ "Bu yanlış olabilir" on question and result; pressing again removes the flag. */
export function FlagButton({ flagged, onToggle, disabled }: Props) {
  return (
    <div className="flag">
      <button type="button" className="btn btn--text flag__button" aria-pressed={flagged} onClick={onToggle} disabled={disabled}>
        <span aria-hidden="true">⚑</span>&nbsp;{t.flag}
      </button>
      {flagged && <span className="flag__state">{t.flagged}</span>}
    </div>
  );
}
