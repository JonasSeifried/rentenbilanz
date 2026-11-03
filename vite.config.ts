import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { SITE } from './src/lib/site.ts';

// Ersetzt %SITE_NAME% in den HTML-Seiten, damit der Name nur in src/lib/site.ts steht.
const siteName = (): Plugin => ({
  name: 'site-name',
  transformIndexHtml: html => html.replaceAll('%SITE_NAME%', SITE.name),
});

// base: './' → alle Pfade relativ, die Seite läuft auch in einem Unterordner (z. B. /rechner/).
export default defineConfig({
  base: './',
  plugins: [svelte(), siteName()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: { input: { main: 'index.html', impressum: 'impressum.html', datenschutz: 'datenschutz.html' } },
  },
});
