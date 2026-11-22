/**
 * Syntax check: runs `node --check` over every source file (frontend and
 * functions) to catch broken syntax without a browser. Run: `npm run check`.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.netlify'].includes(entry.name)) continue;
      yield* walk(full);
    } else if (/\.(mjs|js)$/.test(entry.name)) {
      yield full;
    }
  }
}

const root = new URL('..', import.meta.url).pathname;
const targets = [join(root, 'src'), join(root, 'netlify', 'functions'), join(root, 'scripts')];
let failed = 0;
let count = 0;

for (const dir of targets) {
  for await (const file of walk(dir)) {
    count += 1;
    try {
      await run(process.execPath, ['--check', file]);
    } catch (err) {
      failed += 1;
      console.error(`\nSYNTAX ERROR in ${file}:`);
      console.error(err.stderr ?? err.message);
    }
  }
}

console.log(`\nChecked ${count} files, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
