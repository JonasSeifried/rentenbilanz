import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base: './' → alle Pfade relativ, die Seite läuft auch in einem Unterordner (z. B. /rechner/).
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
