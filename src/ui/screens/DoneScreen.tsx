import { t } from '../strings.tr.ts';

export function DoneScreen() {
  return (
    <div className="screen">
      <div className="screen__body screen__body--center">
        <p className="done__title">{t.allDone}</p>
        <p className="muted">{t.allDoneDetail}</p>
      </div>
    </div>
  );
}
