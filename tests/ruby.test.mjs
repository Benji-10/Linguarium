/**
 * Ruby annotation tests: inline parenthetical furigana / pinyin are parsed
 * out into structured marks with correct offsets into the cleaned text.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRuby, hasRuby, readingMapFor } from '../src/shared/ruby.mjs';

test('japanese furigana annotations (full-width parens) are parsed out', () => {
  const { clean, marks } = parseRuby('吾輩（わがはい）は猫である。名前はまだ無い。');
  assert.equal(clean, '吾輩は猫である。名前はまだ無い。');
  assert.equal(marks.length, 1);
  const m = marks[0];
  assert.equal(m.kind, 'furigana');
  assert.equal(m.base, '吾輩');
  assert.equal(m.reading, 'わがはい');
  assert.equal(m.baseStart, 0);
  assert.equal(m.baseEnd, 2);
  assert.equal(clean.slice(m.baseStart, m.baseEnd), '吾輩');
});

test('multiple furigana marks keep offsets into the cleaned text', () => {
  const { clean, marks } = parseRuby('どこで生れたかとんと見当（けんとう）がつかぬ。人間中で一番獰悪（どうあく）な種族であった。');
  assert.equal(clean, 'どこで生れたかとんと見当がつかぬ。人間中で一番獰悪な種族であった。');
  assert.equal(marks.length, 2);
  assert.equal(marks[0].base, '見当');
  assert.equal(marks[0].reading, 'けんとう');
  assert.equal(clean.slice(marks[0].baseStart, marks[0].baseEnd), '見当');
  assert.equal(marks[1].base, '獰悪');
  assert.equal(clean.slice(marks[1].baseStart, marks[1].baseEnd), '獰悪');
});

test('half-width parens work the same as full-width', () => {
  const { clean, marks } = parseRuby('漢字(かんじ)を学ぶ。');
  assert.equal(clean, '漢字を学ぶ。');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].reading, 'かんじ');
});

test('per-character ruby annotations are supported', () => {
  const { clean, marks } = parseRuby('漢(かん)字(じ)');
  assert.equal(clean, '漢字');
  assert.deepEqual(
    marks.map((m) => [m.base, m.reading]),
    [
      ['漢', 'かん'],
      ['字', 'じ'],
    ],
  );
});

test('katakana readings are accepted', () => {
  const { marks } = parseRuby('猫(ネコ)が鳴いた。');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].kind, 'furigana');
});

test('chinese pinyin annotations (tone marks) are parsed', () => {
  const { clean, marks } = parseRuby('我学习汉字(hànzì)。');
  assert.equal(clean, '我学习汉字。');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].kind, 'pinyin');
  assert.equal(marks[0].reading, 'hànzì');
});

test('plain pinyin without tone marks is accepted when syllable-shaped', () => {
  const { marks } = parseRuby('你好(ni hao)。');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].kind, 'pinyin');
});

test('english glosses in parens are NOT treated as ruby', () => {
  const { clean, marks } = parseRuby('China (China) is big. 汉字 (Chinese characters) are hard.');
  assert.equal(marks.length, 0);
  assert.equal(clean, 'China (China) is big. 汉字 (Chinese characters) are hard.');
});

test('parenthetical kana with no preceding kanji stays untouched', () => {
  const { clean, marks } = parseRuby('早速（さっそく）ですが。');
  // 早速 is kanji -> this IS a reading
  assert.equal(marks.length, 1);
  const none = parseRuby('（たぶん）そうだろう。');
  assert.equal(none.marks.length, 0);
});

test('hasRuby is a cheap correct pre-check', () => {
  assert.equal(hasRuby('吾輩（わがはい）は猫である。'), true);
  assert.equal(hasRuby('ただの日本語の文です。'), false);
  assert.equal(hasRuby('汉字(hànzì)'), true);
  assert.equal(hasRuby('plain text'), false);
});

test('readingMapFor maps terms to readings with NFC keys', () => {
  const map = readingMapFor(
    [
      { term: '食べる', reading: 'たべる' },
      { term: '食べる', reading: 'IGNORED-SECOND' },
      { term: 'noReading' },
    ],
    { caseFold: false },
  );
  assert.equal(map.get('食べる'), 'たべる');
  assert.equal(map.size, 1);
});

// ---------------------------------------------------------------
// Dictionary-form annotations (2026-11 fix): a verb annotated with its
// dictionary-form reading before an inflected ending must be adjusted to
// the stem so the okurigana is not pronounced twice.
// ---------------------------------------------------------------

test('dictionary-form annotation is adjusted to the stem (the reported bug)', () => {
  // 眠（ねむる）っている must NOT render as ねむる + っている = "ねむるっている".
  const { clean, marks } = parseRuby('猫が眠（ねむる）っている。');
  assert.equal(clean, '猫が眠っている。');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].base, '眠');
  assert.equal(marks[0].reading, 'ねむ');
});

test('stem-style annotations pass through unchanged', () => {
  // 抜（ぬ）かした: the reading ぬ is already the stem - かした is not a
  // valid conjugation of a ぬ-ending verb, so nothing is stripped.
  const { marks } = parseRuby('腰を抜（ぬ）かした。');
  assert.equal(marks[0].reading, 'ぬ');
  // 名詞（めいし）が: が is a particle, not an inflection.
  const noun = parseRuby('名詞（めいし）が並ぶ。');
  assert.equal(noun.marks[0].reading, 'めいし');
});

test('adjective and suru-verb dictionary-form annotations adjust too', () => {
  const adj = parseRuby('暑（あつい）かった夏。');
  assert.equal(adj.marks[0].reading, 'あつ');
  const suru = parseRuby('勉強（べんきょうする）していた。');
  assert.equal(suru.marks[0].reading, 'べんきょう');
});

test('adjusted mark offsets still point at the base in the cleaned text', () => {
  const { clean, marks } = parseRuby('雨が降（ふ）っていた。');
  assert.equal(clean, '雨が降っていた。');
  assert.equal(clean.slice(marks[0].baseStart, marks[0].baseEnd), '降');
});
