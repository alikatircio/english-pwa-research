import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyOrShareText } from './share.ts';

type Nav = {
  clipboard?: { writeText: (s: string) => Promise<void> };
  share?: (d: ShareData) => Promise<void>;
  canShare?: (d: ShareData) => boolean;
};
const stubNavigator = (nav: Nav) => vi.stubGlobal('navigator', nav);
const abort = () => Promise.reject(new DOMException('closed', 'AbortError'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyOrShareText', () => {
  it('writes to the clipboard when it can', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const share = vi.fn(() => Promise.resolve());
    stubNavigator({ clipboard: { writeText }, share });
    expect(await copyOrShareText('istem')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('istem');
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back to the Web Share text sheet when the clipboard refuses', async () => {
    const share = vi.fn<(d: ShareData) => Promise<void>>(() => Promise.resolve());
    stubNavigator({
      clipboard: { writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) },
      share,
      canShare: () => true,
    });
    expect(await copyOrShareText('istem')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'istem' });
  });

  it('falls back to Web Share when there is no clipboard API', async () => {
    stubNavigator({ share: () => Promise.resolve() });
    expect(await copyOrShareText('istem')).toBe('shared');
  });

  it('a closed share sheet is "cancelled", not an error', async () => {
    stubNavigator({ share: abort });
    expect(await copyOrShareText('istem')).toBe('cancelled');
  });

  it('fails when neither works', async () => {
    stubNavigator({});
    expect(await copyOrShareText('istem')).toBe('failed');
    stubNavigator({ share: () => Promise.reject(new Error('x')) });
    expect(await copyOrShareText('istem')).toBe('failed');
    stubNavigator({ share: () => Promise.resolve(), canShare: () => false });
    expect(await copyOrShareText('istem')).toBe('failed');
  });
});
