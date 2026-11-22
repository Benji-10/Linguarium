/**
 * Parser tests: format sniffing, CSV (quoted, headers, delimiter sniffing),
 * JSON (arrays and {name, items}), plain text separators, and above all the
 * unparsed-retention rule: nothing that fails to parse is discarded.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffFormat, parseCsv, parseJson, parseTxt, parseImport, toCsv } from '../src/shared/parsers.mjs';

test('format sniffing', () => {
  assert.equal(sniffFormat('[{"term":"a"}]'), 'json');
  assert.equal(sniffFormat('{"name":"x","items":[]}'), 'json');
  assert.equal(sniffFormat('term,definition\na,b'), 'csv');
  assert.equal(sniffFormat('word - definition'), 'txt');
});

test('csv with header and quoted fields', () => {
  const result = parseCsv('term,definition,reading\nmaison,"house, home",/mɛzɔ/\nchien,dog,');
  assert.equal(result.unparsedCount, 0);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].term, 'maison');
  assert.equal(result.items[0].definition, 'house, home');
  assert.equal(result.items[0].extra.reading, '/mɛzɔ/');
  assert.equal(result.items[1].definition, 'dog');
});

test('csv with alternative headers and semicolon delimiter', () => {
  const result = parseCsv('word;meaning\nHund;dog\nKatze;cat');
  assert.equal(result.items[0].term, 'Hund');
  assert.equal(result.items[0].definition, 'dog');
});

test('csv without header: first column is the term', () => {
  const result = parseCsv('maison,house\nchien,dog');
  assert.equal(result.items[0].term, 'maison');
  assert.equal(result.items[0].definition, 'house');
});

test('csv rows without a term are retained unparsed, not dropped', () => {
  const result = parseCsv('term,definition\n,orphan definition\nmaison,house');
  assert.equal(result.items.length, 2);
  assert.equal(result.unparsedCount, 1);
  assert.equal(result.items[0].parsed, false);
  assert.ok(result.items[0].raw.includes('orphan'));
  assert.equal(result.items[1].parsed, true);
});

test('json array of objects', () => {
  const result = parseJson('[{"term":"toki","definition":"speech"},{"term":"pona"}]');
  assert.equal(result.unparsedCount, 0);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1].definition, null);
});

test('json collection export shape', () => {
  const result = parseJson('{"name":"core","items":[{"term":"mi","definition":"I"}]}');
  assert.equal(result.collectionName, 'core');
  assert.equal(result.items[0].term, 'mi');
});

test('invalid json is retained as one unparsed item', () => {
  const result = parseJson('{broken');
  assert.equal(result.unparsedCount, 1);
  assert.equal(result.items[0].parsed, false);
});

test('json objects missing a term are retained unparsed', () => {
  const result = parseJson('[{"definition":"no term here"}]');
  assert.equal(result.unparsedCount, 1);
});

test('plain text with separators', () => {
  const result = parseTxt('Hund - dog\nKatze: cat\nmaison — house\nplainword');
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].term, 'Hund');
  assert.equal(result.items[0].definition, 'dog');
  assert.equal(result.items[1].definition, 'cat');
  assert.equal(result.items[2].definition, 'house');
  assert.equal(result.items[3].definition, null);
});

test('plain text strips numbering and bullets', () => {
  const result = parseTxt('1. Hund - dog\n- Katze: cat\n3) maison = house');
  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].term, 'Hund');
  assert.equal(result.items[1].term, 'Katze');
  assert.equal(result.items[2].definition, 'house');
});

test('empty lines are skipped', () => {
  const result = parseTxt('Hund - dog\n\n\nKatze - cat\n');
  assert.equal(result.items.length, 2);
});

test('parseImport auto-detects and respects explicit format', () => {
  const csv = parseImport('a,b\nc,d\n');
  assert.equal(csv.format, 'csv');
  const json = parseImport('[{"term":"a"}]');
  assert.equal(json.format, 'json');
  const forced = parseImport('term,definition\na,b', 'txt');
  assert.equal(forced.format, 'txt');
});

test('csv export roundtrip', () => {
  const items = [
    { term: 'maison', definition: 'house, home', extra: { reading: '/mɛzɔ/' } },
    { term: 'chien', definition: 'dog', extra: {} },
  ];
  const csv = toCsv(items);
  const back = parseCsv(csv);
  assert.equal(back.items.length, 2);
  assert.equal(back.items[0].term, 'maison');
  assert.equal(back.items[0].definition, 'house, home');
  assert.equal(back.items[0].extra.reading, '/mɛzɔ/');
});
