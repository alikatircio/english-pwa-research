import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// registerSW.ts wires `virtual:pwa-register` to the DOM; here both are stand-ins (node env).
interface Hooks {
  onNeedRefresh?: () => void;
  onNeedReload?: () => void;
}
const pwa = vi.hoisted(() => ({ hooks: {} as Hooks, activate: vi.fn(() => Promise.resolve()) }));
vi.mock('virtual:pwa-register', () => ({
  registerSW: (hooks: Hooks) => {
    pwa.hooks = hooks;
    return pwa.activate;
  },
}));

const reload = vi.fn();
let visibility: DocumentVisibilityState = 'visible';

async function load() {
  vi.resetModules();
  return import('./registerSW.ts');
}

beforeEach(() => {
  vi.stubEnv('PROD', true);
  vi.stubGlobal('navigator', { serviceWorker: {} });
  vi.stubGlobal('window', { location: { reload } });
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  visibility = 'visible';
  reload.mockClear();
  pwa.activate.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('registerSW — update only on Home (07 §6.2, review 09 #2)', () => {
  it('on Home with no round: activates the waiting SW and reloads once it controls the page', async () => {
    const sw = await load();
    sw.startServiceWorker();
    pwa.hooks.onNeedRefresh?.();
    sw.applyUpdateOnHome({ hasSession: false });
    expect(pwa.activate).toHaveBeenCalledTimes(1);
    pwa.hooks.onNeedReload?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('left Home (tapped "Başla") before the new SW took control: no reload until the next safe Home moment', async () => {
    const sw = await load();
    sw.startServiceWorker();
    pwa.hooks.onNeedRefresh?.();
    const leaveHome = sw.applyUpdateOnHome({ hasSession: false });
    expect(pwa.activate).toHaveBeenCalledTimes(1);
    leaveHome(); // Home unmounts: the card screen is shown
    pwa.hooks.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();

    // Back on Home with the round still open: still no reload.
    const pausedHome = sw.applyUpdateOnHome({ hasSession: true });
    expect(reload).not.toHaveBeenCalled();
    pausedHome();
    // Round over, Home again: now it reloads, without a second SKIP_WAITING.
    sw.applyUpdateOnHome({ hasSession: false });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(pwa.activate).toHaveBeenCalledTimes(1);
  });

  it('Home now has a round (session started on Home): the reload waits', async () => {
    const sw = await load();
    sw.startServiceWorker();
    pwa.hooks.onNeedRefresh?.();
    const before = sw.applyUpdateOnHome({ hasSession: false });
    before();
    sw.applyUpdateOnHome({ hasSession: true });
    pwa.hooks.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
  });

  it('activated from another tab while this one sits on Home: deferred, not applied mid-tap', async () => {
    const sw = await load();
    sw.startServiceWorker();
    const onHome = sw.applyUpdateOnHome({ hasSession: false });
    pwa.hooks.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
    onHome();
    sw.applyUpdateOnHome({ hasSession: false });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(pwa.activate).not.toHaveBeenCalled();
  });

  it('never applies while the page is hidden', async () => {
    const sw = await load();
    sw.startServiceWorker();
    pwa.hooks.onNeedRefresh?.();
    visibility = 'hidden';
    sw.applyUpdateOnHome({ hasSession: false });
    expect(pwa.activate).not.toHaveBeenCalled();
  });
});
