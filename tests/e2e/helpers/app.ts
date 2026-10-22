import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import type { ContentBundle, Item } from '../../../src/domain/types.ts';
import { t } from '../../../src/ui/strings.tr.ts';
import { seedStores } from './seed.ts';

/** The e2e build serves this fixture (vite --mode e2e), in file order. */
export const fixture = JSON.parse(readFileSync('content/fixtures/e2e-items.json', 'utf8')) as ContentBundle;
export const items: readonly Item[] = fixture.items;
export const canonical = (i: number): string => items[i]?.acceptedAnswers[0] ?? '';
/** iOS keyboards type ’ instead of '. */
export const smart = (s: string): string => s.replace(/'/g, '’');

/** Daily new-card cap the specs run with: the pre-decision-29 value of 5, seeded into meta by `App.open` (the app default is 10). */
export const NEW_CAP = 5;

export class App {
  readonly input: Locator;
  readonly check: Locator;
  readonly next: Locator;
  readonly situation: Locator;
  /** "Hazırım" on a new card's study view (decision 33). */
  readonly ready: Locator;
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.input = page.getByRole('textbox', { name: t.questionHeading });
    this.check = page.getByRole('button', { name: t.check });
    this.next = page.getByRole('button', { name: t.next });
    this.situation = page.locator('.situation');
    this.ready = page.getByRole('button', { name: t.studyReady });
    this.startButton = page.getByRole('button', { name: /^Başla · bugün \d+$/ });
    this.resumeButton = page.getByRole('button', { name: t.resume });
    this.todayCount = page.getByTestId('today-count');
  }

  /** Home's single bottom button: "Başla · bugün N". */
  readonly startButton: Locator;
  readonly resumeButton: Locator;
  readonly todayCount: Locator;

  /**
   * Fixed clock (07 §7.3) so day keys are deterministic, then open the app on
   * Home and (by default) tap "Başla". Seeds the daily new-card cap (`cap`,
   * default NEW_CAP) first; pass `cap: null` to run with the app default.
   */
  async open(time = '2026-11-02T08:00:00', { start = true, cap = NEW_CAP as number | null, mode = 'write' }: { start?: boolean; cap?: number | null; mode?: 'write' | 'auto' } = {}): Promise<void> {
    // The e2e build lets localStorage 'e2e-mode' pin the exercise shape (src/app/mode.ts). Specs that type
    // answers keep 'write'; the mode specs pass 'auto' to get the real rotation (decision 31).
    if (mode === 'write') {
      await this.page.addInitScript(() => {
        try {
          localStorage.setItem('e2e-mode', 'write');
        } catch {
          /* storage blocked: the app falls back to the real rotation */
        }
      });
    }
    await this.page.clock.install({ time });
    await this.page.goto('./');
    await expect(this.todayCount).toBeVisible();
    if (cap !== null) {
      await seedStores(this.page, { put: { meta: [{ key: 'dailyNewCap', value: cap }] } });
      await this.page.reload();
      await expect(this.todayCount).toBeVisible();
    }
    if (start) await this.start();
  }

  /** Tap "Başla · bugün N" on Home; the first card opens with the keyboard (focus). */
  async start(): Promise<void> {
    await this.startButton.click();
    await this.passStudy();
    // By class: a notebook item's field is named "İngilizcesi neydi?", not the usual heading.
    await expect(this.page.locator('.answer-input')).toBeFocused();
  }

  /**
   * A new card opens on its study view (decision 33): tap "Hazırım" if it is showing.
   * Waits for either the study view or the question, so it is safe for due cards too.
   */
  async passStudy(): Promise<void> {
    const question = this.page.locator('.answer-input, .word-order');
    await question.or(this.ready).first().waitFor();
    if (await this.ready.isVisible()) await this.ready.click();
  }

  /** Reload, then "Devam et" on Home back into the open round. */
  async reloadAndResume(): Promise<void> {
    await this.page.reload();
    await this.resumeButton.click();
  }

  /** Situation text without the "[…]" context tag. */
  situationOf(i: number): string {
    return (items[i]?.situationTr ?? '').replace(/^\[[^\]]+\]\s*/, '');
  }

  async answer(text: string, via: 'enter' | 'button' = 'enter'): Promise<void> {
    await this.passStudy();
    await this.input.fill(text);
    if (via === 'enter') await this.input.press('Enter');
    else await this.check.click();
  }

  grade(label: string): Promise<void> {
    return this.page.getByRole('group', { name: t.howWasIt }).getByRole('button', { name: label }).click();
  }
}
