import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '../../app/AppContext.tsx';
import { applyUpdateOnHome } from '../../pwa/registerSW.ts';
import { t } from '../strings.tr.ts';

/**
 * Acts as Home until Slice 4 (T4.3): the only screen where a waiting SW update
 * is applied (07 §6.2), and notebook + Settings are one tap away (02 §Ana).
 */
export function DoneScreen() {
  const { state, actions } = useApp();
  const session = state.status === 'ready' ? state.session : undefined;
  useEffect(() => applyUpdateOnHome({ hasSession: session !== undefined }), [session]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []); // focus would otherwise stay on <body> (a11y audit 08 #8)
  return (
    <div className="screen">
      <div className="screen__body screen__body--center">
        <h2 ref={headingRef} tabIndex={-1} className="done__title">
          {t.allDone}
        </h2>
        <p className="muted">{t.allDoneDetail}</p>
      </div>
      {actions && (
        <div className="screen__footer">
          <button type="button" className="btn btn--text btn--wide" onClick={() => flushSync(() => actions.openNotebook('home'))}>
            {t.notebookAdd}
          </button>
          <button type="button" className="btn btn--text btn--wide" onClick={() => actions.openSettings()}>
            {t.settings}
          </button>
        </div>
      )}
    </div>
  );
}
