import { useOverlay } from '../../app/overlay.tsx';
import { topicsByArea } from '../../content/extras.ts';
import { AREAS } from '../../domain/areas.ts';
import type { Topic } from '../../domain/extrasSchema.ts';

/** Buttons that open topic pages in the app overlay. */
export function TopicButtons({ topics, testId }: { topics: readonly Topic[]; testId?: string }) {
  const { open } = useOverlay();
  if (topics.length === 0) return null;
  return (
    <div className="choice-buttons topic-buttons" data-testid={testId}>
      {topics.map((topic) => (
        <button key={topic.id} type="button" className="btn" data-testid={`topic-open-${topic.id}`} onClick={(e) => {
            e.currentTarget.focus(); // Safari does not focus a clicked button; the overlay returns focus to it
            open({ kind: 'topic', topicId: topic.id });
          }}>
          {topic.titleTr}
        </button>
      ))}
    </div>
  );
}

/** Settings "Konular": topics grouped by exam area, in AREAS order, only areas that have topics. */
export function TopicList() {
  return (
    <div className="topic-list" data-testid="topic-list">
      {AREAS.map((a) => {
        const topics = topicsByArea(a.id);
        if (topics.length === 0) return null;
        return (
          <div key={a.id} className="block">
            <h4 className="topic-list__area">{a.titleTr}</h4>
            <TopicButtons topics={topics} />
          </div>
        );
      })}
    </div>
  );
}
