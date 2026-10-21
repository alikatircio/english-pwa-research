// '@content' is a Vite alias (vite.config.ts): src/content/items.json, or the
// e2e fixture in `--mode e2e`. Both have the ContentBundle shape.
declare module '@content' {
  import type { ContentBundle } from '../domain/types.ts';
  const bundle: ContentBundle;
  export default bundle;
}
