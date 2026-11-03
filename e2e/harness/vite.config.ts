// Baut die Komponenten-Testseite (nur für e2e/components.spec.ts) nach dist-harness/, getrennt von dist/.
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  base: './',
  plugins: [svelte({ configFile: new URL('../../svelte.config.js', import.meta.url).pathname })],
  build: { outDir: new URL('../../dist-harness', import.meta.url).pathname, emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0 },
});
