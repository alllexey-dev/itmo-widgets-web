import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';

import { AppTheme } from '../shared/AppTheme';
import { pages, type PublicPage } from './pages';

/**
 * Second half of `npm run build`: renders every public page into its built HTML document.
 * A page that does not hydrate loses its module script and preloads and stays HTML and CSS.
 */
interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
}

const dist = resolve(process.cwd(), 'dist');
const manifestDir = resolve(dist, '.vite');
const manifest = JSON.parse(readFileSync(resolve(manifestDir, 'manifest.json'), 'utf8')) as Record<
  string,
  ManifestChunk
>;

/** Stylesheets of a page module and everything it imports statically. */
function stylesOf(source: string, seen = new Set<string>()): string[] {
  if (seen.has(source)) return [];
  seen.add(source);
  const chunk = manifest[source];
  if (!chunk) throw new Error(`No manifest entry for ${source}`);
  return [...(chunk.imports ?? []).flatMap((name) => stylesOf(name, seen)), ...(chunk.css ?? [])];
}

const MARKER = '<!--page-->';
const MODULE_SCRIPT = /\s*<script type="module"[^>]*><\/script>/g;
const MODULE_PRELOAD = /\s*<link rel="modulepreload"[^>]*>/g;

async function prerender(page: PublicPage): Promise<void> {
  const path = resolve(dist, page.file);
  let html = readFileSync(path, 'utf8');
  if (!html.includes(MARKER)) throw new Error(`${page.file} has no ${MARKER} marker`);

  const { default: Page } = await page.load();
  const tree = (
    <AppTheme>
      <Page />
    </AppTheme>
  );
  const markup = page.hydrate ? renderToString(tree) : renderToStaticMarkup(tree);
  const links = [...new Set(stylesOf(page.source))]
    .filter((file) => !html.includes(file))
    .map((file) => `    <link rel="stylesheet" href="/${file}" />\n`)
    .join('');

  html = html
    .replace('data-page=', 'data-prerendered data-page=')
    .replace(MARKER, markup)
    .replace('  </head>', `${links}  </head>`);
  if (!page.hydrate) html = html.replace(MODULE_SCRIPT, '').replace(MODULE_PRELOAD, '');
  writeFileSync(path, html);
  console.log(`prerendered ${page.file}${page.hydrate ? ' (hydrates)' : ''}`);
}

for (const page of Object.values(pages)) await prerender(page);
// The manifest is a build input, not something to serve.
rmSync(manifestDir, { recursive: true });
