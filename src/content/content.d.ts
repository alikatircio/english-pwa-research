// '@content' is a Vite alias (vite.config.ts): src/content/items.json, or the
// e2e fixture in `--mode e2e`. Both have the ContentBundle shape.
declare module '@content' {
  import type { ContentBundle } from '../domain/types.ts';
  const bundle: ContentBundle;
  export default bundle;
}

// '@extras' is a Vite alias: src/content/extras.json, or content/fixtures/e2e-extras.json
// in `--mode e2e`. Both have the ExtrasBundle shape.
declare module '@extras' {
  import type { ExtrasBundle } from '../domain/extrasSchema.ts';
  const bundle: ExtrasBundle;
  export default bundle;
}
