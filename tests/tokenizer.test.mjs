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

// ---------------------------------------------------------------
// Dictionary segmentation (Japanese / Chinese / other no-space scripts):
// a term dictionary (learner vocabulary + shared lexicon + ruby bases)
// turns per-character tokens into greedy longest-match words.
// ---------------------------------------------------------------

const JA_DICT = new Set([
  '私', 'は', '猫', 'いる', 'ます', 'の', 'に', '名前', 'まだ', '無い',
  '食べる', 'を', '人間', '見る', 'これ', 'それ', '何', 'と', 'も',
]);

test('dictionary segmentation groups Japanese into words, not characters', () => {
  const toks = tokenize('私は猫です。名前はまだ無い。', JA, JA_DICT);
  // です is not in the dictionary: the kana stretch groups into one token.
  assert.deepEqual(
    toks.map((t) => t.text),
    ['私', 'は', '猫', 'です', '名前', 'は', 'まだ', '無い'],
  );
});

test('dictionary segmentation offsets stay contiguous and correct', () => {
  const text = '名前はまだ無い。';
  const toks = tokenize(text, JA, JA_DICT).filter((t) => t.text !== '。');
  let covered = '';
  for (const t of toks) {
    assert.equal(text.slice(t.start, t.end), t.text);
    covered += t.text;
  }
  assert.equal(covered, '名前はまだ無い');
});

test('unknown kanji stay single tokens; kana stretches group calmly', () => {
  // 獰悪 are unknown kanji (single tokens each). In あれは何ですか the stretch
  // あれ ends at the dictionary word は, 何 is a dictionary word, and ですか
  // (no dictionary term inside it) groups into one calm token.
  const dict = new Set(['は', '何']);
  const toks = tokenize('獰悪あれは何ですか。', JA, dict);
  assert.deepEqual(
    toks.map((t) => t.text),
    ['獰', '悪', 'あれ', 'は', '何', 'ですか'],
  );
});

test('empty dictionary falls back to per-character tokenization', () => {
  const toks = tokenize('私はここにいます。', JA, new Set());
  assert.deepEqual(toks.map((t) => t.text), ['私', 'は', 'こ', 'こ', 'に', 'い', 'ま', 'す']);
});

test('chinese segmentation with pinyin vocabulary works the same way', () => {
  const ZH = { charLevel: true, caseFold: false };
  const dict = new Set(['我', '学', '学习', '汉字', '了', '很多']);
  const toks = tokenize('我学习汉字了。', ZH, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.deepEqual(
    toks.map((t) => t.text),
    ['我', '学习', '汉字', '了'],
  );
});

test('longest match wins over shorter prefixes', () => {
  const dict = new Set(['食', '食べる']);
  const toks = tokenize('食べる', JA, dict);
  assert.deepEqual(toks.map((t) => t.text), ['食べる']);
});

test('word-level tokenization ignores a dictionary argument', () => {
  const toks = tokenize('The cat', EN, new Set(['The', 'cat']));
  assert.deepEqual(toks.map((t) => t.text), ['The', 'cat']);
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
