import { describe, expect, it, vi } from 'vitest';
import { exportPreparedBackup } from './backupExport.ts';

const file = { filename: 'b.json', text: '{}' };

describe('exportPreparedBackup', () => {
  it('shares, then records the export', async () => {
    const order: string[] = [];
    const share = vi.fn(() => {
      order.push('share');
      return Promise.resolve('shared' as const);
    });
    const mark = vi.fn(() => {
      order.push('mark');
      return Promise.resolve();
    });
    expect(await exportPreparedBackup(file, mark, share)).toBe('shared');
    expect(share).toHaveBeenCalledWith(file);
    expect(order).toEqual(['share', 'mark']);
  });

  it('calls share synchronously (iOS gesture) and reports a download', async () => {
    const share = vi.fn(() => Promise.resolve('downloaded' as const));
    const pending = exportPreparedBackup(file, () => Promise.resolve(), share);
    expect(share).toHaveBeenCalledTimes(1); // before any await resolved
    expect(await pending).toBe('downloaded');
  });

  it('does not record a cancelled share', async () => {
    const mark = vi.fn(() => Promise.resolve());
    expect(await exportPreparedBackup(file, mark, () => Promise.resolve('cancelled'))).toBe('cancelled');
    expect(mark).not.toHaveBeenCalled();
  });

  it('reports failure when sharing throws', async () => {
    const mark = vi.fn(() => Promise.resolve());
    expect(await exportPreparedBackup(file, mark, () => Promise.reject(new Error('x')))).toBe('failed');
    expect(mark).not.toHaveBeenCalled();
  });
});
