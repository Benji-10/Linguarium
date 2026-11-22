/**
 * Language-agnostic tokenizer.
 *
 * Languages are described by a small tokenizer configuration, so any
 * language - including constructed languages like Toki Pona or a user's
 * own custom language - works the same way. The configuration comes from
 * the knowledge.languages table (see sql/seed.sql):
 *
 *   {
 *     charLevel:       true  -> tokenize per character (no word spaces),
 *     caseFold:        true  -> normalize terms to lower case,
 *     innerApostrophe: true  -> keep apostrophes inside words (l'hiver),
 *     innerHyphen:     true  -> keep hyphens inside words (meta-analysis)
 *   }
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
 */
export function tokenize(text, tokenizer = DEFAULT_TOKENIZER) {
  const t = { ...DEFAULT_TOKENIZER, ...tokenizer };
  const tokens = [];
  if (t.charLevel) {
    // Grapheme-ish pass: a base character plus any combining marks.
    const chars = Array.from(text);
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (/[\p{L}\p{M}\p{N}]/u.test(ch)) {
        let end = i + 1;
        while (end < chars.length && /\p{M}/u.test(chars[end])) end += 1;
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
  const re = buildWordRegex(t);
  for (const m of text.matchAll(re)) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
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
export function distinctTerms(text, tokenizer) {
  const seen = new Set();
  const out = [];
  for (const tok of tokenize(text, tokenizer)) {
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
export function textStats(text, tokenizer) {
  const tokens = tokenize(text, tokenizer);
  const unique = new Set(tokens.map((t) => normalizeTerm(t.text, tokenizer)));
  return { tokens: tokens.length, unique: unique.size, sentences: splitSentences(text).length };
}
