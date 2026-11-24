/**
 * Japanese inflection awareness - the shared engine behind three fixes:
 *
 *   1. WORD UNITS (tokenizer.mjs): a Kanji head plus its okurigana and a
 *      conjugated ending form ONE clickable token (眠っている, 食べている,
 *      高くなかった) whenever the learner's dictionary confirms the base
 *      word - instead of the old per-character clicks (澱|淀粉) that could
 *      only look up single characters.
 *
 *   2. FURIGANA FROM VOCABULARY (reader.mjs): a reading stored for the
 *      dictionary form (眠る -> ねむる) lights up the inflected surface
 *      with the CORRECT reading (眠っている -> ねむっている), not the
 *      dictionary form's reading stamped over the whole word.
 *
 *   3. ANNOTATIONS (ruby.mjs): texts annotated with the DICTIONARY-form
 *      reading in parentheses - 眠（ねむる）っている - have their reading
 *      adjusted to the stem (ねむ) so the okurigana that follows is not
 *      pronounced twice (the old behaviour read ねむる + っている =
 *      "ねむるっている").
 *
 * The tables are a compact, conservative subset of school grammar: one
 * primary conjugated ending plus any number of auxiliary endings. Nothing
 * statistical, nothing AI-generated - every rule below is auditable data.
 *
 * Shape-gated: everything only fires on Hiragana tails after a Han head,
 * so Chinese (no kana) and other char-level languages pass through
 * untouched. The irregular 来る is skipped outright: its stem reading
 * alternates き/こ and cannot be derived from the dictionary form - better
 * no furigana than wrong furigana.
 *
 * Pure functions, browser/Node safe.
 */

const HAN = '\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF';
const HIRA = '\\u3041-\\u3096\\u30FC';

const HAN_RUN = new RegExp(`^[${HAN}]+`);
const HIRA_RUN = new RegExp(`^[${HIRA}]+`);
const HEAD_TAIL = new RegExp(`^([${HAN}]+)([${HIRA}]+)$`);

/**
 * Dictionary ending (the final kana of the dictionary form) -> the surface
 * (conjugated) endings it can take. る covers both ichidan (て) and godan
 * (って) verbs: real text is grammatical Japanese, so accepting the union
 * cannot mis-merge it - and callers always require the dictionary to know
 * the base word before merging anything. 行く's irregular te-form (行って)
 * is covered by って under く.
 */
const PRIMARY = {
  る: ['させられ', 'られる', 'させる', 'って', 'った', 'ったら', 'ったり', 'て', 'た', 'たら', 'たり', 'らない', 'ない', 'ります', 'ます', 'まし', 'れば', 'ろ', 'よう', 'られ', 'させ', 'え'],
  う: ['って', 'った', 'わない', 'います', 'えば', 'おう', 'える', 'われ', 'わせ'],
  く: ['いて', 'いた', 'かない', 'きます', 'えば', 'こう', 'ける', 'かれ', 'かせ', 'って', 'った'],
  ぐ: ['いで', 'いだ', 'がない', 'ぎます', 'げば', 'ごう', 'げる', 'がれ', 'がせ'],
  す: ['して', 'した', 'さない', 'します', 'せば', 'そう', 'せる', 'され', 'させ'],
  つ: ['って', 'った', 'たない', 'ちます', 'てば', 'とう', 'てる', 'たれ', 'たせ'],
  ぬ: ['なない', 'なんて', 'なんだ', 'んで', 'にます', 'ねば', 'のう', 'ねる', 'なれ', 'なせ'],
  ぶ: ['んで', 'んだ', 'ばない', 'びます', 'べば', 'ぼう', 'べる', 'ばれ', 'ばせ'],
  む: ['んで', 'んだ', 'まない', 'みます', 'めば', 'もう', 'める', 'まれ', 'ませ'],
  い: ['くなかった', 'くありません', 'くない', 'かった', 'くて', 'く', 'ければ', 'かろ'],
  する: ['させられ', 'される', 'されて', 'させて', 'させた', 'させない', 'しません', 'しない', 'しろ', 'しない', 'して', 'した', 'します', 'すれば', 'しよう', 'せる', 'させ'],
};

/** Endings that may follow a primary ending and still belong to the same
 *  word (progressive / past / negative / polite chains: っている,
 *  なかった, ました, ってた...). Kept explicit and small on purpose. */
