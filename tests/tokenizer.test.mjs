/**
 * Tokenizer tests: word-level and character-level tokenization, normalization,
 * language-specific inner characters (apostrophes, hyphens), RTL is orthogonal.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, normalizeTerm, distinctTerms, splitSentences, buildWordRegex } from '../src/shared/tokenizer.mjs';

const EN = { charLevel: false, caseFold: true, innerApostrophe: true, innerHyphen: true };
const FR = { charLevel: false, caseFold: true, innerApostrophe: true, innerHyphen: false };
const TOK = { charLevel: false, caseFold: true, innerApostrophe: false, innerHyphen: false };
const JA = { charLevel: true, caseFold: false };

test('english word tokenization with punctuation', () => {
  const toks = tokenize('The North Wind and the Sun were disputing!', EN);
  assert.deepEqual(
    toks.map((t) => t.text),
    ['The', 'North', 'Wind', 'and', 'the', 'Sun', 'were', 'disputing'],
  );
});

test('inner apostrophes stay in words for languages that use them', () => {
  const toks = tokenize("l'hiver d'antan", FR);
  assert.deepEqual(
    toks.map((t) => t.text),
    ["l'hiver", "d'antan"],
  );
  // Without inner apostrophes the apostrophe splits the word
  const without = tokenize("l'hiver", { charLevel: false, caseFold: true, innerApostrophe: false, innerHyphen: false });
  assert.deepEqual(
    without.map((t) => t.text),
    ['l', 'hiver'],
  );
});

test('hyphens inside words are kept when configured', () => {
  const toks = tokenize('die E-Mail-Adresse', EN);
  assert.deepEqual(
    toks.map((t) => t.text),
    ['die', 'E-Mail-Adresse'],
  );
});

test('toki pona tokenizes as plain lowercase words', () => {
  const toks = tokenize('mi jan Kili. mi lon tomo pona.', TOK);
  assert.deepEqual(
    toks.map((t) => t.text),
    ['mi', 'jan', 'Kili', 'mi', 'lon', 'tomo', 'pona'],
  );
});

test('character-level tokenization for Japanese-like languages', () => {
  const toks = tokenize('私はここにいます。', JA);
  assert.deepEqual(
    toks.map((t) => t.text),
    ['私', 'は', 'こ', 'こ', 'に', 'い', 'ま', 'す'],
  );
});

test('normalization: NFC + case folding when configured', () => {
  assert.equal(normalizeTerm('Maison', EN), 'maison');
  assert.equal(normalizeTerm('  Maison ', EN), 'maison');
  assert.equal(normalizeTerm('TŌKYO', { charLevel: false, caseFold: false }), 'TŌKYO');
  assert.equal(normalizeTerm('cafe\u0301', EN), 'café'); // NFD -> NFC compose
});

test('distinct terms keep first-appearance order and normalize', () => {
  const d = distinctTerms('The cat and the Cat', EN);
  assert.deepEqual(
    d.map((x) => x.normalized),
    ['the', 'cat', 'and'],
  );
});

test('sentence splitting covers latin and cjk terminators', () => {
  const s = splitSentences('One. Two? Three! 四。五！');
  assert.equal(s.length, 5);
});

test('tokenizer is script-agnostic: arabic and devanagari letters work', () => {
  const generic = { charLevel: false, caseFold: false };
  const toks = tokenize('الكلب في البيت', generic);
  assert.equal(toks.length, 3);
  const hi = tokenize('मैं घर में हूँ', generic);
  assert.equal(hi.length, 4);
});

test('buildWordRegex returns null for character-level configs', () => {
  assert.equal(buildWordRegex({ charLevel: true }), null);
  assert.ok(buildWordRegex(EN) instanceof RegExp);
});
