import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /<repo-name>/; CI may override via BASE_PATH.
const base = process.env.BASE_PATH ?? '/english-pwa-research/';

export default defineConfig({
  base,
  plugins: [react()],
});