const AUX = [
  'いなかった', 'いませんでした', 'いなくて', 'なかった', 'ませんでした', 'ました',
  'ください', 'たかった', 'たくない', 'ている', 'ていた', 'てない', 'てる', 'てた',
  'いません', 'います', 'いない', 'いる', 'いた', 'ませ', 'ます', 'なくて', 'なく',
  'たら', 'たり', 'そう', 'すぎ', 'たい', 'なく', 'で',
];

const ENDINGS = ['する', ...Object.keys(PRIMARY)];

/** Longest first, so greedy matching prefers the longest form. */
function longestFirst(list) {
  return [...list].sort((a, b) => b.length - a.length);
}
const PRIMARY_LONG = Object.fromEntries(Object.entries(PRIMARY).map(([k, v]) => [k, longestFirst(v)]));
const AUX_LONG = longestFirst(AUX);

/**
 * Longest prefix of `run` that decomposes as one primary conjugated ending
 * of the dictionary ending `dictTail` followed by any number of auxiliary
 * endings. Returns the consumed length in characters, 0 when nothing valid
 * starts the run. Example: matchFormPrefix('る', 'っている猫') === 4.
 */
export function matchFormPrefix(dictTail, run) {
  const primaries = PRIMARY_LONG[dictTail];
  if (!primaries || !run) return 0;
  let best = 0;
  const chain = (pos) => {
    if (pos > best) best = pos;
    for (const a of AUX_LONG) {
      if (run.startsWith(a, pos)) chain(pos + a.length);
    }
  };
  for (const p of primaries) {
    if (run.startsWith(p)) chain(p.length);
  }
  return best;
}

/**
 * Split a dictionary term into { head, okurigana, ending }: the leading Han
 * run, the kana between it and the final ending, and the final ending
 * (する or one kana from PRIMARY's keys). Returns null when the term has no
 * inflectable shape (pure-kanji nouns, kana-only words, katakana...).
 */
function decomposeTerm(term) {
  const s = String(term ?? '');
  const head = s.match(HAN_RUN)?.[0];
  if (!head) return null;
  const rest = s.slice(head.length);
  if (!rest || !HIRA_RUN.test(rest)) return null;
  if (rest.length >= 2 && rest.endsWith('する')) {
    return { head, okurigana: rest.slice(0, -2), ending: 'する' };
  }
  const ending = rest[rest.length - 1];
  if (!(ending in PRIMARY)) return null;
  return { head, okurigana: rest.slice(0, -1), ending };
}

/**
 * Index dictionary terms by their Kanji head for inflection lookups.
 * `pairs` is any iterable of [term, value]; the value is carried through
 * untouched (callers pass readings, vocabulary entries, or the terms
 * themselves). Inflectable terms (食べる) are indexed under their head (食)
 * with their okurigana and ending; everything else is indexed verbatim so
 * exact matches stay reachable through the same structure.
 */
export function indexByHead(pairs) {
  const index = new Map(); // head -> [{ term, value, okurigana, ending }]
  for (const [term, value] of pairs ?? []) {
    if (typeof term !== 'string' || term === '') continue;
    const d = decomposeTerm(term);
    const head = d ? d.head : term.match(HAN_RUN)?.[0];
    if (!head) continue;
    if (!index.has(head)) index.set(head, []);
    index.get(head).push(
      d ? { term, value, okurigana: d.okurigana, ending: d.ending } : { term, value, okurigana: null, ending: null },
    );
  }
  return index;
}

/**
 * Match an inflected surface token against an indexByHead index.
 * The token must be <Han head><hiragana tail>; a candidate matches when
 * its okurigana prefixes the tail and the remainder is a valid conjugation
 * of its ending. Returns { term, value, tail } where `tail` is the kana
 * that belongs to this word (anything after it in the token belongs to the
 * next word) - or null. 来 is rejected (irregular stem readings).
 */
export function inflectionMatch(token, index) {
  const m = HEAD_TAIL.exec(String(token ?? ''));
  if (!m) return null;
  const [, head, tail] = m;
  if (head === '来') return null;
  const candidates = index.get(head);
  if (!candidates) return null;
  let best = null;
  for (const c of candidates) {
    if (c.okurigana == null) continue;
    if (!tail.startsWith(c.okurigana)) continue;
    const rest = tail.slice(c.okurigana.length);
    const consumed = matchFormPrefix(c.ending, rest);
    if (consumed === 0) continue;
    const whole = c.okurigana + rest.slice(0, consumed);
    if (!best || whole.length > best.tail.length) best = { term: c.term, value: c.value, tail: whole };
  }
  return best;
}

