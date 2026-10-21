// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Layering (07 §2): domain → storage → app → ui; dependencies point inward only.
const REACT = ['react', 'react/*', 'react-dom', 'react-dom/*'];
const layer = (name) => [`**/${name}`, `**/${name}/**`];

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'src/content/items.json',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // Node-side files: configs and build scripts.
    files: ['*.{js,ts}', 'scripts/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // --- Layer rules ---------------------------------------------------------
  {
    // domain: pure. No React, no IDB, no other layers, no DOM globals. Only zod.
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: REACT, message: 'domain must stay pure: no React.' },
            { group: ['idb', 'idb/*'], message: 'domain must stay pure: no IndexedDB (use storage/).' },
            {
              group: [...layer('storage'), ...layer('ui'), ...layer('app')],
              message: 'domain must not depend on storage/, ui/ or app/.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'domain must not touch the DOM/browser.' },
        { name: 'document', message: 'domain must not touch the DOM/browser.' },
        { name: 'indexedDB', message: 'domain must not touch IndexedDB.' },
        { name: 'navigator', message: 'domain must not touch the browser.' },
        { name: 'localStorage', message: 'domain must not touch browser storage.' },
        { name: 'sessionStorage', message: 'domain must not touch browser storage.' },
      ],
    },
  },
  {
    // storage: depends on domain types only, never on React, ui/ or app/.
    files: ['src/storage/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: REACT, message: 'storage must not depend on React.' },
            { group: [...layer('ui'), ...layer('app')], message: 'storage must not depend on ui/ or app/.' },
          ],
        },
      ],
    },
  },
  {
    // ui: talks to storage only through app/actions.
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: layer('storage'), message: 'ui must not import storage/; go through app/actions.' },
          ],
        },
      ],
    },
  },
);
