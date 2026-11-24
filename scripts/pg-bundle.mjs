/**
 * Generate netlify/functions/lib/gutenberg-shelves.mjs from the official
 * Project Gutenberg catalogue CSV (pg_catalog.csv, downloaded from the
 * pglaf.org mirror - gutenberg.org 503-refuses datacenter IPs).
 *
 * Why a bundle at all: Gutendex (the third-party JSON API the browse used
 * to depend on) now 403-refuses / times out for datacenter traffic, which
 * showed up as "page 2 always times out" and imports landing as
 * "Gutenberg book 78105, Unknown author". Browsing from a bundled snapshot
 * of the official catalogue is instant, needs no upstream, and gives every
 * card its title/author/subject-blurb. The snapshot is refreshed by
 * re-running this script (each deploy ships the committed copy).
 *
 * Included: every non-English book the catalogue has, plus the first
 * 20,000 English books (Text# ascending = the 1971-2006 upload era, the
 * classic-literature canon). English beyond that and brand-new uploads
 * stay reachable through live search when Gutendex happens to answer.
 *
 * Usage:  node scripts/pg-bundle.mjs /path/to/pg_catalog.csv
 * Output: netlify/functions/lib/gutenberg-shelves.mjs        (data)
 *         netlify/functions/lib/gutenberg-languages.mjs      (tiny list)
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'netlify', 'functions', 'lib', 'gutenberg-shelves.mjs');
const LANG_OUT = join(HERE, '..', 'netlify', 'functions', 'lib', 'gutenberg-languages.mjs');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('usage: node scripts/pg-bundle.mjs pg_catalog.csv');
  process.exit(1);
}

const ENGLISH_CAP = 20000;

/** App language code normalisation (PG 'no' = Norwegian bokmål = app 'nb'). */
function langCode(raw) {
  const code = String(raw ?? '').split(';')[0].trim().toLowerCase();
  return code === 'no' ? 'nb' : code;
}

/** "Tolstoy, Leo, graf, 1828-1910" -> "Tolstoy, Leo, graf" (dates stripped,
 *  trailing roles/titles kept - they disambiguate). Cap at 60 chars. */
function cleanAuthor(authorsField) {
  const first = String(authorsField ?? '').split(';')[0].trim();
  if (!first || first === 'Unknown') return '';
  let a = first.replace(/,?\s*(?:b\.\s*)?\d{4}\s*-\s*\d{0,4}\s*$/, '').trim();
  a = a.replace(/,?\s*(?:b\.\s*)?\d{4}\s*$/, '').trim(); // birth-year only
  if (/^anonymous$/i.test(a)) return '';
  return a.replace(/\s+/g, ' ').slice(0, 60);
}

/** Subject / bookshelf -> one-line blurb, the catalogue's own metadata.
 *  "United States -- History -- Revolution, 1775-1783 -- Sources" etc. are
 *  LCSH headings; the first few segments carry the topic. Nothing invented. */
