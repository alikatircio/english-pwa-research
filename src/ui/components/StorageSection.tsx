import { useState } from 'react';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { t } from '../strings.tr.ts';

/**
 * Settings → "Depolama" (T5.5): one line with the stored persist() result and,
 * while it is off, a button that asks again (persist() needs a user tap).
 */
export function StorageSection({ state, actions }: { state: ReadyState; actions: Actions }) {
  const [asking, setAsking] = useState(false);
  const on = state.meta.persist === true;

  async function ask() {
    setAsking(true);
    try {
      await actions.requestPersist();
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="settings-section" aria-labelledby="storage-title">
      <h3 className="label" id="storage-title">
        {t.storageSection}
      </h3>
      <p data-testid="persist-state" role="status">
        {on ? t.persistOn : t.persistOff}
      </p>
      <p className="muted">{t.persistHint}</p>
      {!on && (
        <button type="button" className="btn" disabled={asking} onClick={() => void ask()}>
          {t.persistRequest}
        </button>
      )}
    </section>
  );
}
