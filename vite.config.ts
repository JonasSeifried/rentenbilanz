import { defineConfig, loadEnv, type Plugin } from 'vite';
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

// Anschrift und Telefon für Impressum und Datenschutz stehen nicht im Repository, sondern in
// Umgebungsvariablen: lokal in .env.local (siehe .env.example), auf Cloudflare Pages unter
// Settings → Environment variables. Ohne Anschrift bricht der Build ab, damit kein leeres Impressum online geht.
// Ohne IMPRESSUM_TELEFON entfällt die Telefonzeile.
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const legalInfo = (env: Record<string, string>, build: boolean): Plugin => {
  const missing = ['IMPRESSUM_STRASSE', 'IMPRESSUM_ORT'].filter(k => !env[k]?.trim());
  if (build && missing.length)
    throw new Error(`Fehlende Umgebungsvariablen für das Impressum: ${missing.join(', ')} (siehe .env.example)`);
  const value = (k: string) => escapeHtml(env[k]?.trim() || `[${k} fehlt]`);
  const tel = env.IMPRESSUM_TELEFON?.trim();
  return {
    name: 'legal-info',
    transformIndexHtml: html =>
      html
        .replaceAll('%IMPRESSUM_STRASSE%', value('IMPRESSUM_STRASSE'))
        .replaceAll('%IMPRESSUM_ORT%', value('IMPRESSUM_ORT'))
        .replace(/<br \/>Telefon: %IMPRESSUM_TELEFON%/, tel ? `<br />Telefon: ${escapeHtml(tel)}` : ''),
  };
};

// base: './' → alle Pfade relativ, die Seite läuft auch in einem Unterordner (z. B. /rechner/).
export default defineConfig(({ command, mode }) => ({
  base: './',
  plugins: [svelte(), siteName(), legalInfo(loadEnv(mode, process.cwd(), 'IMPRESSUM_'), command === 'build')],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: { input: { main: 'index.html', impressum: 'impressum.html', datenschutz: 'datenschutz.html' } },
  },
}));
