import { useState } from 'react';
import { copyOrShareText, type CopyOutcome } from '../share.ts';
import { t } from '../strings.tr.ts';

const MESSAGES: Record<Exclude<CopyOutcome, 'cancelled'>, { tone: 'ok' | 'error'; text: string }> = {
  copied: { tone: 'ok', text: t.claudeCopied },
  shared: { tone: 'ok', text: t.claudeShared },
  failed: { tone: 'error', text: t.claudeCopyFailed },
};

/**
 * "Claude'a yapıştır" under the notebook export: copies a ready prompt for
 * claude.ai (the app has no API key and makes no LLM calls). The prompt is
 * built synchronously so the clipboard write stays inside the tap.
 */
export function ClaudePaste({ getPrompt }: { getPrompt: () => string | undefined }) {
  const [outcome, setOutcome] = useState<CopyOutcome>();

  async function copy() {
    setOutcome(undefined);
    const prompt = getPrompt();
    if (prompt === undefined) return;
    setOutcome(await copyOrShareText(prompt));
  }

  const message = outcome === undefined || outcome === 'cancelled' ? undefined : MESSAGES[outcome];
  return (
    <div className="block claude-paste">
      <p className="muted">{t.claudeHelpTitle}</p>
      <ol className="checklist muted">
        {t.claudeHelpSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button type="button" className="btn" onClick={() => void copy()}>
        {t.claudeCopy}
      </button>
      {message && (
        <p className={message.tone === 'error' ? 'error' : 'graded'} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
