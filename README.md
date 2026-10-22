# English PWA

A small offline-first web app for practising **producing** English, not just recognising it. Built for a Turkish-speaking software professional (B1–B2 → C1).

Live: https://alikatircio.github.io/english-pwa-research/

## What it is and how it teaches

You see a situation in Turkish and write the English sentence yourself, before seeing any answer.

- **Produce first.** Every card asks you to type the answer before anything is revealed.
- **Chunks with their pattern.** You learn a target chunk together with its slot pattern (for example a verb plus the preposition it takes), not isolated words.
- **Spaced repetition (Leitner).** Correct answers move a card up a box and lengthen the interval; wrong answers send it back to box 1. Intervals are defined in `src/domain/scheduler.ts` (currently 1, 2, 4, 8 and 16 days across 5 boxes).
- **Hints on demand.** Nothing is shown until you ask. Hints escalate from a cloze to word initials.
- **In-round re-ask.** A card you miss comes back at the end of the same round. The repeat never changes its box.
- **Free practice and fix-the-mistake.** Practise outside the schedule, and turn your own mistakes into new cards (see the notebook workflow below).
- **Offline.** After the first load the app runs without a network (service worker).
- **No account, no backend, no LLM calls.** All data lives in IndexedDB on your device.

## Using it on iPhone

1. Open the live URL in Safari.
2. Tap Share, then **Add to Home Screen**. Do this before you rely on the app: iOS can evict storage of sites that are not installed.
3. Back up regularly from Settings: export a backup file and keep it somewhere safe. Restore either merges it into the current data or replaces everything on the device.

## Notebook → Claude → import

The app never talks to an LLM. You do, in claude.ai, and bring the result back.

1. Save the mistakes you want to learn from in the notebook.
2. Tap **Claude'a yapıştır** to copy a ready-made prompt, and paste it into a new claude.ai chat.
3. Copy Claude's JSON answer, paste it into the **JSON'u yapıştır** box, and import.
4. The items are validated against the same item schema as bundled content, then join your cards.

## Content quality

- Every bundled item is verified independently of its author. Only items with `verified: true` and a `verifiedNote` ship; unverified drafts never reach the bundle.
- `npm run content:build` runs checks **C1–C13** and stops on any error:
  - schema, ids, list sizes and the canonical answer (C1–C3)
  - the common mistake is never an accepted answer (C4)
  - cloze alignment (C5), redundant variants (C6), verification notes (C7)
  - **privacy:** contact and address patterns (C8), a private term denylist (C9), unexpected proper nouns (C10)
  - a shipped id may never disappear, so progress is never orphaned (C11)
  - note wording (C12) and a non-empty bundle (C13)
- C6, C10 and C12 report warnings or info; the rest fail the build.

## Development

Node version is pinned in `.nvmrc`.

```bash
nvm use
npm ci
npm run dev
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (builds content first) |
| `npm run build` | Production build (builds content first) |
| `npm run content:build` | Validate drafts and generate the content bundle |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint, including the layer rules |
| `npm run typecheck` | `tsc -b` |

E2E runs against a production preview build in two projects: `iphone-webkit` (iPhone 15, runs every spec) and `android-chromium` (Pixel 7, the required gate for offline and service-worker specs). Install browsers once with `npx playwright install webkit chromium`.

## Architecture

- `src/domain`: pure logic (scheduler, session, hints, normalisation, backup format). No React, no IndexedDB, no DOM.
- `src/storage`: IndexedDB access and migrations. Depends on domain types only.
- `src/app`: state and actions that connect storage to the UI.
- `src/ui`: React screens and components. Never imports `storage/`; it goes through `app/actions`.
- ESLint enforces the direction `ui → app → storage → domain`; breaking it fails `npm run lint`.

## Deploy

Pull requests and pushes to `main` run CI (content build, typecheck, lint, unit and e2e tests). When CI succeeds on `main`, the Deploy workflow builds the site and publishes it to GitHub Pages.

Both workflows read the `PRIVACY_DENYLIST` repository secret (one term per line) for check C9. On CI a missing secret is an error, so the real-name check cannot be skipped silently.
