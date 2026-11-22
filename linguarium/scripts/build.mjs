/**
 * Build script.
 *
 * Bundles the SPA (src/main.mjs + imported CSS + npm dependencies such as
 * @netlify/identity) into dist/, copies static assets, and stamps the
 * service worker with a content hash so each deploy triggers the cache
 * update flow.
 *
 * Run via `npm run build` (also the Netlify build command).
 */

import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (rel) => `${root}/${rel}`;

async function main() {
  await mkdir(p('dist/icons'), { recursive: true });

  await build({
    entryPoints: [p('src/main.mjs')],
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    outbase: root,
    outdir: p('dist'),
    entryNames: 'app',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: '[name]',
    minify: true,
    sourcemap: false,
    logLevel: 'info',
  });

  // Static assets
  const files = [
    ['index.html', 'index.html'],
    ['manifest.webmanifest', 'manifest.webmanifest'],
    ['icons/icon.svg', 'icons/icon.svg'],
    ['icons/icon-192.png', 'icons/icon-192.png'],
    ['icons/icon-512.png', 'icons/icon-512.png'],
    ['icons/icon-512-maskable.png', 'icons/icon-512-maskable.png'],
  ];
  for (const [src, dest] of files) {
    await cp(p(src), p(`dist/${dest}`));
  }

  // Service worker with a build stamp: any byte change triggers the update.
  const swSource = await readFile(p('sw.js'), 'utf8');
  const hash = createHash('sha256').update(swSource + Date.now()).digest('hex').slice(0, 16);
  const stamped = swSource.replace('// build-stamp: placeholder', `// build-stamp: ${hash}`);
  await writeFile(p('dist/sw.js'), stamped);

  console.log(`[build] dist ready (stamp ${hash})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
