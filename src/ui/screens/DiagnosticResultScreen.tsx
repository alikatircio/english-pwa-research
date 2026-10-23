import type { ReactNode } from 'react';
import type { DiagnosticView } from '../../app/mode.ts';
import type { ReadyState } from '../../app/state.ts';
import { AREAS } from '../../domain/areas.ts';
import { firstVsLatest, retakeSuggested, studyPointers, verdictOf, weakAreas, type AreaResults } from '../../domain/diagnostic.ts';
import { systemClock } from '../../domain/clock.ts';
import type { DiagnosticAttempt } from '../../domain/types.ts';
import { diagnosticQuestions } from '../diagnosticQuestions.ts';
import { formatDate } from '../format.ts';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  view: Exclude<DiagnosticView, { kind: 'test' }>;
  onView: (view: DiagnosticView | undefined) => void;
}

const questions = diagnosticQuestions;

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sheet__header">
      <h2 className="sheet__title">{title}</h2>
      <button type="button" className="btn btn--text" onClick={onBack}>
        {t.diagBackToSettings}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

/** Plain text results (decision 47): no charts, badges or streaks. */
export function DiagnosticResultScreen({ state, view, onView }: Props) {
  const back = () => onView(undefined);
  const attempts = state.diagnostic?.attempts ?? [];
  return (
    <div className="screen diagnostic-result-screen">
      <div className="screen__body">{view.kind === 'history' ? <History attempts={attempts} back={back} /> : <Result state={state} attemptId={view.attemptId} back={back} />}</div>
    </div>
  );
}

function Result({ state, attemptId, back }: { state: ReadyState; attemptId: string; back: () => void }) {
  const attempt = (state.diagnostic?.attempts ?? []).find((a) => a.id === attemptId);
  if (!attempt?.areaResults) {
    return (
      <>
        <Header title={t.diagResultTitle} onBack={back} />
        <p className="muted">{t.diagNoAttempts}</p>
      </>
    );
  }
  const results = attempt.areaResults as AreaResults;
  const weak = weakAreas(results);
  const byId = new Map(questions.map((q) => [q.id, q]));
  return (
    <>
      <Header title={t.diagResultTitle} onBack={back} />
      {attempt.finishedAt !== undefined && <p className="muted">{formatDate(attempt.finishedAt)}</p>}

      <table className="diag-table" data-testid="diag-result-table">
        <caption className="label">{t.diagAreaTable}</caption>
        <thead>
          <tr>
            <th scope="col">{t.diagArea}</th>
            <th scope="col">{t.diagCorrect}</th>
            <th scope="col">{t.diagUnsureCol}</th>
            <th scope="col">{t.diagWrong}</th>
          </tr>
        </thead>
        <tbody>
          {AREAS.filter((a) => results[a.id]).map((a) => (
            <tr key={a.id}>
              <th scope="row">{a.titleTr}</th>
              <td>{results[a.id]?.correct}</td>
              <td>{results[a.id]?.unsure}</td>
              <td>{results[a.id]?.wrong}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section title={t.diagWeak}>
        {weak.length === 0 ? (
          <p className="muted">{t.diagNoWeak}</p>
        ) : (
          <ul className="diag-weak" data-testid="diag-weak">
            {weak.map((id) => {
              const area = AREAS.find((a) => a.id === id);
              const { refs, relatedItemIds } = studyPointers(id, questions);
              const chunks = relatedItemIds.flatMap((i) => state.catalog.byId.get(i)?.targetChunk ?? []);
              return (
                <li key={id} className="block">
                  <strong>{area?.titleTr}</strong>
                  <span>{t.diagStudy(refs)}</span>
                  {chunks.length > 0 && <span className="muted">{t.diagChunks(chunks)}</span>}
                  {/* PLACEHOLDER (Faz 4, task 4.4): topic links for this area are rendered into this slot. */}
                  <div className="diag-topic-links" data-testid={`topic-links-${id}`} data-slot="topic-links" />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t.diagAnswers}>
        <ol className="diag-answers" data-testid="diag-answers">
          {attempt.order.map((qid) => {
            const q = byId.get(qid);
            if (!q) return null;
            const given = attempt.answers[qid];
            const text = (ids: readonly string[]) => ids.map((i) => q.options.find((o) => o.id === i)?.text ?? i).join(' / ');
            const yours = !given ? t.diagNoAnswer : given.unsure ? t.diagUnsureCol : given.chosen.length ? text(given.chosen) : t.diagNoAnswer;
            return (
              <li key={qid} className="block">
                <span>{q.promptTr}</span>
                <span lang="en">{q.stem}</span>
                <span>
                  {t.diagYourAnswer}: <span lang="en">{yours}</span> ({t.diagVerdict[verdictOf(attempt, q)]})
                </span>
                <span>
                  {t.diagCorrectAnswer}: <span lang="en">{text(q.correct)}</span>
                </span>
                <span className="muted">{q.explanationTr}</span>
              </li>
            );
          })}
        </ol>
      </Section>
    </>
  );
}

function History({ attempts, back }: { attempts: readonly DiagnosticAttempt[]; back: () => void }) {
  const cmp = firstVsLatest(attempts);
  return (
    <>
      <Header title={t.diagHistoryTitle} onBack={back} />
      {!cmp ? (
        <p className="muted">{t.diagNoAttempts}</p>
      ) : (
        <>
          <table className="diag-table" data-testid="diag-history-table">
            <caption className="label">{t.diagHistoryTable}</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  {t.diagArea}
                </th>
                <th scope="colgroup" colSpan={3}>
                  {t.diagFirst(formatDate(cmp.first.finishedAt ?? 0))}
                </th>
                {cmp.hasComparison && (
                  <th scope="colgroup" colSpan={3}>
                    {t.diagLatest(formatDate(cmp.latest.finishedAt ?? 0))}
                  </th>
                )}
              </tr>
              <tr>
                {(cmp.hasComparison ? [0, 1] : [0]).flatMap((k) => [
                  <th key={`${k}c`} scope="col">{t.diagCorrect}</th>,
                  <th key={`${k}u`} scope="col">{t.diagUnsureCol}</th>,
                  <th key={`${k}w`} scope="col">{t.diagWrong}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {cmp.areas
                .filter((a) => a.first || a.latest)
                .map((a) => (
                  <tr key={a.area}>
                    <th scope="row">{AREAS.find((x) => x.id === a.area)?.titleTr}</th>
                    <td>{a.first?.correct ?? '–'}</td>
                    <td>{a.first?.unsure ?? '–'}</td>
                    <td>{a.first?.wrong ?? '–'}</td>
                    {cmp.hasComparison && (
                      <>
                        <td>{a.latest?.correct ?? '–'}</td>
                        <td>{a.latest?.unsure ?? '–'}</td>
                        <td>{a.latest?.wrong ?? '–'}</td>
                      </>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
          {!cmp.hasComparison && <p className="muted">{t.diagOnlyOne}</p>}
          <p data-testid="diag-retake">{retakeSuggested(attempts, systemClock.today()) ? t.diagRetakeDue : t.diagRetakeLater}</p>
        </>
      )}
    </>
  );
}
