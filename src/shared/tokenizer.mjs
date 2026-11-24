/**
 * Language-agnostic tokenizer.
 *
 * Languages are described by a small tokenizer configuration, so any
 * language - including constructed languages like Toki Pona or a user's
 * own custom language - works the same way. The configuration comes from
 * the knowledge.languages table (see sql/seed.sql); the store injects the
 * language code as `code` so char-level languages segment with the right
 * ICU dictionary:
 *
 *   {
 *     code:            'ja'   -> language code (Intl.Segmenter locale),
 *     charLevel:       true  -> no word spaces (Japanese, Chinese, Thai...),
 *     caseFold:        true  -> normalize terms to lower case,
 *     innerApostrophe: true  -> keep apostrophes inside words (l'hiver),
 *     innerHyphen:     true  -> keep hyphens inside words (meta-analysis)
 *   }
 *
 * For char-level languages, `tokenize` additionally accepts a SEGMENTATION
 * DICTIONARY (a Set of terms: the learner's own vocabulary, the shared
 * lexicon, ruby bases of this very text) and combines three layers:
 *
 *   1. the browser's own word segmenter (Intl.Segmenter, ICU dictionary)
 *      when available - real word units (澱粉) instead of single
 *      characters even for words the learner does not know yet;
 *   2. greedy longest-match against the dictionary - the learner's own
 *      words always win, so segmentation improves as they learn;
 *   3. Japanese inflection merging (shared/flection.mjs): a Kanji head
 *      plus its okurigana plus a conjugated ending become ONE clickable
 *      token (眠っている, 食べている, 高くなかった) whenever the dictionary
 *      confirms the base word.
 *
 * Environments without Intl.Segmenter fall back to the previous behaviour
 * (dictionary match, kana-run grouping, per-character unknowns) plus the
 * inflection merge. The honest label stays the same: this is dictionary
 * matching plus auditable grammar tables, not a morphological analyzer.
 */

import { indexByHead, inflectionMatch, HAN_RUN, HIRA_RUN } from './flection.mjs';

export const DEFAULT_TOKENIZER = {
  charLevel: false,
  caseFold: true,
  innerApostrophe: false,
  innerHyphen: false,
};

/** Fallback preset used before the language list loads (offline start). */
export const FALLBACK_LANGUAGE = {
  code: 'xx',
  name: 'Custom language',
  native_name: null,
  script: null,
  direction: 'ltr',
  tokenizer: DEFAULT_TOKENIZER,
};

const LETTER_CLASS = '\\p{L}\\p{M}';
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const MARK = /\p{M}/u;
const MAX_DICT_WORD = 12;

/**
 * Build the word-matching regex for a non char-level language.
 * A word is one or more letters (any script), optionally joined by
 * apostrophes or hyphens when the language allows them inside words.
 */
export function buildWordRegex(tokenizer) {
  const t = { ...DEFAULT_TOKENIZER, ...tokenizer };
  if (t.charLevel) return null;
  let inner = '';
  if (t.innerApostrophe) inner += "'\\u2019";
  if (t.innerHyphen) inner += '\\-';
  if (!inner) {
    return new RegExp(`[${LETTER_CLASS}]+`, 'gu');
  }
  return new RegExp(`[${LETTER_CLASS}]+(?:[${inner}][${LETTER_CLASS}]+)*`, 'gu');
}

/**
 * Tokenize text into words (or characters for char-level languages).
 * Returns [{ text, start, end }] with end exclusive. Whitespace and
 * punctuation are skipped (they delimit tokens but are not tokens).
 *
 * `dictionary` (optional Set of terms) switches char-level languages from
 * per-character to dictionary segmentation - see the module header.
 */
