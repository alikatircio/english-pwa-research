import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Actions, ExportFile, RestoreMode } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import type { BackupFileV1, ImportError, RejectedItem } from '../../domain/backup.ts';
import { formatDate } from '../format.ts';
import { shareOrDownload } from '../share.ts';
import { t } from '../strings.tr.ts';

const MAX_ERRORS = 8;

type Status = { tone: 'ok' | 'error'; text: string } | undefined;

/**
 * Settings → "Yedek" (T5.4): full backup export and restore. Kept in its own
 * section/component so the rest of Settings stays independent of it.
 */
export function BackupSection({ state, actions }: { state: ReadyState; actions: Actions }) {
  const [prepared, setPrepared] = useState<ExportFile>();
  const [status, setStatus] = useState<Status>();
  const { progress, notebook, catalog, flags } = state;

  // Read the backup ahead of the tap: on iOS the share sheet only opens inside the gesture,
  // and an IndexedDB read between the tap and navigator.share() can lose it.
  useEffect(() => {
    let live = true;
    actions
      .prepareBackup()
      .then((file) => {
        if (live) setPrepared(file);
      })
      .catch(() => {
        if (live) setPrepared(undefined);
      });
    return () => {
      live = false;
    };
  }, [actions, progress, notebook, catalog, flags]);

  async function onExport() {
    if (!prepared) return;
    setStatus(undefined);
    try {
      const outcome = await shareOrDownload(prepared);
      if (outcome === 'cancelled') return;
      await actions.markBackupExported();
      setStatus({ tone: 'ok', text: outcome === 'shared' ? t.exportShared : t.exportDownloaded });
    } catch {
      setStatus({ tone: 'error', text: t.exportFailed });
    }
  }

  return (
    <section className="settings-section" aria-labelledby="backup-title">
      <h3 className="label" id="backup-title">
        {t.backupSection}
      </h3>
      <p data-testid="last-backup">{state.meta.lastExportAt === undefined ? t.lastBackupNever : t.lastBackup(formatDate(state.meta.lastExportAt))}</p>
      <p className="muted">{t.backupHint}</p>
      <button type="button" className="btn" disabled={!prepared} onClick={() => void onExport()}>
        {t.backupExport}
      </button>
      {status && (
        <p className={status.tone === 'error' ? 'error' : 'graded'} role={status.tone === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      <BackupRestore actions={actions} busy={state.busy} />
    </section>
  );
}

type Step =
  | { step: 'idle' }
  | { step: 'choose'; file: BackupFileV1 }
  | { step: 'confirm-replace'; file: BackupFileV1 }
  | { step: 'invalid'; errors: ImportError[] }
  | { step: 'restored'; rejected: RejectedItem[] }
  | { step: 'save-failed' };

/**
 * "Yedekten geri yükle": pick a file, validate all of it, then "Birleştir" or
 * "Tümünü değiştir" (the latter asks once more). Also used by the first-run welcome.
 */
export function BackupRestore({ actions, busy, buttonClass = 'btn' }: { actions: Actions; busy: boolean; buttonClass?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ step: 'idle' });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be picked again
    if (!file) return;
    setStep({ step: 'idle' });
    let text: string;
    try {
      text = await file.text();
    } catch {
      setStep({ step: 'invalid', errors: [{ code: 'invalid-json', path: '', message: 'unreadable file' }] });
      return;
    }
    const checked = actions.checkBackupFile(text);
    setStep(checked.status === 'valid' ? { step: 'choose', file: checked.file } : { step: 'invalid', errors: checked.errors });
  }

  async function restore(file: BackupFileV1, mode: RestoreMode) {
    const result = await actions.restoreBackup(file, mode);
    if (result.status === 'busy') return; // nothing was tried: keep the choice on screen
    setStep(result.status === 'restored' ? { step: 'restored', rejected: result.rejected } : { step: 'save-failed' });
  }

  const choosing = step.step === 'choose' || step.step === 'confirm-replace';

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        // The visible button opens it; keep the hidden input out of the accessibility tree.
        aria-hidden="true"
        data-testid="backup-file"
        onChange={(e) => void onFile(e)}
      />
      {!choosing && (
        <button type="button" className={buttonClass} disabled={busy} onClick={() => input.current?.click()}>
          {t.backupRestore}
        </button>
      )}

      {step.step === 'choose' && (
        <div className="block backup-choice" role="group" aria-labelledby="backup-choice-title">
          <p id="backup-choice-title">{t.backupChooseMode}</p>
          <button type="button" className="btn" disabled={busy} onClick={() => void restore(step.file, 'merge')}>
            {t.backupMerge}
          </button>
          <p className="muted">{t.backupMergeHint}</p>
          <button type="button" className="btn" disabled={busy} onClick={() => setStep({ step: 'confirm-replace', file: step.file })}>
            {t.backupReplace}
          </button>
          <p className="muted">{t.backupReplaceHint}</p>
          <button type="button" className="btn btn--text" onClick={() => setStep({ step: 'idle' })}>
            {t.backupCancel}
          </button>
        </div>
      )}

      {step.step === 'confirm-replace' && (
        <div className="block backup-choice" role="alertdialog" aria-labelledby="backup-confirm-title">
          <p id="backup-confirm-title" className="error">
            {t.backupReplaceConfirm}
          </p>
          <button type="button" className="btn" disabled={busy} onClick={() => void restore(step.file, 'replace')}>
            {t.backupReplaceYes}
          </button>
          <button type="button" className="btn btn--text" onClick={() => setStep({ step: 'idle' })}>
            {t.backupCancel}
          </button>
        </div>
      )}

      {step.step === 'invalid' && <BackupErrors errors={step.errors} />}
      {step.step === 'save-failed' && (
        <p className="error" role="alert">
          {t.saveFailed}
        </p>
      )}
      {step.step === 'restored' && (
        <div className="block" role="status">
          <p className="graded">{t.backupRestored}</p>
          {step.rejected.length > 0 && (
            <>
              <p className="muted">{t.backupRejected}</p>
              <ul className="checklist import-rejected">
                {step.rejected.map((r) => (
                  <li key={`${r.id}:${r.reason}`}>
                    <code>{r.id}</code> — {t.rejectReasons[r.reason]}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}

function BackupErrors({ errors }: { errors: readonly ImportError[] }) {
  const shown = errors.slice(0, MAX_ERRORS);
  return (
    <div className="error import-errors" role="alert">
      <p>{t.backupInvalid}</p>
      <ul>
        {shown.map((e, i) => (
          <li key={i}>
            {t.backupImportErrors[e.code]}
            {e.path !== '' && e.code === 'invalid' && (
              <>
                {': '}
                <code>{e.path}</code>
              </>
            )}
          </li>
        ))}
      </ul>
      {errors.length > MAX_ERRORS && <p>{t.itemsMoreErrors(errors.length - MAX_ERRORS)}</p>}
    </div>
  );
}
