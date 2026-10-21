import type { Item } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';

interface Props {
  item: Item;
  answer: string;
  matched: boolean;
}

export function ResultPanel({ item, answer, matched }: Props) {
  const canonical = item.acceptedAnswers[0] ?? '';
  const others = item.modelSentences.filter((s) => s !== canonical);
  return (
    <section className="result" aria-live="polite">
      {matched ? (
        <p className="verdict verdict--ok">
          <span aria-hidden="true">✓</span> {t.correct}
        </p>
      ) : (
        <p className="verdict verdict--miss">
          <span aria-hidden="true">≠</span> {t.notMatched}
        </p>
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

      {others.length > 0 && (
        <div className="block">
          <h2 className="label">{t.modelSentences}</h2>
          <ul className="sentences" lang="en">
            {(matched ? [canonical, ...others] : others).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
