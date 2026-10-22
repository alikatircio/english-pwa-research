import { useState, type ReactNode } from 'react';
import type { Actions, ExportFile } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { shareOrDownload } from '../share.ts';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
}

type Status = { tone: 'ok' | 'error'; text: string } | undefined;

/**
 * Settings, first version (T3.3): notebook export and flags report. Later
 * slices add item import (T3.4) and backup (T5.4). No counts for open
 * notebook entries (05 §4): only whether something is waiting.
 */
export function SettingsScreen({ state, actions }: Props) {
  const [status, setStatus] = useState<Status>();
  const hasOpenEntries = state.notebook.some((e) => e.status === 'open');
  const hasFlags = state.flags.size > 0;

  async function hand(file: ExportFile | undefined | Promise<ExportFile | undefined>) {
    setStatus(undefined);
    try {
      const ready = await file;
      if (!ready) return;
      const outcome = await shareOrDownload(ready);
      if (outcome === 'shared') setStatus({ tone: 'ok', text: t.exportShared });
      else if (outcome === 'downloaded') setStatus({ tone: 'ok', text: t.exportDownloaded });
    } catch {
      setStatus({ tone: 'error', text: t.exportFailed });
    }
  }

  return (
    <div className="screen settings-screen">
      <div className="screen__body">
        <div className="sheet__header">
          <h2 className="sheet__title">{t.settings}</h2>
          <button type="button" className="btn btn--text" onClick={() => actions.closeSettings()}>
            {t.back}
          </button>
        </div>

        <Section title={t.notebookSection}>
          <p className="muted">{hasOpenEntries ? t.notebookPending : t.notebookNothingPending}</p>
          <button type="button" className="btn" disabled={!hasOpenEntries} onClick={() => void hand(actions.exportNotebook())}>
            {t.notebookExport}
          </button>
        </Section>

        <Section title={t.flagsSection}>
          <p className="muted">{hasFlags ? t.flagsHint : t.flagsNone}</p>
          <button type="button" className="btn" disabled={!hasFlags} onClick={() => void hand(actions.exportFlags())}>
            {t.flagsExport}
          </button>
        </Section>

        {status && (
          <p className={status.tone === 'error' ? 'error' : 'graded'} role={status.tone === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        )}
      </div>
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
