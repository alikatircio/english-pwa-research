// Guard for 02 §3 / 07 §6.4: no position: fixed on the card screen (iOS standalone
// keyboard glitches move fixed elements). Checks every stylesheet and the card
// screen's components, including inline styles.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = [
  ...readdirSync('src/ui/styles').filter((f) => f.endsWith('.css')).map((f) => join('src/ui/styles', f)),
  'src/ui/screens/CardScreen.tsx',
  ...readdirSync('src/ui/components').map((f) => join('src/ui/components', f)),
];

describe('card screen layout', () => {
  it.each(files)('%s has no position: fixed', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/position\s*:\s*['"]?fixed/i);
  });

  it('the screen height follows --vvh and the footer pads for the home indicator', () => {
    const css = readFileSync('src/ui/styles/global.css', 'utf8');
    expect(css).toMatch(/height:\s*var\(--vvh,\s*100dvh\)/);
    expect(css).toMatch(/max\(16px,\s*env\(safe-area-inset-bottom\)\)/);
  });
});
