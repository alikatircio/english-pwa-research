import { forwardRef, type KeyboardEvent } from 'react';
import { t } from '../strings.tr.ts';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

/**
 * Answer field (02 §3, 06 decision 9): no autocorrect/spellcheck (the user must
 * see their own mistakes), sentence capitalisation, ≥16px so iOS does not zoom,
 * Enter submits (Shift+Enter and IME composition excluded).
 */
export const AnswerInput = forwardRef<HTMLTextAreaElement, Props>(function AnswerInput({ value, onChange, onSubmit, disabled }, ref) {
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim() !== '') onSubmit();
    }
  }
  return (
    <textarea
      ref={ref}
      className="answer-input"
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      disabled={disabled}
      aria-label={t.answerLabel}
      placeholder={t.answerPlaceholder}
      autoCorrect="off"
      autoCapitalize="sentences"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="go"
      lang="en"
    />
  );
});
