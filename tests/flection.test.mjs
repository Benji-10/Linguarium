import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchFormPrefix,
  indexByHead,
  inflectionMatch,
  conjugatedReading,
  surfaceReadingFromDict,
  adjustAnnotationReading,
} from '../src/shared/flection.mjs';

// ---- matchFormPrefix ----------------------------------------------------------

test('matchFormPrefix: te-form chains', () => {
  assert.equal(matchFormPrefix('る', 'っている猫'), 4); // って + いる, 猫 stops it
  assert.equal(matchFormPrefix('る', 'ていた'), 3);
  assert.equal(matchFormPrefix('る', 'て'), 1);
  assert.equal(matchFormPrefix('る', 'らない'), 3);
  assert.equal(matchFormPrefix('る', 'なかった'), 0); // godan negative is らない + かった, not なかった
});

test('matchFormPrefix: godan sound changes', () => {
  assert.equal(matchFormPrefix('く', 'いて'), 2); // 書いて
  assert.equal(matchFormPrefix('ぐ', 'いだ'), 2); // 泳いだ
  assert.equal(matchFormPrefix('す', 'して'), 2);
  assert.equal(matchFormPrefix('む', 'んで'), 2);
  assert.equal(matchFormPrefix('く', 'って'), 2); // 行って (irregular te-form)
});

test('matchFormPrefix: i-adjectives', () => {
  assert.equal(matchFormPrefix('い', 'くなかった'), 5); // く + なかった
  assert.equal(matchFormPrefix('い', 'くない'), 3);
  assert.equal(matchFormPrefix('い', 'かった'), 3);
});

test('matchFormPrefix: suru-verbs', () => {
  assert.equal(matchFormPrefix('する', 'している'), 4);
  assert.equal(matchFormPrefix('する', 'した'), 2);
  assert.equal(matchFormPrefix('する', 'しない'), 3);
});

test('matchFormPrefix: rejects particles and nouns', () => {
  assert.equal(matchFormPrefix('る', 'が'), 0);
  assert.equal(matchFormPrefix('る', 'を'), 0);
  assert.equal(matchFormPrefix('る', 'です'), 0);
  assert.equal(matchFormPrefix('ぬ', 'かした'), 0); // 抜（ぬ）かした must not match
});

// ---- indexByHead + inflectionMatch -------------------------------------------

const dict = indexByHead([
  ['眠る', 'ねむる'],
  ['食べる', 'たべる'],
  ['行く', 'いく'],
  ['高い', 'たかい'],
  ['勉強する', 'べんきょうする'],
  ['落ちる', 'おちる'],
  ['落ちる', 'おちる'], // duplicates are harmless
  ['澱粉', 'でんぷん'],
  ['いる', 'いる'],
  ['猫', 'ねこ'],
]);

test('inflectionMatch: godan progressive', () => {
  const m = inflectionMatch('眠っているが', dict);
  assert.ok(m);
  assert.equal(m.term, '眠る');
  assert.equal(m.value, 'ねむる');
  assert.equal(m.tail, 'っている'); // が is not part of the word
});

test('inflectionMatch: ichidan with okurigana', () => {
  const m = inflectionMatch('食べている', dict);
  assert.ok(m);
  assert.equal(m.term, '食べる');
  assert.equal(m.tail, 'べている');
});

test('inflectionMatch: i-adjective past negative', () => {
  const m = inflectionMatch('高くなかった', dict);
  assert.ok(m);
  assert.equal(m.term, '高い');
  assert.equal(m.tail, 'くなかった');
});

test('inflectionMatch: suru-verb', () => {
  const m = inflectionMatch('勉強している', dict);
  assert.ok(m);
  assert.equal(m.term, '勉強する');
  assert.equal(m.tail, 'している');
});

test('inflectionMatch: okurigana discriminates homographs', () => {
  const m = inflectionMatch('落ちない', dict);
  assert.ok(m);
  assert.equal(m.term, '落ちる');
  assert.equal(m.tail, 'ちない');
});

