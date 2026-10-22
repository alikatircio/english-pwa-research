import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import type { ContentBundle, Item } from '../../../src/domain/types.ts';
import { t } from '../../../src/ui/strings.tr.ts';

/** The e2e build serves this fixture (vite --mode e2e), in file order. */
export const fixture = JSON.parse(readFileSync('content/fixtures/e2e-items.json', 'utf8')) as ContentBundle;
export const items: readonly Item[] = fixture.items;
export const canonical = (i: number): string => items[i]?.acceptedAnswers[0] ?? '';
/** iOS keyboards type ’ instead of '. */
export const smart = (s: string): string => s.replace(/'/g, '’');

export class App {
  readonly input: Locator;
  readonly check: Locator;
  readonly next: Locator;
  readonly situation: Locator;
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.input = page.getByRole('textbox', { name: t.questionHeading });
    this.check = page.getByRole('button', { name: t.check });
    this.next = page.getByRole('button', { name: t.next });
    this.situation = page.locator('.situation');
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
   * Home and (by default) tap "Başla".
   */
  async open(time = '2026-11-02T08:00:00', { start = true } = {}): Promise<void> {
    await this.page.clock.install({ time });
    await this.page.goto('./');
    await expect(this.todayCount).toBeVisible();
    if (start) await this.start();
  }

  /** Tap "Başla · bugün N" on Home; the first card opens with the keyboard (focus). */
  async start(): Promise<void> {
    await this.startButton.click();
    // By class: a notebook item's field is named "İngilizcesi neydi?", not the usual heading.
    await expect(this.page.locator('.answer-input')).toBeFocused();
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
    await this.input.fill(text);
    if (via === 'enter') await this.input.press('Enter');
    else await this.check.click();
  }

  grade(label: string): Promise<void> {
    return this.page.getByRole('group', { name: t.howWasIt }).getByRole('button', { name: label }).click();
  }
}