export function tokenize(text, tokenizer = DEFAULT_TOKENIZER, dictionary = null) {
  const t = { ...DEFAULT_TOKENIZER, ...tokenizer };
  const tokens = [];
  if (t.charLevel) {
    if (dictionary && dictionary.size > 0) {
      const seg = segmenterFor(t.code);
      if (seg) return segmentWithIcu(seg, text, t, dictionary);
      return segmentWithDictionary(String(text ?? ''), t, dictionary);
    }
    const seg = segmenterFor(t.code);
    if (seg) return segmentWithIcu(seg, text, t, null);
    return charTokens(String(text ?? ''), tokens);
  }
  const re = buildWordRegex(t);
  for (const m of text.matchAll(re)) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** Legacy per-character pass: a base character plus its combining marks. */
function charTokens(text, tokens) {
  const chars = Array.from(text);
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (WORD_CHAR.test(ch)) {
      let end = i + 1;
      while (end < chars.length && MARK.test(chars[end])) end += 1;
      const seg = chars.slice(i, end).join('');
      const start = offsetOf(text, chars, i);
      tokens.push({ text: seg, start, end: start + seg.length });
      i = end;
    } else {
      i += 1;
    }
  }
  return tokens;
}

/** True for characters that participate in a no-space word run. */
function isKana(ch) {
  return /[\u3041-\u3096\u30A1-\u30FA\u30FC\u30FD\uFF67-\uFF9F]/u.test(ch);
}

/**
 * Greedy longest-match segmentation of a no-space text against a term
 * dictionary. Strategy per word run:
 *   - at each position, take the longest dictionary term (up to 12 chars)
     that starts here;
 *   - if nothing matches and the position is KANA, absorb the kana stretch
 *     until the next dictionary hit (or the run end) into one token - kana
 *     runs are typically okurigana endings that behave as one unit;
 *   - otherwise take the single character (unknown kanji stay clickable
 *     individually; use text selection for exact multi-character terms).
 */
function segmentWithDictionary(text, t, dictionary) {
  const chars = Array.from(text);
  const tokens = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (!WORD_CHAR.test(ch)) {
      i += 1;
      continue;
    }
    // Longest dictionary match starting at this character.
    let matchLen = 0;
    const limit = Math.min(chars.length, i + MAX_DICT_WORD);
    let probe = limit;
    while (probe > i) {
      const candidate = chars.slice(i, probe).join('');
      if (dictionary.has(candidate) || dictionary.has(normalizeTerm(candidate, t))) {
        matchLen = probe - i;
        break;
      }
      probe -= 1;
    }
    if (matchLen > 0) {
      pushToken(tokens, text, chars, i, i + matchLen);
      i += matchLen;
      continue;
    }
    // Kana stretch without a dictionary hit: one calm token until the next
    // dictionary match, a non-kana character, or the end of the word run.
    if (isKana(ch)) {
      let end = i + 1;
      while (end < chars.length) {
        if (!isKana(chars[end]) && !MARK.test(chars[end])) break;
        // Does a dictionary term start at `end`? Then the stretch ends here.
        let hit = false;
        let probe2 = Math.min(chars.length, end + MAX_DICT_WORD);
        while (probe2 > end) {
          const candidate = chars.slice(end, probe2).join('');
          if (dictionary.has(candidate) || dictionary.has(normalizeTerm(candidate, t))) {
            hit = true;
            break;
          }
          probe2 -= 1;
        }
        if (hit) break;
        end += 1;
      }
      pushToken(tokens, text, chars, i, end);
      i = end;
      continue;
    }
    // Unknown single character (kanji, Thai, Khmer...).
    pushToken(tokens, text, chars, i, i + 1);
    i += 1;
  }
  return mergeInflectedUnits(tokens, text, flectionIndexFor(dictionary));
}

// ---------------------------------------------------------------- icu segments

const SEGMENTERS = new Map(); // locale key -> Intl.Segmenter | null

/** Cached Intl.Segmenter for the language code (or the default locale).
 *  Returns null when the runtime has none (old browsers) or the code is
 *  not a usable locale tag. */
