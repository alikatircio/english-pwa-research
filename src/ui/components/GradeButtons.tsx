import type { Grade } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';

const GRADES: ReadonlyArray<[Grade, string]> = [
  ['wrong', t.gradeWrong],
  ['partial', t.gradePartial],
  ['correct', t.gradeCorrect],
];

export const gradeLabel = (g: Grade): string => GRADES.find(([k]) => k === g)?.[1] ?? g;

interface Props {
  onGrade: (g: Grade) => void;
  disabled?: boolean;
}

/** Decision 10: Yanlış · Kısmen · Doğru, equal width, symmetric (decision 16). */
export function GradeButtons({ onGrade, disabled }: Props) {
  return (
    <div className="grade-buttons" role="group" aria-label={t.howWasIt}>
      {GRADES.map(([g, label]) => (
        <button key={g} type="button" className={`btn btn--grade btn--grade-${g}`} onClick={() => onGrade(g)} disabled={disabled}>
          {label}
        </button>
      ))}
    </div>
  );
}