function blurbFrom(subjectsField, bookshelvesField) {
  const seen = new Set();
  const tags = [];
  const push = (raw) => {
    const t = String(raw ?? '')
      .replace(/\s*--\s*/g, ' - ')
      .replace(/["\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.;]$/, '');
    const key = t.toLowerCase();
    if (t && t.length <= 42 && !seen.has(key)) {
      seen.add(key);
      tags.push(t);
    }
  };
  for (const shelf of String(bookshelvesField ?? '').split(';')) {
    push(shelf.trim());
  }
  for (const subject of String(subjectsField ?? '').split(';')) {
    if (tags.length >= 3) break;
    // LCSH headings chain with " -- "; the first heading is the topic.
    push(subject.split('--')[0]);
  }
  return tags.slice(0, 3).join(' · ');
}

function cleanTitle(t) {
  return String(t ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// ---------------------------------------------------------------- parse csv

function parseCsv(text) {
  // The PG catalog is plain RFC-4180-ish CSV: quoted fields, "" escapes,
  // commas inside quotes. Fields: Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.length === 9 && row[0] !== 'Text#') rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  return rows;
}

const csv = readFileSync(csvPath, 'utf8');
const rows = parseCsv(csv);
console.log(`parsed ${rows.length} catalogue rows`);

const byLang = new Map(); // lang -> [{ id, title, author, blurb }]
let enCount = 0;
let skipped = 0;
for (const [id, type, , title, language, authors, subjects, , bookshelves] of rows) {
  if (type !== 'Text' || !/^\d+$/.test(id)) {
    skipped += 1;
    continue;
  }
  const lang = langCode(language);
  if (!lang || !/^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(lang)) {
    skipped += 1;
    continue;
  }
  const t = cleanTitle(title);
  if (!t) {
    skipped += 1;
    continue;
  }
  if (lang === 'en') {
    enCount += 1;
    if (enCount > ENGLISH_CAP) continue; // oldest 20k English books only
  }
  const entry = `${id}\t${t}\t${cleanAuthor(authors)}\t${blurbFrom(subjects, bookshelves)}`;
  if (!byLang.has(lang)) byLang.set(lang, []);
  byLang.get(lang).push(entry);
}

// Sort every shelf by book id ascending (stable, deterministic).
for (const list of byLang.values()) {
  list.sort((a, b) => Number(a.split('\t')[0]) - Number(b.split('\t')[0]));
}

// The languages the app offers Gutenberg for: every shelf with at least
// MIN_SHELF books (a one-book shelf reads as a broken tab).
const MIN_SHELF = 3;
const langs = [...byLang.entries()]
  .filter(([, list]) => list.length >= MIN_SHELF)
  .map(([lang]) => lang)
  .sort();

let total = 0;
for (const lang of langs) total += byLang.get(lang).length;
console.log(`languages: ${langs.join(', ')}`);
console.log(`shelves: ${langs.map((l) => `${l}:${byLang.get(l).length}`).join(' ')}`);
console.log(`total books bundled: ${total}, skipped rows: ${skipped}`);

// ---------------------------------------------------------------- emit module

/** Escape one packed entry for embedding in a '...' JS string literal.
 *  MUST run per-entry, BEFORE the join - escaping after the join doubles the
 *  join markers themselves and glues 200 books into one row (the bug this
 *  rewrite fixes). The join separator is a "\n" ESCAPE in the emitted
 *  literal, which becomes a real newline when the module is parsed. */
const escapeEntry = (e) => e.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const lines = [];
lines.push('/**');
lines.push(' * Project Gutenberg shelves - a committed snapshot of the official');
lines.push(' * pg_catalog.csv (see scripts/pg-bundle.mjs), so browsing and import');
lines.push(' * metadata NEVER depend on the flaky third-party Gutendex API');
lines.push(' * (403s / times out for datacenter traffic - probed 2026-11).');
lines.push(' *');
lines.push(' * Format: one packed section per language, each line');
lines.push(' *   id\\ttitle\\tauthor\\tblurb');
lines.push(' * The blurb is the catalogue\'s own bookshelves/subjects (LCSH topics) -');
lines.push(' * Project Gutenberg carries no prose descriptions, and nothing here');
lines.push(' * is invented.');
lines.push(' *');
lines.push(' * GENERATED FILE - do not edit by hand. Refresh with:');
lines.push(' *   node scripts/pg-bundle.mjs pg_catalog.csv');
lines.push(' */');
lines.push('');
lines.push('export const GUTENBERG_SHELF_LANGUAGES = [');
for (const lang of langs) lines.push(`  '${lang}',`);
lines.push('];');
lines.push('');
lines.push('const SHELVES = {');
for (const lang of langs) {
  lines.push(`  ${lang}: [`);
  const list = byLang.get(lang);
  for (let i = 0; i < list.length; i += 200) {
    lines.push(`    '${list.slice(i, i + 200).map(escapeEntry).join('\\n')}',`);
  }
  lines.push('  ].join("\\n"),');
}
lines.push('};');
lines.push('');
lines.push('const PARSED = new Map(); // lang -> [{ id, title, author, blurb }]');
lines.push('');
lines.push('export function gutenbergShelf(lang) {');
lines.push('  if (!PARSED.has(lang)) {');
lines.push('    const packed = SHELVES[lang] ?? "";');
lines.push('    PARSED.set(');
lines.push('      lang,');
lines.push('      packed');
lines.push('        .split("\\n")');
lines.push('        .filter(Boolean)');
lines.push('        .map((line) => {');
lines.push('          const tab1 = line.indexOf("\\t");');
lines.push('          const tab2 = line.indexOf("\\t", tab1 + 1);');
lines.push('          const tab3 = line.indexOf("\\t", tab2 + 1);');
lines.push('          return {');
lines.push('            id: line.slice(0, tab1),');
lines.push('            title: line.slice(tab1 + 1, tab2),');
lines.push('            author: line.slice(tab2 + 1, tab3),');
lines.push('            blurb: line.slice(tab3 + 1),');
lines.push('          };');
lines.push('        }),');
lines.push('    );');
lines.push('  }');
lines.push('  return PARSED.get(lang);');
lines.push('}');
lines.push('');
lines.push('const BY_ID = new Map(); // id -> row (all shelves, built on first use)');
lines.push('');
lines.push('export function gutenbergBook(id) {');
lines.push('  if (BY_ID.size === 0) {');
lines.push('    for (const lang of GUTENBERG_SHELF_LANGUAGES) {');
lines.push('      for (const row of gutenbergShelf(lang)) BY_ID.set(row.id, { ...row, language: lang });');
lines.push('    }');
lines.push('  }');
lines.push('  return BY_ID.get(String(id)) ?? null;');
lines.push('}');
lines.push('');

writeFileSync(OUT, lines.join('\n'), 'utf8');
const size = (statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`wrote ${OUT} (${size} MB)`);

// ---------------------------------------------------------------- tiny language list

// A separate ~1KB module with just the shelf languages (+ book counts), so
// sources.mjs can gate the provider without importing the multi-MB data
// module (lookup.mjs and other hot functions import sources.mjs and must
// not carry the shelves with them).
const langLines = [];
langLines.push('/**');
langLines.push(' * Gutenberg shelf languages + book counts.');
langLines.push(' *');
langLines.push(' * GENERATED FILE - do not edit by hand. Refresh with:');
langLines.push(' *   node scripts/pg-bundle.mjs pg_catalog.csv');
langLines.push(' * (kept separate from the data module so the hot functions that import');
langLines.push(' * sources.mjs do not bundle the multi-MB shelves)');
langLines.push(' */');
langLines.push('');
langLines.push('export const GUTENBERG_SHELF_LANGUAGES = [');
for (const lang of langs) langLines.push(`  '${lang}', // ${byLang.get(lang).length} books`);
langLines.push('];');
langLines.push('');
langLines.push('export const GUTENBERG_SHELF_COUNTS = {');
for (const lang of langs) langLines.push(`  ${lang}: ${byLang.get(lang).length},`);
langLines.push('};');
langLines.push('');
writeFileSync(LANG_OUT, langLines.join('\n'), 'utf8');
console.log(`wrote ${LANG_OUT} (${langs.length} languages)`);
