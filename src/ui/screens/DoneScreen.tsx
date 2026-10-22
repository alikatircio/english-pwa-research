import { useEffect } from 'react';
import { useApp } from '../../app/AppContext.tsx';
import { applyUpdateOnHome } from '../../pwa/registerSW.ts';
import { t } from '../strings.tr.ts';

/** Acts as Home until Slice 4 (T4.3): the only screen where a waiting SW update is applied (07 §6.2). */
export function DoneScreen() {
  const { state } = useApp();
  const session = state.status === 'ready' ? state.session : undefined;
  useEffect(() => applyUpdateOnHome({ hasSession: session !== undefined }), [session]);
  return (
    <div className="screen">
      <div className="screen__body screen__body--center">
        <p className="done__title">{t.allDone}</p>
        <p className="muted">{t.allDoneDetail}</p>
      </div>
    </div>
  );
}
