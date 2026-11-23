/**
 * Phase 3 tests: contribution validation
 * (netlify/functions/lib/contribute-validate.mjs).
 *
 * The community pipeline's honest gate: every submission must carry a real
 * license, traceable provenance (an author or a source URL), and the
 * content shape the moderation step expects.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContribution, CONTRIBUTION_KINDS } from '../netlify/functions/lib/contribute-validate.mjs';

const BASE = { kind: 'text', language_code: 'eo', license: 'cc-by-sa-4.0', source_url: 'https://example.com/text' };

test('a complete text contribution validates', () => {
  const result = validateContribution({
    ...BASE,
    payload: {
      title: 'A nice short story',
      body: 'Once upon a time there was a small village by the sea.',
      author: 'A. Author',
      topic: 'story',
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'text');
  assert.equal(result.payload.title, 'A nice short story');
  assert.equal(result.payload.body.length > 0, true);
});

test('a missing license is rejected', () => {
  const { license, ...withoutLicense } = BASE;
  const result = validateContribution({
    ...withoutLicense,
    payload: { title: 'T', body: 'B'.repeat(10), author: 'A' },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /license is required/i.test(e)));
});

test('license "unspecified" is rejected with a clear error', () => {
  const result = validateContribution({
    ...BASE,
    license: 'unspecified',
    payload: { title: 'T', body: 'B'.repeat(10), author: 'A' },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /license/i.test(e)));
});

test('a text without author AND without source URL is rejected', () => {
  const result = validateContribution({
    ...BASE,
    source_url: null,
    payload: { title: 'T', body: 'B'.repeat(10) },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /author or a source/i.test(e)));
});

test('a text with only an author validates (provenance via author)', () => {
  const result = validateContribution({
    ...BASE,
    source_url: undefined,
    payload: { title: 'T', body: 'B'.repeat(10), author: 'Anonymous of Old' },
  });
  assert.equal(result.ok, true);
  assert.equal(result.source_url, null);
});

test('invalid kind / language / payload shapes are rejected', () => {
  assert.equal(validateContribution({ ...BASE, kind: 'meme', payload: { title: 'x', body: 'y'.repeat(5) } }).ok, false);
  assert.equal(validateContribution({ ...BASE, language_code: '' }).ok, false);
  assert.equal(validateContribution({ ...BASE, payload: 'just a string' }).ok, false);
  assert.deepEqual(CONTRIBUTION_KINDS, ['text', 'grammar', 'lexicon']);
});

test('oversized text bodies are rejected', () => {
  const result = validateContribution({
    ...BASE,
    payload: { title: 'T', body: 'x'.repeat(60000), author: 'A' },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /longer than/i.test(e)));
});

test('a grammar contribution needs name, explanation and examples', () => {
  const ok = validateContribution({
    ...BASE,
    kind: 'grammar',
    payload: {
      name: 'The -i participle',
      explanation: 'The present active participle ends in -i.',
      examples: [{ text: 'ĉevalo estanta', translation: 'an existing horse' }],
    },
  });
  assert.equal(ok.ok, true);

  const noExamples = validateContribution({
    ...BASE,
    kind: 'grammar',
    payload: { name: 'X', explanation: 'Y' },
  });
  assert.equal(noExamples.ok, false);
  assert.ok(noExamples.errors.some((e) => /examples/i.test(e)));
});

test('a lexicon contribution needs term and definition', () => {
  const ok = validateContribution({
    ...BASE,
    kind: 'lexicon',
    payload: { term: 'kovilo', definition: 'box', gloss_language: 'eo' },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.term, 'kovilo');

  const missing = validateContribution({ ...BASE, kind: 'lexicon', payload: { term: 'kovilo' } });
  assert.equal(missing.ok, false);
});

test('source_url must be http(s)', () => {
  const result = validateContribution({
    ...BASE,
    source_url: 'ftp://nope',
    payload: { title: 'T', body: 'B'.repeat(10) },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /source_url/i.test(e)));
});