/**
 * Reading of an inflected surface token, derived from the reading of its
 * dictionary form: 食べる(たべる) + surface 食べている -> たべている.
 * The surface tail splits into the dictionary okurigana (which reads
 * itself) plus the conjugated ending, so only the ending is replaced:
 * reading = stem + okurigana + conjugated tail. `getReading(term)` returns
 * the stored reading or null. Returns the corrected reading or null -
 * never a guess (nothing rather than something wrong).
 */
export function conjugatedReading(token, getReading) {
  const m = HEAD_TAIL.exec(String(token ?? ''));
  if (!m) return null;
  const [, head, tail] = m;
  if (head === '来') return null;
  let best = null;
  // tail = okurigana + conjugated ending: try every split point.
  for (let o = 0; o <= Math.min(tail.length - 1, 4); o += 1) {
    const okurigana = tail.slice(0, o);
    const rest = tail.slice(o);
    for (const ending of ENDINGS) {
      const term = head + okurigana + ending;
      const reading = getReading(term);
      if (typeof reading !== 'string' || reading === '') continue;
      const dictTail = okurigana + ending;
      if (!reading.endsWith(dictTail) || reading.length <= dictTail.length) continue;
      const stem = reading.slice(0, reading.length - dictTail.length);
      if (stem === '' || !HIRA_RUN.test(stem)) continue;
      if (matchFormPrefix(ending, rest) === 0) continue;
      const full = stem + okurigana + rest;
      if (!best || full.length > best.length) best = full;
    }
  }
  return best;
}

/**
 * Surface reading derived from ONE dictionary-form reading with no
 * dictionary to confirm the term (the AI-enrichment case: the model was
 * asked about 眠っている and answered with the dictionary reading ねむる).
 * Every (okurigana, ending) split of the token's tail is tried; correct
 * derivations end with the token's own kana tail, and the shortest valid
 * candidate wins (wrong splits re-inject the okurigana: たべべている).
 * Returns the corrected reading or null when nothing derives cleanly.
 */
export function surfaceReadingFromDict(token, dictReading) {
  const m = HEAD_TAIL.exec(String(token ?? ''));
  const reading = typeof dictReading === 'string' ? dictReading : null;
  if (!m || !reading || !HIRA_RUN.test(reading.slice(-1))) return null;
  const [, head, tail] = m;
  if (head === '来') return null;
  // A reading that already ends with the token's own kana tail IS the
  // surface reading (眠っている -> ねむっている, or the plain dictionary
  // form 食べる -> たべる): nothing to adjust.
  if (reading.endsWith(tail)) return null;
  let best = null;
  for (let o = 0; o <= Math.min(tail.length - 1, 4); o += 1) {
    const okurigana = tail.slice(0, o);
    const rest = tail.slice(o);
    for (const ending of ENDINGS) {
      const dictTail = okurigana + ending;
      if (!reading.endsWith(dictTail) || reading.length <= dictTail.length) continue;
      if (matchFormPrefix(ending, rest) === 0) continue;
      const full = reading.slice(0, reading.length - dictTail.length) + okurigana + rest;
      if (!full.endsWith(tail)) continue;
      if (!best || full.length < best.length) best = full;
    }
  }
  return best;
}

/**
 * Adjust a parenthetical reading that carries the DICTIONARY form down to
 * the stem reading when the text continues with a conjugated ending:
 * 眠（ねむる）っている -> ねむ (って + いる then read as written, total
 * ねむっている). Returns null when no adjustment is warranted: stem-style
 * annotations (抜（ぬ）かした, 林檎（りんご）が) must pass through unchanged.
 * `following` is the text right after the closing parenthesis.
 */
export function adjustAnnotationReading(reading, following) {
  const r = String(reading ?? '');
  const f = String(following ?? '');
  if (!r || !HIRA_RUN.test(r.slice(-1))) return null;
  const run = f.match(HIRA_RUN)?.[0];
  if (!run) return null;
  // する-verbs: 勉強（べんきょうする）して -> べんきょう + して.
  if (r.length > 2 && r.endsWith('する')) {
    return matchFormPrefix('する', run) > 0 ? r.slice(0, -2) : null;
  }
  const tail = r[r.length - 1];
  if (!(tail in PRIMARY)) return null;
  // 来（くる）た would wrongly become くた - the irregular is skipped.
  if (r === 'くる') return null;
  if (matchFormPrefix(tail, run) === 0) return null;
  const stem = r.slice(0, -1);
  return stem === '' ? null : stem;
}

export { HAN_RUN, HIRA_RUN, HEAD_TAIL };
