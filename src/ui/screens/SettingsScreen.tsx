import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Actions, ExportFile, ImportItemsResult } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { BackupSection } from '../components/BackupSection.tsx';
import { StorageSection } from '../components/StorageSection.tsx';
import { ClaudePaste } from '../components/ClaudePaste.tsx';
import { PasteImport } from '../components/PasteImport.tsx';
import { BUILD } from '../../buildInfo.ts';
import { settingsVersionLine } from '../buildLines.ts';
import { DAILY_NEW_CAP, NEW_CAP_OPTIONS } from '../../domain/session.ts';
import { shareOrDownload } from '../share.ts';
import { t } from '../strings.tr.ts';
import { formatDate } from '../format.ts';
import { TopicList } from './TopicList.tsx';
import type { DiagnosticView } from '../../app/mode.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
  onDiagnostic: (view: DiagnosticView | undefined) => void;
  /** Focus the Seviye testi entry button on mount (coming back from a test view). */
  focusDiagnostic?: boolean;
  onFocusedDiagnostic?: () => void;
}

type Status = { tone: 'ok' | 'error'; text: string } | undefined;

/**
 * Settings, first version (T3.3, T3.4): notebook export, flags report and
 * items import; full backup in BackupSection (T5.4). No counts for open
 * notebook entries (05 §4): only whether something is waiting.
 */
export function SettingsScreen({ state, actions, onDiagnostic, focusDiagnostic, onFocusedDiagnostic }: Props) {
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

        <Section title={t.capSection}>
          <p className="muted">{t.capHint}</p>
          <div role="radiogroup" aria-label={t.capLabel} className="choice-buttons">
            {NEW_CAP_OPTIONS.map((n) => {
              const selected = (state.meta.dailyNewCap ?? DAILY_NEW_CAP) === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? 'btn btn--choice btn--primary' : 'btn btn--choice'}
                  onClick={() => void actions.setDailyNewCap(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t.notebookSection}>
          <p className="muted">{hasOpenEntries ? t.notebookPending : t.notebookNothingPending}</p>
          <button type="button" className="btn" disabled={!hasOpenEntries} onClick={() => void hand(actions.exportNotebook())}>
            {t.notebookExport}
          </button>
          {hasOpenEntries && <ClaudePaste getPrompt={() => actions.claudePrompt()} />}
        </Section>

        <Section title={t.flagsSection}>
          <p className="muted">{hasFlags ? t.flagsHint : t.flagsNone}</p>
          <button type="button" className="btn" disabled={!hasFlags} onClick={() => void hand(actions.exportFlags())}>
            {t.flagsExport}
          </button>
        </Section>

        {actions.diagnosticAvailable() && <DiagnosticEntry state={state} actions={actions} onDiagnostic={onDiagnostic} focusDiagnostic={focusDiagnostic} onFocusedDiagnostic={onFocusedDiagnostic} />}

        <Section title={t.topicsSection}>
          <p className="muted">{t.topicsHint}</p>
          <TopicList />
        </Section>

        <ItemsImport actions={actions} busy={state.busy} />

        {/* Slice 5: full backup (T5.4) and persistent storage (T5.5), in their own components. */}
        <BackupSection state={state} actions={actions} />
        <StorageSection state={state} actions={actions} />

        <p className="version-line muted" data-testid="version-settings">
          {settingsVersionLine(BUILD)}
        </p>

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

/** Seviye testi entry (decision 47): start or continue, last result, history. Never touches cards. */
function DiagnosticEntry({ state, actions, onDiagnostic, focusDiagnostic, onFocusedDiagnostic }: Props) {
  const entry = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusDiagnostic) return;
    entry.current?.focus();
    onFocusedDiagnostic?.();
  }, [focusDiagnostic, onFocusedDiagnostic]);
  const attempts = state.diagnostic?.attempts ?? [];
  const open = state.diagnostic?.open;
  const last = attempts.findLast((a) => a.finishedAt !== undefined);

  async function start() {
    await actions.openDiagnostic();
    onDiagnostic({ kind: 'test' });
  }

  return (
    <Section title={t.diagSection}>
      <details className="block diag-help" data-testid="diag-help">
        <summary>{t.diagHelpTitle}</summary>
        <ol className="notebook-help__steps">
          {t.diagHelpSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
      <p className="muted">{t.diagHint}</p>
      <button ref={entry} type="button" className="btn" disabled={state.busy} onClick={() => void start()}>
        {open ? t.diagContinue : t.diagStart}
      </button>
      <p className="muted">{last?.finishedAt !== undefined ? t.diagLastResult(formatDate(last.finishedAt)) : t.diagNoResult}</p>
      {last && (
        <div className="choice-buttons">
          <button type="button" className="btn" onClick={() => onDiagnostic({ kind: 'result', attemptId: last.id })}>
            {t.diagShowResult}
          </button>
          <button type="button" className="btn" onClick={() => onDiagnostic({ kind: 'history' })}>
            {t.diagHistory}
          </button>
        </div>
      )}
    </Section>
  );
}

const MAX_ERRORS = 8;

/** Items import (T3.4): pick a file, validate everything, then write in one go. */
function ItemsImport({ actions, busy }: { actions: Actions; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportItemsResult>();

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be picked again
    if (!file) return;
    setResult(undefined);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setResult({ status: 'invalid', errors: [{ code: 'invalid-json', path: '', message: 'unreadable file' }] });
      return;
    }
    setResult(await actions.importItemsFile(text));
  }

  return (
    <Section title={t.itemsSection}>
      <p className="muted">{t.itemsHint}</p>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={t.itemsChoose}
        onChange={(e) => void onFile(e)}
      />
      <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
        {t.itemsChoose}
      </button>
      <PasteImport actions={actions} busy={busy} onResult={setResult} />
      {result && <ImportOutcome result={result} />}
    </Section>
  );
}

function ImportOutcome({ result }: { result: ImportItemsResult }) {
  // Another write was in flight and nothing was tried: no error to show; the buttons are disabled meanwhile.
  if (result.status === 'busy') return null;
  if (result.status === 'save-failed') {
    return (
      <p className="error" role="alert">
        {t.saveFailed}
      </p>
    );
  }
  if (result.status === 'invalid') {
    const shown = result.errors.slice(0, MAX_ERRORS);
    return (
      <div className="error import-errors" role="alert">
        <p>{t.itemsInvalid}</p>
        <ul>
          {shown.map((e, i) => (
            <li key={i}>
              {t.importErrors[e.code]}
              {e.path !== '' && e.code === 'invalid' && (
                <>
                  {': '}
                  <code>{e.path}</code>
                </>
              )}
            </li>
          ))}
        </ul>
        {result.errors.length > MAX_ERRORS && <p>{t.itemsMoreErrors(result.errors.length - MAX_ERRORS)}</p>}
      </div>
    );
  }
  return (
    <div className="block" role="status">
      <p className="graded">{result.importedIds.length > 0 ? t.itemsImported : t.itemsNoneImported}</p>
      {result.rejected.length > 0 && (
        <>
          <p className="muted">{t.itemsRejected}</p>
          <ul className="checklist import-rejected">
            {result.rejected.map((r) => (
              <li key={`${r.id}:${r.reason}`}>
                <code>{r.id}</code> — {t.rejectReasons[r.reason]}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