test('inflectionMatch: irregular 来 is refused', () => {
  assert.equal(inflectionMatch('来なかった', dict), null);
});

test('inflectionMatch: non-inflectable shapes pass through', () => {
  assert.equal(inflectionMatch('澱粉', dict), null); // pure Han, no kana tail
  assert.equal(inflectionMatch('いる', dict), null); // kana-only
  assert.equal(inflectionMatch('猫は', dict), null); // は is not a conjugation
});

// ---- conjugatedReading --------------------------------------------------------

const readings = new Map([
  ['眠る', 'ねむる'],
  ['食べる', 'たべる'],
  ['行く', 'いく'],
  ['高い', 'たかい'],
  ['勉強する', 'べんきょうする'],
]);
const get = (t) => readings.get(t) ?? null;

test('conjugatedReading: 眠っている -> ねむっている (the reported bug)', () => {
  assert.equal(conjugatedReading('眠っている', get), 'ねむっている');
});

test('conjugatedReading: ichidan okurigana handled', () => {
  assert.equal(conjugatedReading('食べている', get), 'たべている');
  assert.equal(conjugatedReading('食べた', get), 'たべた');
});

test('conjugatedReading: godan and adjectives', () => {
  assert.equal(conjugatedReading('行って', get), 'いって');
  assert.equal(conjugatedReading('高くなかった', get), 'たかくなかった');
});

test('conjugatedReading: suru-verbs', () => {
  assert.equal(conjugatedReading('勉強している', get), 'べんきょうしている');
});

test('conjugatedReading: refuses to guess', () => {
  assert.equal(conjugatedReading('来た', get), null); // irregular
  assert.equal(conjugatedReading('澱粉', get), null); // no kana tail
  assert.equal(conjugatedReading('知らない言葉', get), null); // unknown word
});

// ---- surfaceReadingFromDict (AI enrichment shape) ------------------------------

test('surfaceReadingFromDict: dictionary reading applied to inflected term', () => {
  assert.equal(surfaceReadingFromDict('眠っている', 'ねむる'), 'ねむっている');
  assert.equal(surfaceReadingFromDict('食べている', 'たべる'), 'たべている');
  assert.equal(surfaceReadingFromDict('高くなかった', 'たかい'), 'たかくなかった');
});

test('surfaceReadingFromDict: already-correct readings pass through as null', () => {
  assert.equal(surfaceReadingFromDict('眠っている', 'ねむっている'), null); // already the surface reading
  assert.equal(surfaceReadingFromDict('食べる', 'たべる'), null); // plain dictionary form
  assert.equal(surfaceReadingFromDict('ねむっている', 'ねむっている'), null); // not a Han token
});

// ---- adjustAnnotationReading (parenthetical readings) --------------------------

test('adjustAnnotationReading: dictionary-form annotation before okurigana', () => {
  assert.equal(adjustAnnotationReading('ねむる', 'っている'), 'ねむ');
  assert.equal(adjustAnnotationReading('ねむる', 'って'), 'ねむ');
  assert.equal(adjustAnnotationReading('たかい', 'かった'), 'たか');
  assert.equal(adjustAnnotationReading('べんきょうする', 'している'), 'べんきょう');
});

test('adjustAnnotationReading: stem-style annotations are left alone', () => {
  assert.equal(adjustAnnotationReading('ぬ', 'かした'), null); // 抜（ぬ）かした
  assert.equal(adjustAnnotationReading('むてっぽう', 'で'), null); // 無鉄砲（むてっぽう）で
  assert.equal(adjustAnnotationReading('りんご', 'が'), null); // 林檎（りんご）が
  assert.equal(adjustAnnotationReading('こし', 'を'), null); // 腰（こし）を
});

test('adjustAnnotationReading: irregular 来（くる） refused', () => {
  assert.equal(adjustAnnotationReading('くる', 'た'), null);
});
