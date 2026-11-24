/**
 * Tokenizer tests: word-level and character-level tokenization, normalization,
 * language-specific inner characters (apostrophes, hyphens), RTL is orthogonal.
 *
 * Char-level languages get three layers (see the module header): ICU word
 * units via Intl.Segmenter, greedy dictionary matching, and the Japanese
 * inflection merge. The no-ICU fallback path is tested by stubbing
 * Intl.Segmenter out.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, normalizeTerm, distinctTerms, splitSentences, buildWordRegex } from '../src/shared/tokenizer.mjs';

const EN = { charLevel: false, caseFold: true, innerApostrophe: true, innerHyphen: true };
const FR = { charLevel: false, caseFold: true, innerApostrophe: true, innerHyphen: false };
const TOK = { charLevel: false, caseFold: true, innerApostrophe: false, innerHyphen: false };
const JA = { charLevel: true, caseFold: false, code: 'ja' };
const HAS_ICU = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

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

test('character-level tokenization without a dictionary uses ICU word units', () => {
  const toks = tokenize('私はここにいます。', JA);
  if (HAS_ICU) {
    // ICU knows ここ and ます as words - no per-character cutting anymore.
    assert.deepEqual(
      toks.map((t) => t.text),
      ['私', 'は', 'ここ', 'に', 'い', 'ます'],
    );
  } else {
    assert.deepEqual(
      toks.map((t) => t.text),
      ['私', 'は', 'こ', 'こ', 'に', 'い', 'ま', 'す'],
    );
  }
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

test('unknown kanji stay clickable without a dictionary hit', () => {
  // 獰悪 has no dictionary entry: ICU still yields it as one word unit
  // (douaku - it is a real word), and the rest comes out as word units too
  // (あれ, は, 何, です, か). The no-ICU fallback keeps single characters.
  const dict = new Set(['は', '何']);
  const toks = tokenize('獰悪あれは何ですか。', JA, dict);
  assert.deepEqual(
    toks.map((t) => t.text),
    HAS_ICU ? ['獰悪', 'あれ', 'は', '何', 'です', 'か'] : ['獰', '悪', 'あれ', 'は', '何', 'ですか'],
  );
});

test('empty dictionary falls back to ICU word units (better than characters)', () => {
  const toks = tokenize('私はここにいます。', JA, new Set());
  if (HAS_ICU) {
    assert.deepEqual(toks.map((t) => t.text), ['私', 'は', 'ここ', 'に', 'い', 'ます']);
  } else {
    assert.deepEqual(toks.map((t) => t.text), ['私', 'は', 'こ', 'こ', 'に', 'い', 'ま', 'す']);
  }
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

// ---------------------------------------------------------------
// The reported reader bugs (2026-11 feedback round):
//   - 澱粉 split into per-character clicks (only single-char lookups)
//   - 眠っている split so furigana could not be conjugation-aware
// ---------------------------------------------------------------

test('dictionary-known words are whole units even when ICU would split them (澱粉)', () => {
  const dict = new Set(['澱粉', 'は', '白色']);
  const toks = tokenize('澱粉は白色である。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.deepEqual(toks.map((t) => t.text), ['澱粉', 'は', '白色', 'で', 'ある']);
});

test('ICU word units cover unknown multi-kanji words (one click, not per character)', () => {
  if (!HAS_ICU) return;
  const dict = new Set(['は']);
  const toks = tokenize('澱粉は米から作られる。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.ok(toks.some((t) => t.text === '澱粉'), `expected 澱粉 as one unit in ${JSON.stringify(toks.map((t) => t.text))}`);
});

test('inflected verbs become ONE clickable token (眠っている)', () => {
  const dict = new Set(['眠る', '間', 'に', '雨', 'が', '降る']);
  const toks = tokenize('眠っている間に雨が降った。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.deepEqual(
    toks.map((t) => t.text),
    ['眠っている', '間', 'に', '雨', 'が', '降った'],
  );
});

test('ichidan verbs with okurigana merge (食べている)', () => {
  const dict = new Set(['食べる', '猫', '魚', 'を']);
  const toks = tokenize('猫は魚を食べている。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.deepEqual(
    toks.map((t) => t.text),
    ['猫', 'は', '魚', 'を', '食べている'],
  );
});

test('i-adjectives merge their inflections (高くなかった)', () => {
  const dict = new Set(['高い']);
  const toks = tokenize('高くなかった。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.deepEqual(toks.map((t) => t.text), ['高くなかった']);
});

test('particles never merge into the word (猫は stays 猫 + は)', () => {
  const dict = new Set(['猫', 'は']);
  const toks = tokenize('猫は魚を食べる。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.deepEqual(
    toks.map((t) => t.text),
    ['猫', 'は', '魚', 'を', '食べる'],
  );
});

test('merge offsets stay exact for the renderer', () => {
  const text = '眠っている間に雨が降った。';
  const dict = new Set(['眠る', '間', 'に', '雨', 'が', '降る']);
  for (const t of tokenize(text, JA, dict)) {
    if (/\p{L}/u.test(t.text)) assert.equal(text.slice(t.start, t.end), t.text);
  }
});

test('merged tokens cover the text contiguously', () => {
  const text = '猫が眠っていた。';
  const dict = new Set(['眠る', '猫', 'が']);
  const toks = tokenize(text, JA, dict).filter((t) => /\p{L}/u.test(t.text));
  assert.equal(toks.map((t) => t.text).join(''), '猫が眠っていた');
});

test('the no-ICU fallback still merges inflections (kana-run path)', () => {
  const realSegmenter = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined; // old runtime simulation
    const dict = new Set(['眠る', '猫', 'が']);
    const toks = tokenize('猫が眠っている。', JA, dict).filter((t) => /\p{L}/u.test(t.text));
    assert.deepEqual(
      toks.map((t) => t.text),
      ['猫', 'が', '眠っている'],
    );
    // And the per-character behaviour survives for unknown stretches.
    const bare = tokenize('私はここにいます。', JA, new Set(['私', 'は', 'に']));
    assert.deepEqual(bare.map((t) => t.text), ['私', 'は', 'ここ', 'に', 'います']);
  } finally {
    Intl.Segmenter = realSegmenter;
  }
});
