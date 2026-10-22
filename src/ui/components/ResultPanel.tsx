import { forwardRef } from 'react';
import type { Grade, Item } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';
import { gradeLabel } from './GradeButtons.tsx';
import { PatternCard } from './PatternCard.tsx';

interface Props {
  item: Item;
  answer: string;
  matched: boolean;
  /** Self-grade once chosen (unmatched answers only). */
  grade?: Grade | undefined;
}

/** The verdict heading takes focus after submit (ref; a11y audit 08 #2). */
export const ResultPanel = forwardRef<HTMLHeadingElement, Props>(function ResultPanel({ item, answer, matched, grade }, verdictRef) {
  const canonical = item.acceptedAnswers[0] ?? '';
  const others = item.modelSentences.filter((s) => s !== canonical);
  return (
    <section className="result">
      {matched ? (
        <h2 ref={verdictRef} tabIndex={-1} className="verdict verdict--ok">
          <span aria-hidden="true">✓</span> {t.correct}
        </h2>
      ) : (
        <h2 ref={verdictRef} tabIndex={-1} className="verdict verdict--miss">
          <span aria-hidden="true">≠</span> {t.notMatched}
        </h2>
      )}

      <dl className="answers">
        <div>
          <dt>{t.yourAnswer}</dt>
          <dd lang="en" className="answers__mine">{answer}</dd>
        </div>
        {!matched && (
          <div>
            <dt>{t.correctAnswer}</dt>
            <dd lang="en" className="answers__canonical">{canonical}</dd>
          </div>
        )}
      </dl>

      {!matched && (
        <div className="block">
          <h2 className="label">{t.checklist}</h2>
          <ul className="checklist">
            {item.checklistTr.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {!matched && grade && (
        <p className="graded" role="status">
          {t.gradedAs(gradeLabel(grade))}
        </p>
      )}

      {matched && (
        <div className="block">
          <h2 className="label">{t.modelSentences}</h2>
          <ul className="sentences" lang="en">
            {[canonical, ...others].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <PatternCard key={`${item.id}:${String(matched)}`} item={item} defaultOpen={!matched} showSentences={!matched} />
    </section>
  );
});
