import { useId, useState, type KeyboardEvent } from 'react';
import type { Actions } from '../../app/actions.ts';
import type { ReadyState } from '../../app/state.ts';
import { cleanNotebookText } from '../../domain/notebook.ts';
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight.ts';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
}

/**
 * Notebook capture (03 H3.1, 02 "Defter capture"): one field, optional card
 * context, "Kaydet" at the bottom. Drawn in place of the current screen with
 * the same keyboard-aware layout (no fixed positioning, 02 §3); the screen
 * underneath keeps its state, so closing returns to the same card and draft.
 * The field is focused on mount, which happens inside the opening tap.
 */
export function NotebookSheet({ state, actions }: Props) {
  useVisualViewportHeight();
  const [text, setText] = useState('');
  const titleId = useId();
  const context = state.overlay?.kind === 'notebook' ? state.overlay.context : undefined;
  const canSave = !state.busy && cleanNotebookText(text) !== '';

  function save() {
    if (canSave) void actions.saveNotebook(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      actions.closeNotebook();
    }
  }

  return (
    <section className="screen notebook-sheet" aria-labelledby={titleId}>
      <div className="screen__body">
        <div className="sheet__header">
          <h2 id={titleId} className="sheet__title">
            {t.notebookTitle}
          </h2>
          <button type="button" className="btn btn--text" onClick={() => actions.closeNotebook()}>
            {t.notebookCancel}
          </button>
        </div>

        <textarea
          className="answer-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t.notebookLabel}
          placeholder={t.notebookPlaceholder}
          autoCapitalize="none"
          autoComplete="off"
          enterKeyHint="done"
          lang="tr"
          // Mounted inside the opening tap, so iOS opens the keyboard (H3.1).
          autoFocus
        />

        {context && (
          <div className="block">
            <p className="label">{t.notebookContext}</p>
            <p className="muted notebook-sheet__context">{context.contextTr}</p>
          </div>
        )}

        {state.error === 'save-failed' && (
          <p className="error" role="alert">
            {t.saveFailed}
          </p>
        )}
      </div>

      <div className="screen__footer">
        <button type="button" className="btn btn--primary" onClick={save} disabled={!canSave}>
          {t.notebookSave}
        </button>
      </div>
    </section>
  );
}
