/**
 * Language-agnostic tokenizer.
 *
 * Languages are described by a small tokenizer configuration, so any
 * language - including constructed languages like Toki Pona or a user's
 * own custom language - works the same way. The configuration comes from
 * the knowledge.languages table (see sql/seed.sql):
 *
 *   {
 *     charLevel:       true  -> no word spaces (Japanese, Chinese, Thai...),
 *     caseFold:        true  -> normalize terms to lower case,
 *     innerApostrophe: true  -> keep apostrophes inside words (l'hiver),
 *     innerHyphen:     true  -> keep hyphens inside words (meta-analysis)
 *   }
 *
 * For char-level languages, `tokenize` additionally accepts a SEGMENTATION
 * DICTIONARY (a Set of terms: the learner's own vocabulary, the shared
 * lexicon, ruby bases of this very text). Japanese/Chinese are then segmented
 * into words with greedy longest-match against that dictionary instead of
 * being cut per character. The dictionary grows with the learner's own
 * vocabulary, so segmentation improves as they learn - and the honest label
 * stays the same: this is dictionary matching, not a morphological analyzer.
 */

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
    return dictionary && dictionary.size > 0
      ? segmentWithDictionary(String(text ?? ''), t, dictionary)
      : charTokens(String(text ?? ''), tokens);
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
  return tokens;
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
