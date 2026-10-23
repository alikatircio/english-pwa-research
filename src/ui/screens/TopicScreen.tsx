import { useEffect, useRef } from 'react';
import { useApp } from '../../app/AppContext.tsx';
import { useOverlay } from '../../app/overlay.tsx';
import { AREAS } from '../../domain/areas.ts';
import { formatBookRef } from '../../domain/bookRef.ts';
import { topicById } from '../../content/extras.ts';
import { t } from '../strings.tr.ts';

/** English example with the pattern wrapped in <mark>. */
function Highlighted({ en, highlight }: { en: string; highlight: string }) {
  const at = en.indexOf(highlight);
  if (at < 0) return <>{en}</>;
  return (
    <>
      {en.slice(0, at)}
      <mark>{highlight}</mark>
      {en.slice(at + highlight.length)}
    </>
  );
}

/** Read-only topic page (Faz 4). Shown as an app overlay; never writes progress, counters or the log. */
export function TopicScreen({ topicId }: { topicId: string }) {
  const { close } = useOverlay();
  const { state } = useApp();
  const heading = useRef<HTMLHeadingElement>(null);
  const topic = topicById(topicId);

  useEffect(() => {
    heading.current?.focus();
  }, [topicId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const catalog = state.status === 'ready' ? state.catalog.byId : undefined;
  const chunks = topic ? topic.itemIds.flatMap((id) => catalog?.get(id)?.targetChunk ?? []) : [];
  const area = topic ? AREAS.find((a) => a.id === topic.area) : undefined;

  return (
    <div className="screen topic-screen" data-testid="topic-page">
      <div className="screen__body">
        <div className="sheet__header">
          <h2 className="sheet__title" ref={heading} tabIndex={-1} data-testid="topic-heading">
            {topic?.titleTr ?? t.topicLesson}
          </h2>
          <button type="button" className="btn btn--text" data-testid="topic-close" onClick={close}>
            {t.topicClose}
          </button>
        </div>
        {topic && (
          <>
            <p>{topic.summaryTr}</p>
            {area && (
              <p className="muted">
                {t.topicExamArea}: {area.titleTr}
              </p>
            )}

            {topic.sections.map((s) => (
              <section key={s.headingTr} className="topic-section">
                <h3 className="label">{s.headingTr}</h3>
                {s.bodyTr.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.examples.length > 0 && (
                  <ul className="topic-examples">
                    {s.examples.map((ex) => (
                      <li key={ex.en}>
                        <span lang="en">
                          <Highlighted en={ex.en} highlight={ex.highlight} />
                        </span>
                        <span className="muted">{ex.tr}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {topic.traps.length > 0 && (
              <section className="topic-trap" aria-labelledby="topic-trap-title" data-testid="topic-traps">
                <h3 className="label" id="topic-trap-title">
                  {t.topicTrapTitle}
                </h3>
                {topic.traps.map((tr) => (
                  <div key={tr.wrongEn} className="topic-trap__item">
                    <p className="topic-trap__wrong" lang="en">
                      <span aria-hidden="true">✗ </span>
                      <span className="visually-hidden" lang="tr">{t.topicWrong}: </span>
                      <s>{tr.wrongEn}</s>
                    </p>
                    <p className="topic-trap__right" lang="en">
                      <span aria-hidden="true">✓ </span>
                      <span className="visually-hidden" lang="tr">{t.topicRight}: </span>
                      {tr.rightEn}
                    </p>
                    <p className="muted">{tr.noteTr}</p>
                  </div>
                ))}
              </section>
            )}

            {chunks.length > 0 && (
              <section className="topic-section" data-testid="topic-cards">
                <h3 className="label">{t.topicRelatedCards}</h3>
                <ul className="topic-examples" lang="en">
                  {chunks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            {topic.refs.length > 0 && (
              <section className="topic-section">
                <h3 className="label">{t.topicSources}</h3>
                <ul className="topic-examples" data-testid="topic-refs">
                  {topic.refs.map((r) => (
                    <li key={`${r.book}${r.unit}`}>{t.topicRefLine(formatBookRef(r), r.titleTr)}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
