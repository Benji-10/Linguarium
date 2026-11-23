/**
 * Ruby annotations: furigana (Japanese) and pinyin (Chinese) as real <ruby>
 * markup instead of inline parenthetical text.
 *
 * Public-domain texts (Wikisource editions, learner readers, the seeded
 * 吾輩は猫である opening) often carry readings inline in parentheses:
 *
 *     吾輩（わがはい）は猫である。      Japanese, full-width parens
 *     吾輩(わがはい)は猫である。      Japanese, half-width parens
 *     汉字(hànzì)                     Chinese pinyin (tone marks or plain)
 *
 * Rendering these inline lengthens the text and breaks screen readers (the
 * parenthetical kana is read as if it were part of the sentence). The reader
 * therefore parses them out and renders proper ruby elements instead:
 *
 *     <ruby>吾輩<rt>わがはい</rt></ruby>
 *
 * The parsing is deliberately conservative: an annotation is only extracted
 * when the parenthetical content actually looks like a reading of the Han run
 * that immediately precedes it.
 *
 * Pure functions, browser/Node safe.
 */

const HAN = '\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF';
const KANA = '\\u3041-\\u3096\\u30A1-\\u30FA\\u30FC\\u30FD\\u3005\\u3006\\uFF67-\\uFF9F';
const TONE = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ';
const PINYIN_WORD = `[a-z0-9ü'${TONE}]+`;

const ANNOTATION_RE = new RegExp(`([${HAN}]+)[（(]([^（）()\\n]{1,24})[)）]`, 'gu');

const KANA_ONLY_RE = new RegExp(`^[${KANA}]+$`);
const PINYIN_ONLY_RE = new RegExp(`^(${PINYIN_WORD})(\\s+${PINYIN_WORD})*$`, 'u');
const PLAIN_PINYIN_RE = /^[a-z0-9' ]+$/;

function isKanaReading(s) {
  return KANA_ONLY_RE.test(s);
}

/** Count pinyin syllables: space-separated tokens, or vowel groups inside
 *  a single unspaced token (hànzì -> han + zi -> 2). */
function pinyinSyllables(s) {
  const parts = s.trim().split(/[\s']+/).filter(Boolean);
  let n = 0;
  for (const part of parts) {
    const groups = part.match(/[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/gu);
    n += groups ? groups.length : 1;
  }
  return Math.max(1, n);
}

/**
 * Pinyin test. Tone-marked syllables are an unambiguous signal; plain ASCII
 * is accepted only when it looks like syllables, not like an English gloss
 * (short space-separated lowercase tokens, roughly one syllable per Han
 * character).
 */
function isPinyinReading(s, hanCount) {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (!/[a-z0-9ü'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/iu.test(trimmed)) return false;
  if (!/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(trimmed)) {
    // No tone marks: accept only syllable-shaped lowercase ASCII.
    if (!PLAIN_PINYIN_RE.test(trimmed)) return false;
    const tokens = trimmed.split(' ');
    if (tokens.some((t) => t.length > 6)) return false;
    if (tokens.length > hanCount * 2 + 1) return false;
  }
  return PINYIN_ONLY_RE.test(trimmed);
}

/**
 * How many trailing characters of the matched Han run the reading actually
 * covers. A parenthetical reading attaches to the END of the Han run (the
 * run may include preceding words: 一番獰悪（どうあく） only annotates 獰悪).
 * Furigana: roughly 2 kana per kanji. Pinyin: one syllable per character.
 * This is a documented approximation, applied only when it narrows the base.
 */
function coveredRunLength(kind, reading, runLen) {
  if (runLen <= 1) return 1;
  if (kind === 'pinyin') {
    const syllables = pinyinSyllables(reading);
    return Math.max(1, Math.min(runLen, syllables));
  }
  const kanaLen = Array.from(reading).length;
  const est = Math.max(1, Math.ceil(kanaLen / 2));
  return Math.max(1, Math.min(runLen, est));
}

/**
 * Parse inline reading annotations out of a text.
 *
 * Returns { clean, marks }:
 *   clean - the text with the parenthetical readings removed (so tokenization,
 *           difficulty estimation and text length reflect the real text)
 *   marks - [{ baseStart, baseEnd, base, reading, kind }]
 *           offsets are into `clean`; base is the Han run the reading covers.
 */
export function parseRuby(text) {
  const source = String(text ?? '');
  const marks = [];
  let clean = '';
  let cursor = 0; // read position in `source`
  let shift = 0; // length removed so far

  for (const m of source.matchAll(ANNOTATION_RE)) {
    const [full, hanRun, paren] = m;
    const hanCount = Array.from(hanRun).length;
    let kind = null;
    if (isKanaReading(paren)) {
      // Reading length should be plausible for the base (kana roughly matches
      // the pronunciation of the kanji run).
      const kanaCount = Array.from(paren).length;
      if (kanaCount >= 1 && kanaCount <= hanCount * 4 + 2) kind = 'furigana';
    } else if (isPinyinReading(paren, hanCount)) {
      kind = 'pinyin';
    }
    if (!kind) continue;

    // The reading may cover only a suffix of the matched Han run (the run can
    // include preceding words). Narrow the base to what the reading plausibly
    // covers; the uncovered head stays plain text.
    const covered = coveredRunLength(kind, paren, hanCount);
    const base = covered < hanCount ? hanRun.slice(hanRun.length - covered) : hanRun;

    // Copy everything before the annotation, minus the parenthetical part.
    const annotationStart = m.index + hanRun.length;
    clean += source.slice(cursor, annotationStart);
    const baseStart = m.index - shift + (hanRun.length - covered);
    marks.push({
      baseStart,
      baseEnd: baseStart + base.length,
      base,
      reading: paren.replace(/\s+/g, ' ').trim(),
      kind,
    });
    cursor = m.index + full.length;
    shift += full.length - hanRun.length;
  }
  clean += source.slice(cursor);
  return { clean, marks };
}

/** Does this text contain ruby annotations? (cheap pre-check for the UI) */
export function hasRuby(text) {
  const s = String(text ?? '');
  if (!ANNOTATION_RE.test(s)) {
    ANNOTATION_RE.lastIndex = 0;
    return false;
  }
  ANNOTATION_RE.lastIndex = 0;
  return parseRuby(s).marks.length > 0;
}

/**
 * Readings for tokens that are NOT annotated in the text: vocabulary the
 * learner (or the shared lexicon / a dictionary lookup) already carries a
 * reading for. Builds a normalized term -> reading map, applying the same
 * normalization the tokenizer uses.
 */
export function readingMapFor(entries, tokenizer) {
  const map = new Map();
  for (const e of entries ?? []) {
    if (!e?.term || !e?.reading) continue;
    const norm = String(e.term).trim().normalize('NFC');
    if (!map.has(norm)) map.set(norm, String(e.reading).trim());
  }
  return map;
}
