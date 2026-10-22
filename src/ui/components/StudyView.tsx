import { chunkTokens } from '../../domain/hints.ts';
import type { Item } from '../../domain/types.ts';
import { t } from '../strings.tr.ts';

interface Props {
  item: Item;
  /** Box before this showing (null = new): the commonMistake stays hidden at box ≤ 2 (decision 33). */
  boxBefore: number | null;
  headingId: string;
}

/** The model sentence with the chunk part (words under the cloze blanks) highlighted. */
function ModelSentence({ item }: { item: Item }) {
  const sentence = item.modelSentences[0] ?? item.acceptedAnswers[0] ?? '';
  const tokens = chunkTokens(item.clozeTemplate, sentence);
  return (
    <p className="study__sentence" lang="en" data-testid="study-sentence">
      {tokens.map((tok, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {tok.hit ? <mark className="study__chunk">{tok.text}</mark> : tok.text}
        </span>
      ))}
    </p>
  );
}

/**
 * Decision 33, "önce gör → sakla → üret": a new card's pattern is shown first
 * (chunk highlighted in the model sentence, note, slots); "Hazırım" hides it and
 * writing starts. Always open: this is the learning moment, not a collapsible.
 */
export function StudyView({ item, boxBefore, headingId }: Props) {
  const showMistake = item.commonMistake && (boxBefore ?? 1) >= 3;
  return (
    <div className="study" data-testid="study-view">
      <h2 id={headingId} className="label">
        {t.studyHeading}
      </h2>
      <ModelSentence item={item} />
      <p className="study__chunk-name" lang="en">
        {item.targetChunk}
      </p>
      {item.patternSlots && (
        <p className="pattern-card__slots" lang="en">
          {item.patternSlots}
        </p>
      )}
      <p className="pattern-card__note">{item.noteTr}</p>
      {showMistake && (
        <p className="pattern-card__mistake" lang="en">
          <span aria-hidden="true">✗ </span>
          <s>{item.commonMistake}</s>
        </p>
      )}
    </div>
  );
}
