/**
 * Difficulty estimation tests: bands reflect the reader's own knowledge
 * state; breakdown is transparent; provenance is 'automated'.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreText, bandMatchesMode } from '../src/shared/difficulty.mjs';
import { tokenize } from '../src/shared/tokenizer.mjs';

const EN = { charLevel: false, caseFold: true, innerApostrophe: true, innerHyphen: true };

function text(nUnique) {
  // Letter-only words (digits are not word characters for the tokenizer),
  // arranged in short natural sentences so syntax load stays normal.
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const words = [];
  for (let i = 0; i < nUnique; i++) {
    words.push(letters[Math.floor(i / 8) % 26] + letters[i % 26]);
  }
  const sentences = [];
  for (let i = 0; i < words.length; i += 7) {
    sentences.push(words.slice(i, i + 7).join(' ') + '.');
  }
  return sentences.join(' ');
}

test('all words known: comfortable band', () => {
  const t = text(40);
  const known = new Set(tokenize(t, EN).map((x) => x.text.toLowerCase()));
  const d = scoreText({ text: t, tokenizer: EN, knownSet: known });
  assert.equal(d.band, 'comfortable');
  assert.equal(d.familiarity, 1);
  assert.equal(d.provenance, 'automated');
});

test('many unknown words: challenge band', () => {
  const t = text(40);
  const known = new Set(['w0', 'w1']);
  const d = scoreText({ text: t, tokenizer: EN, knownSet: known });
  assert.equal(d.band, 'challenge');
  assert.ok(d.familiarity < 0.9);
  assert.ok(d.topUnknown.length <= 12);
});

test('mixed knowledge: stretch band', () => {
  const t = text(40);
  const all = tokenize(t, EN).map((x) => x.text.toLowerCase());
  const known = new Set(all.slice(0, 38)); // 95% familiar
  const d = scoreText({ text: t, tokenizer: EN, knownSet: known });
  assert.equal(d.band, 'stretch');
});

test('very long sentences raise the syntax score even when words are known', () => {
  const long = Array(60).fill('word').join(' ') + '.';
  const t = `${long} ${long} ${long}`;
  const known = new Set(['word']);
  const d = scoreText({ text: t, tokenizer: EN, knownSet: known });
  assert.ok(d.syntax > 0.5);
  assert.equal(d.band, 'challenge');
});

test('breakdown always covers the documented factors', () => {
  const d = scoreText({ text: 'hello world', tokenizer: EN, knownSet: new Set(['hello']) });
  const labels = d.breakdown.map((b) => b.label);
  assert.ok(labels.includes('Word familiarity'));
  assert.ok(labels.includes('Sentence length'));
  assert.ok(labels.includes('Text length'));
  assert.ok(labels.includes('Subject familiarity'));
});

test('bandMatchesMode helper', () => {
  assert.equal(bandMatchesMode('stretch', 'stretch'), true);
  assert.equal(bandMatchesMode('stretch', 'comfortable'), false);
});
