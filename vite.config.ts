import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { SITE } from './src/lib/site.ts';

// Ersetzt %SITE_NAME% in den HTML-Seiten, damit der Name nur in src/lib/site.ts steht,
// und setzt canonical/og:url, sobald SITE.url gefüllt ist.
const siteName = (): Plugin => ({
  name: 'site-name',
  transformIndexHtml: (html, ctx) => {
    html = html.replaceAll('%SITE_NAME%', SITE.name);
    if (!SITE.url) return html;
    // Cloudflare Pages liefert Seiten ohne .html aus (/impressum.html → /impressum).
    const page = ctx.path.replace(/^\//, '').replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
    const href = `${SITE.url}/${page}`;
    return html.replace(
      '</head>',
      `<link rel="canonical" href="${href}" />\n<meta property="og:url" content="${href}" />\n</head>`,
    );
  },
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
