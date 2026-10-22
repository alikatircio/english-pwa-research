import { useId, useState } from 'react';
import type { Actions, ImportItemsResult } from '../../app/actions.ts';
import { t } from '../strings.tr.ts';

interface Props {
  actions: Actions;
  busy: boolean;
  /** The outcome is shown by the items-import section, the same as for a picked file. */
  onResult: (result: ImportItemsResult | undefined) => void;
}

/**
 * "JSON'u yapıştır" next to the items-file import: on iPhone, Claude's reply is
 * copied from claude.ai and pasted here, no .json file needed. The text goes
 * through the same import as a file (actions.importItemsPaste); the box is
 * cleared once the import went through.
 */
export function PasteImport({ actions, busy, onResult }: Props) {
  const id = useId();
  const [text, setText] = useState('');

  async function submit() {
    onResult(undefined);
    const result = await actions.importItemsPaste(text);
    if (result.status === 'imported') setText('');
    onResult(result);
  }

  return (
    <div className="block paste-import">
      <label className="muted" htmlFor={id}>
        {t.itemsPasteLabel}
      </label>
      <textarea
        id={id}
        className="answer-input paste-import__field"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.itemsPastePlaceholder}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        translate="no"
      />
      <button type="button" className="btn" disabled={busy || text.trim() === ''} onClick={() => void submit()}>
        {t.itemsPasteImport}
      </button>
    </div>
  );
}