function segmenterFor(code) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  const key = typeof code === 'string' && code ? code : '';
  if (SEGMENTERS.has(key)) return SEGMENTERS.get(key);
  let seg = null;
  try {
    seg = new Intl.Segmenter(key || undefined, { granularity: 'word' });
  } catch {
    seg = null; // structurally invalid locale tag - fall back per character
  }
  SEGMENTERS.set(key, seg);
  return seg;
}

/**
 * ICU word units of the text as char-index ranges. Code-unit offsets from
 * the Segmenter are mapped through the char array (surrogate pairs never
 * split at word boundaries, but a mismatch drops the segment defensively).
 */
function icuWordRanges(seg, text, chars) {
  const charAt = new Map(); // code-unit offset -> char index
  let off = 0;
  for (let ci = 0; ci < chars.length; ci += 1) {
    charAt.set(off, ci);
    off += chars[ci].length;
  }
  const ranges = [];
  for (const s of seg.segment(text)) {
    if (!s.isWordLike) continue;
    const start = charAt.get(s.index);
    const end = charAt.get(s.index + s.segment.length);
    if (start == null || end == null || end <= start) continue;
    if (chars.slice(start, end).join('') !== s.segment) continue;
    ranges.push({ start, end });
  }
  return ranges;
}

/**
 * Segmentation with the ICU word segmenter: dictionary terms first (the
 * learner's own words win), ICU word units for everything else, then the
 * inflection merge. Without a dictionary the ICU units stand alone -
 * already a large upgrade over per-character tokens.
 */
function segmentWithIcu(seg, text, t, dictionary) {
  const chars = Array.from(text);
  const ranges = icuWordRanges(seg, text, chars);
  const tokens = [];
  let i = 0;
  let r = 0; // pointer into ranges (i only moves forward)
  while (i < chars.length) {
    const ch = chars[i];
    if (!WORD_CHAR.test(ch)) {
      i += 1;
      continue;
    }
    while (r < ranges.length && ranges[r].end <= i) r += 1;
    if (dictionary && dictionary.size > 0) {
      let matchLen = 0;
      const limit = Math.min(chars.length, i + MAX_DICT_WORD);
      let probe = limit;
      while (probe > i) {
        const candidate = chars.slice(i, probe).join('');
        if (dictionary.has(candidate) || dictionary.has(normalizeTerm(candidate, t))) {
          matchLen = probe - i;
          break;
        }
        probe -= 1;
      }
      if (matchLen > 0) {
        pushToken(tokens, text, chars, i, i + matchLen);
        i += matchLen;
        continue;
      }
    }
    const range = r < ranges.length && i >= ranges[r].start && i < ranges[r].end ? ranges[r] : null;
    if (range) {
      const end = Math.max(i + 1, range.end);
      pushToken(tokens, text, chars, i, end);
      i = end;
      continue;
    }
    pushToken(tokens, text, chars, i, i + 1);
    i += 1;
  }
  return mergeInflectedUnits(tokens, text, dictionary && dictionary.size > 0 ? flectionIndexFor(dictionary) : null);
}

// ---------------------------------------------------------------- inflection merge

const INDEX_BY_DICT = new WeakMap(); // dictionary Set -> head index

/** Head index of a dictionary Set, built once per Set (Sets are stable for
 *  a whole reading session, so per-sentence tokenize calls stay cheap). */
function flectionIndexFor(dictionary) {
  if (!dictionary || typeof dictionary.has !== 'function' || typeof dictionary[Symbol.iterator] !== 'function') return null;
  let index = INDEX_BY_DICT.get(dictionary);
  if (!index) {
    index = indexByHead((function* mapPairs() {
      for (const term of dictionary) yield [term, true];
    })());
    INDEX_BY_DICT.set(dictionary, index);
  }
  return index;
}

const PURE_HIRA_RE = /^(?:[ぁ-ゖー])+$/;

