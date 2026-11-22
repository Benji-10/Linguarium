/**
 * Tests for the shared SQL splitter (netlify/functions/lib/sqlsplit.mjs):
 * dollar-quoted bodies, single-quote escapes, comments, statement boundaries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSql } from '../netlify/functions/lib/sqlsplit.mjs';

test('splits plain statements', () => {
  const out = splitSql('CREATE TABLE a (id int);\nCREATE TABLE b (id int);\n');
  assert.equal(out.length, 2);
  assert.match(out[0], /^CREATE TABLE a/);
  assert.match(out[1], /^CREATE TABLE b/);
});

test('keeps semicolons inside dollar-quoted bodies, including newline-following ones', () => {
  const sql = `INSERT INTO t (body) VALUES\n$$line one;\nline two; and more$$\n;\nSELECT 1;`;
  const out = splitSql(sql);
  assert.equal(out.length, 2);
  assert.match(out[0], /^INSERT INTO t/);
  assert.ok(out[0].includes('line one;'));
  assert.ok(out[0].includes('line two; and more'));
  assert.equal(out[1], 'SELECT 1');
});

test('keeps doubled single quotes as literal quotes inside quoted strings', () => {
  const sql = `INSERT INTO t (name) VALUES ('Alice''s Adventures') ;\nSELECT 2;`;
  const out = splitSql(sql);
  assert.equal(out.length, 2);
  assert.ok(out[0].includes("'Alice''s Adventures'"));
});

test('strips line and block comments, keeps statements', () => {
  const sql = `-- a header comment\nCREATE TABLE a (id int);\n/* block\n   comment */ CREATE TABLE b (id int);`;
  const out = splitSql(sql);
  assert.equal(out.length, 2);
  assert.equal(out[0], 'CREATE TABLE a (id int)');
  assert.equal(out[1], 'CREATE TABLE b (id int)');
});

test('does not treat double hyphen inside a word as a comment', () => {
  const out = splitSql("INSERT INTO t (v) VALUES ('foo--bar');");
  assert.equal(out.length, 1);
  assert.ok(out[0].includes("'foo--bar'"));
});

test('handles apostrophes inside dollar quotes without ending them', () => {
  const sql = "INSERT INTO t (b) VALUES\n$$l'été est beau$$\n;\nSELECT 3;";
  const out = splitSql(sql);
  assert.equal(out.length, 2);
  assert.ok(out[0].includes("l'été est beau"));
});

test('unclosed dollar quote runs to end of input without crashing', () => {
  const out = splitSql('INSERT INTO t (b) VALUES\n$$oops');
  assert.equal(out.length, 1);
});