/**
 * Japanese inflection merge, applied to already-segmented tokens: a token
 * that starts with a Kanji head absorbs the directly following hiragana
 * tokens when the dictionary knows the base word and the kana is a valid
 * conjugated ending (眠 + って + いる -> 眠っている). Kana beyond the valid
 * ending (particles, the next word) stays separate, and nothing merges
 * without dictionary confirmation - 猫 + は never becomes 猫は. No-op for
 * languages without Han+kana shapes (Chinese, Thai...).
 */
function mergeInflectedUnits(tokens, text, index) {
  if (!index || index.size === 0 || tokens.length === 0) return tokens;
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!HAN_RUN.test(tok.text)) {
      out.push(tok);
      i += 1;
      continue;
    }
    // Absorb the adjacent hiragana run (ICU keeps okurigana separate).
    let j = i;
    let runEnd = tok.end;
    while (
      j + 1 < tokens.length &&
      tokens[j + 1].start === runEnd &&
      PURE_HIRA_RE.test(tokens[j + 1].text) &&
      runEnd - tok.start <= 16
    ) {
      j += 1;
      runEnd = tokens[j].end;
    }
    if (j === i) {
      out.push(tok);
      i += 1;
      continue;
    }
    const whole = text.slice(tok.start, runEnd);
    const match = inflectionMatch(whole, index);
    if (!match) {
      // No inflection confirmed: the tokens stand as segmented.
      for (let k = i; k <= j; k += 1) out.push(tokens[k]);
      i = j + 1;
      continue;
    }
    const headLen = whole.match(HAN_RUN)[0].length;
    // Merged word unit; kana beyond the valid ending stays clickable.
    const mergedText = whole.slice(0, headLen + match.tail.length);
    const mergedEnd = tok.start + mergedText.length;
    out.push({ text: mergedText, start: tok.start, end: mergedEnd });
    const restText = whole.slice(mergedText.length);
    if (restText) out.push({ text: restText, start: mergedEnd, end: runEnd });
    i = j + 1;
  }
  return out;
}

function pushToken(tokens, text, chars, from, to) {
  const seg = chars.slice(from, to).join('');
  const start = offsetOf(text, chars, from);
  tokens.push({ text: seg, start, end: start + seg.length });
}

/** Map an index into Array.from() chars back to a string offset. */
function offsetOf(text, chars, charIndex) {
  if (charIndex === 0) return 0;
  let count = 0;
  for (let i = 0; i < charIndex; i++) count += chars[i].length;
  return count;
}

/**
 * Normalize a term for storage and comparison.
 * Unicode NFC composition, trim, optional case folding.
 */
export function normalizeTerm(term, tokenizer = DEFAULT_TOKENIZER) {
  const t = { ...DEFAULT_TOKENIZER, ...tokenizer };
  let s = String(term ?? '').trim().normalize('NFC');
  if (t.caseFold) s = s.toLowerCase();
  return s;
}

/** Distinct terms of a text, in order of first appearance. */
export function distinctTerms(text, tokenizer, dictionary = null) {
  const seen = new Set();
  const out = [];
  for (const tok of tokenize(text, tokenizer, dictionary)) {
    const norm = normalizeTerm(tok.text, tokenizer);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push({ raw: tok.text, normalized: norm });
    }
  }
  return out;
}

/** Rough sentence segmentation for difficulty statistics. */
export function splitSentences(text) {
  return String(text)
    .split(/(?<=[.!?…])\s+|(?<=[。！？؟])\s*|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Total token count and unique normalized term set of a text. */
export function textStats(text, tokenizer, dictionary = null) {
  const tokens = tokenize(text, tokenizer, dictionary);
  const unique = new Set(tokens.map((t) => normalizeTerm(t.text, tokenizer)));
  return { tokens: tokens.length, unique: unique.size, sentences: splitSentences(text).length };
}
