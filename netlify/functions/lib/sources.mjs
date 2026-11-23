/**
 * Open content sources for the import pipeline and the word-lookup chain.
 *
 * Everything here is keyless, free, and honestly attributed:
 *   - Project Gutenberg via Gutendex (public-domain books)
 *   - Aozora Bunko for Japanese (curated famous-work shelf, furigana kept)
 *   - Wikisource / Wikipedia / Wikibooks / Wikinews via the standard MediaWiki API
 *   - a small curated list of stable news RSS feeds
 *   - Wiktionary REST definitions (CC BY-SA) + dictionaryapi.dev (English)
 *
 * This module is PURE where possible (mappers and parsers take strings) so it
 * is unit-tested without network access. The fetch helpers carry the SSRF
 * guard every server-side fetch must pass.
 */

import { inflateRawSync } from 'node:zlib';

// ---------------------------------------------------------------- guard

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^metadata\./i,
  /\.internal$/i,
];

/** Reject non-http(s) URLs, private/local hosts, odd ports, credentials. */
export function ssrfSafeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error('not a URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http(s) URLs');
  if (u.username || u.password) throw new Error('credentials in URL');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('odd port');
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) throw new Error('private or local host');
  if (host.endsWith('.')) throw new Error('invalid host');
  return u;
}

/** Fetch with SSRF validation, redirect cap, size cap and a timeout. */
export async function safeFetch(rawUrl, opts) {
  const maxBytes = opts?.maxBytes ?? Infinity;
  let url = ssrfSafeUrl(rawUrl);
  for (let hop = 0; hop <= (opts?.maxRedirects ?? 3); hop += 1) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Linguarium/0.1 (language-learning reading app)' },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 20000),
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = ssrfSafeUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) return res;
    // Enforce the size cap while streaming.
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared && declared > maxBytes) {
      throw new Error(`source too large (${Math.round(declared / 1024)} KB > ${Math.round(maxBytes / 1024)} KB cap)`);
    }
    return res;
  }
  throw new Error('too many redirects');
}

export async function fetchText(rawUrl, opts) {
  const res = await safeFetch(rawUrl, opts);
  if (!res.ok) throw new Error(`source responded ${res.status}`);
  return res.text();
}

/** Retry a JSON fetch once on transient failures (Cloudflare 403 challenges,
 * 5xx, network aborts). Gutendex sits behind Cloudflare and occasionally
 *  challenges a datacenter request that a second attempt passes. */
export async function fetchJsonRetry(rawUrl, { attempts = 3, backoffMs = 1200, ...opts } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchJson(rawUrl, opts);
    } catch (err) {
      lastError = err;
      const transient = /responded (403|429|5\d\d)|aborted|TimeoutError|fetch failed|network/i.test(
        String(err?.message ?? err),
      );
      if (!transient || attempt === attempts - 1) throw lastError;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Stream a text body with a BYTE cap and stop early once the cap is reached
 *  (used for Gutenberg books: the reader imports at most the first slice
 *  anyway, so a capped download saves minutes on multi-megabyte books).
 *  The declared content-length is deliberately NOT enforced here - the
 *  stream itself is cut at the cap; a whole-book refusal would defeat the
 *  point (a 754 KB book yields the first 700 KB, which the import cut
 *  handles honestly with a truncation note).
 *  Returns { text, capped } - `capped` says the source was longer. */
export async function fetchTextCapped(rawUrl, { timeoutMs = 30000, maxBytes = 700 * 1024 } = {}) {
  const res = await safeFetch(rawUrl, { timeoutMs });
  if (!res.ok) throw new Error(`source responded ${res.status}`);
  if (!res.body) {
    const text = await res.text();
    return { text, capped: text.length > maxBytes };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let received = 0;
  let out = '';
  let capped = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      capped = true;
      try {
        await reader.cancel();
      } catch {
        /* already closed */
      }
      break;
    }
  }
  if (!capped) out += decoder.decode();
  return { text: out, capped };
}

export async function fetchJson(rawUrl, opts) {
  const text = await fetchText(rawUrl, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('source did not return JSON');
  }
}

// ---------------------------------------------------------------- html -> text

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
};

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Convert HTML to plain reading text.
 *
 * Ruby-aware: NHK Easy News and other learner pages mark furigana with
 * <ruby>漢字<rt>かんじ</rt></ruby>; converting it to the parenthetical
 * annotation form 漢字（かんじ） preserves the reading for the reader's ruby
 * parser instead of dropping it.
 */
export function htmlToText(html) {
  let s = String(html ?? '');
  // Preserve ruby readings as parenthetical annotations before stripping tags.
  s = s.replace(/<ruby[^>]*>([\s\S]*?)<\/ruby>/gi, (m, inner) => {
    const parts = [...inner.matchAll(/<rt[^>]*>([\s\S]*?)<\/rt\s*>/gi)].map((x) => x[1]);
    // <rp> holds the literal fallback parentheses - they are part of the
    // rendered annotation, not of the base word (Aozora XHTML uses them on
    // every ruby element; without this the annotation doubles up).
    let base = inner
      .replace(/<rt[\s\S]*?<\/rt\s*>/gi, '')
      .replace(/<rp[\s\S]*?<\/rp\s*>/gi, '')
      .replace(/<[^>]+>/g, '');
    base = decodeEntities(base).trim();
    const reading = parts.map((p) => decodeEntities(p).trim()).join('');
    return reading && base ? `${base}（${reading}）` : base;
  });
  s = s.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // Block-level elements and breaks become paragraph separators.
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|tr|table|figcaption)\s*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<(li)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // Collapse the whitespace noise but keep deliberate line structure.
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((line, i, arr) => line !== '' || (i > 0 && i < arr.length - 1))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

/** Extract the <title> of an HTML document (best-effort, pre-parse). */
export function htmlTitle(html) {
  const m = String(html ?? '').match(/<title[^>]*>([\s\S]{0,600}?)<\/title\s*>/i);
  if (!m) return null;
  return decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || null;
}

// ---------------------------------------------------------------- wiktionary

/** Normalize a language name for matching Wiktionary's `language` label. */
function normLang(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map the Wiktionary REST `/page/definition/{term}` response to entries for
 * one target language. Response shape: [{ language, language_code,
 * part_of_speech, definitions: [{ definition, examples, links, ... }] }].
 */
export function mapWiktionaryDefinitions(json, languageCode, languageName) {
  const rows = Array.isArray(json) ? json : [];
  const wantCode = String(languageCode).toLowerCase();
  const wantName = normLang(languageName);
  const out = [];
  for (const section of rows) {
    const code = String(section?.language_code ?? '').toLowerCase();
    const name = normLang(section?.language);
    const matches =
      (code && code === wantCode) ||
      (!code && name === wantName) ||
      (wantName && (name === wantName || name === wantName.replace(/ *bokmal * /, '')));
    if (!matches) continue;
    const definitions = Array.isArray(section.definitions) ? section.definitions : [];
    for (const d of definitions) {
      const text = typeof d?.definition === 'string' ? d.definition.replace(/<[^>]+>/g, '').trim() : '';
      if (!text) continue;
      const examples = Array.isArray(d?.examples)
        ? d.examples.map((e) => (typeof e === 'string' ? e : e?.text)).filter((t) => typeof t === 'string').slice(0, 2)
        : [];
      out.push({
        part_of_speech: typeof section?.part_of_speech === 'string' ? section.part_of_speech : null,
        definition: text.slice(0, 500),
        examples: examples.map((t) => t.slice(0, 250)),
      });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

/** Map a dictionaryapi.dev (English) response to the same entry shape. */
export function mapFreeDictionaryApi(json) {
  const rows = Array.isArray(json) ? json : [];
  const out = [];
  let phonetic = null;
  for (const entry of rows) {
    if (!phonetic && typeof entry?.phonetic === 'string') phonetic = entry.phonetic;
    for (const meaning of entry?.meanings ?? []) {
      for (const d of meaning?.definitions ?? []) {
        if (typeof d?.definition !== 'string' || !d.definition.trim()) continue;
        out.push({
          part_of_speech: typeof meaning?.partOfSpeech === 'string' ? meaning.partOfSpeech : null,
          definition: d.definition.slice(0, 500),
          examples: typeof d?.example === 'string' ? [d.example.slice(0, 250)] : [],
        });
        if (out.length >= 8) return { entries: out, phonetic };
      }
    }
  }
  return { entries: out, phonetic };
}

export const WIKTIONARY_PAGE_URL = (term) => `https://en.wiktionary.org/wiki/${encodeURIComponent(term)}`;

// ---------------------------------------------------------------- gutendex

/** Map a Gutendex search response to catalog items. */
export function mapGutendex(json) {
  const books = Array.isArray(json?.results) ? json.results : [];
  return books.slice(0, 24).map((b) => ({
    provider: 'gutenberg',
    ref: String(b.id),
    title: String(b.title ?? '').slice(0, 300),
    author: (b.authors ?? []).map((a) => a?.name).filter(Boolean).join(', ') || null,
    language: (b.languages ?? [])[0] ?? 'en',
    source_url: `https://www.gutenberg.org/ebooks/${b.id}`,
    license: 'public-domain',
    description: null,
  }));
}

/** Page info from a Gutendex response: { count, next, previous } . */
export function gutendexPageInfo(json) {
  return {
    count: Number.isFinite(json?.count) ? json.count : null,
    next: typeof json?.next === 'string' && json.next ? true : false,
    previous: typeof json?.previous === 'string' && json.previous ? true : false,
  };
}

/** Fast Gutendex route: the trailing slash AND an explicit page param are
 *  both required - `?languages=ja` alone hangs the upstream for minutes
 *  (reproduced 2026-11), while `/books/?languages=ja&page=1` answers in
 *  ~250 ms. `?search=...` is NOT reliably fast; callers must set a short
 *  timeout and fall back to the language browse when it stalls.
 *  Gutendex rate-limits bursts hard (also reproduced 2026-11): every call
 *  goes through a TTL memo cache and the language is gated by
 *  GUTENBERG_LANGUAGES upstream, because empty shelves HANG instead of
 *  answering empty. */
const GUTENDEX_LANG = (lang) => (lang === 'nb' ? 'no' : lang);

export const GUTENDEX_BROWSE_URL = (language, page = 1) => {
  const params = new URLSearchParams();
  const lang = GUTENDEX_LANG(language);
  if (lang && lang !== 'en') params.set('languages', lang);
  params.set('page', String(Math.min(100, Math.max(1, page || 1))));
  return `https://gutendex.com/books/?${params.toString()}`;
};

export const GUTENDEX_SEARCH_URL = (q, language, page = 1) => {
  const params = new URLSearchParams();
  const lang = GUTENDEX_LANG(language);
  if (q && q.trim()) params.set('search', q.trim().slice(0, 200));
  if (lang && lang !== 'en') params.set('languages', lang);
  params.set('page', String(Math.min(100, Math.max(1, page || 1))));
  return `https://gutendex.com/books/?${params.toString()}`;
};

export const GUTENDEX_BOOK_URL = (id) => `https://gutendex.com/books/${encodeURIComponent(id)}/`;

/** Gutenberg book-text candidates, in try order. gutenberg.org 503-throttles
 *  datacenter traffic (fails in ~1 s, cheap to try); the pglaf.org mirror
 *  serves the same /cache/epub path reliably but slowly, so it gets a long
 *  timeout and comes first - a working mirror beats a fast refusal. */
export const GUTENBERG_TEXT_URLS = (id) => [
  `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
];

// ---------------------------------------------------------------- mediawiki

/** Norwegian (bokmål) wiki editions live on the 'no' subdomain, the app
 *  language code is 'nb'. Wikipedia itself DOES use nb - hence the
 *  wikipedia-only exclusion below. */
const WIKI_HOST_LANG = (lang) => (lang === 'nb' ? 'no' : lang);
export const MW_HOST = (project, lang) => `${project === 'wikipedia' ? lang : WIKI_HOST_LANG(lang)}.${project}.org`;

export const MW_SEARCH_URL = (project, lang, q) => {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: q.slice(0, 200),
    srlimit: '20',
    format: 'json',
  });
  return `https://${MW_HOST(project, lang)}/w/api.php?${params.toString()}`;
};

/** Map a MediaWiki list=search response to catalog items. */
export function mapMediawikiSearch(json, project, lang, license) {
  const hits = json?.query?.search ?? [];
  return hits.slice(0, 20).map((h) => ({
    provider: project,
    ref: String(h.title),
    title: String(h.title).slice(0, 300),
    author: project === 'wikipedia' ? 'Wikipedia contributors' : null,
    language: lang,
    source_url: `https://${MW_HOST(project, lang)}/wiki/${encodeURIComponent(String(h.title).replace(/ /g, '_'))}`,
    license,
    description: typeof h?.snippet === 'string' ? h.snippet.replace(/<[^>]+>/g, '').slice(0, 200) : null,
  }));
}

export const MW_EXTRACT_URL = (project, lang, title) => {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    titles: title.slice(0, 300),
    format: 'json',
  });
  return `https://${MW_HOST(project, lang)}/w/api.php?${params.toString()}`;
};

export const MW_PARSE_URL = (project, lang, title) => {
  const params = new URLSearchParams({
    action: 'parse',
    page: title.slice(0, 300),
    prop: 'text',
    format: 'json',
  });
  return `https://${MW_HOST(project, lang)}/w/api.php?${params.toString()}`;
};

/** Extract the plaintext from an action=query&prop=extracts response. */
export function extractFromMwExtracts(json) {
  const pages = json?.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    if (typeof page?.extract === 'string' && page.extract.trim() !== '') return page.extract;
  }
  return null;
}

/** Extract the plaintext from an action=parse&prop=text response. */
export function extractFromMwParse(json) {
  const html = json?.parse?.text;
  const raw = typeof html === 'string' ? html : html && typeof html === 'object' && typeof html['*'] === 'string' ? html['*'] : null;
  if (!raw) return null;
  return htmlToText(raw);
}

// ---------------------------------------------------------------- rss

/** Parse an RSS 2.0 / Atom feed into items { title, link, description, published }. */
export function parseRss(xml) {
  const s = String(xml ?? '');
  const items = [];
  const blocks = [...s.matchAll(/<(item|entry)\b[\s\S]*?<\/\1\s*>/gi)].map((m) => m[0]);
  const pick = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
    return m ? m[1] : null;
  };
  const cdata = (v) => {
    if (v == null) return null;
    const inner = String(v).replace(/^<!\[CDATA\[/i, '').replace(/\]\]>$/, '');
    return decodeEntities(inner.replace(/<[^>]+>/g, '')).trim();
  };
  for (const block of blocks.slice(0, 30)) {
    let link = cdata(pick(block, 'link'));
    if (!link) {
      const href = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
      link = href ? href[1] : null;
    }
    const title = cdata(pick(block, 'title'));
    const description = cdata(pick(block, 'description')) ?? cdata(pick(block, 'summary')) ?? cdata(pick(block, 'content'));
    if (!link && !title) continue;
    items.push({
      provider: 'news',
      ref: link || title,
      title: (title ?? 'Untitled item').slice(0, 300),
      author: null,
      language: null,
      source_url: link,
      license: 'unspecified (check the article page)',
      description: description ? description.slice(0, 220) : null,
    });
  }
  return items;
}

// ---------------------------------------------------------------- curated feeds

/**
 * Curated news feeds: only stable, well-known, keyless feeds. Each row names
 * its license situation honestly - the article page is the authority.
 */
export const NEWS_FEEDS = [
  { language: 'en', name: 'BBC News (World)', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { language: 'en', name: 'Deutsche Welle (English)', url: 'https://rss.dw.com/xml/rss-en-all' },
  { language: 'de', name: 'Deutsche Welle (Deutsch)', url: 'https://rss.dw.com/xml/rss-de-all' },
  { language: 'fr', name: 'France 24 (Français)', url: 'https://www.france24.com/fr/rss' },
  { language: 'es', name: 'Deutsche Welle (Español)', url: 'https://rss.dw.com/xml/rss-es-all' },
];

// ---------------------------------------------------------------- per-language registry
//
// Which source actually serves which language. Researched and live-verified
// 2026-11: Gutendex per-language counts probed directly (languages with 0
// books HANG the upstream for minutes, so Gutenberg is only OFFERED where a
// shelf exists); Wikisource editions from the wikisource.org portal list;
// Wikinews/Wikibooks from the Wikimedia project lists. Japanese gets Aozora
// Bunko as its primary source (Gutenberg's ja shelf is tiny; Aozora is the
// canonical Japanese free library). Korean has no big keyless corpus - the
// wiki family (Wikisource/Wikipedia/Wikibooks/Wikinews) is what exists.

/** Gutendex/Gutenberg languages with a real shelf (probe 2026-11; 'nb' maps
 *  to 'no'). Deliberately excludes single-book shelves like Korean. */
export const GUTENBERG_LANGUAGES = [
  'en', 'fr', 'es', 'pt', 'it', 'ca', 'de', 'nl', 'sv', 'da', 'nb', 'fi', 'is', 'pl',
  'cs', 'hu', 'ro', 'bg', 'ru', 'el', 'la', 'eo', 'cy', 'ga', 'af', 'tl', 'he', 'zh', 'ja',
];

/** Languages with their own Wikisource edition (per the wikisource.org portal,
 *  2026-11): effectively every language this app ships. */
export const WIKISOURCE_LANGUAGES = [
  'en', 'fr', 'es', 'pt', 'it', 'ca', 'de', 'nl', 'sv', 'da', 'nb', 'fi', 'is', 'pl', 'cs',
  'sk', 'hu', 'ro', 'bg', 'ru', 'uk', 'el', 'la', 'eo', 'tr', 'sq', 'lt', 'lv', 'et', 'cy',
  'ga', 'haw', 'af', 'id', 'ms', 'tl', 'sw', 'vi', 'ar', 'he', 'fa', 'ur', 'ps', 'hi', 'bn',
  'ta', 'te', 'kn', 'ml', 'th', 'lo', 'km', 'my', 'zh', 'ja', 'ko', 'tok',
];

/** Languages with a Wikinews edition (2026-11 project list). */
export const WIKINEWS_LANGUAGES = [
  'en', 'fr', 'es', 'pt', 'it', 'ca', 'de', 'nl', 'sv', 'nb', 'fi', 'pl', 'cs', 'ru', 'uk',
  'el', 'eo', 'tr', 'sq', 'ar', 'he', 'fa', 'zh', 'ja', 'ko', 'th', 'hu', 'ro', 'bg',
];

/** Languages with a Wikibooks edition (2026-11 project list). */
export const WIKIBOOKS_LANGUAGES = [
  'en', 'fr', 'es', 'pt', 'it', 'ca', 'de', 'nl', 'sv', 'da', 'nb', 'fi', 'is', 'pl', 'cs',
  'sk', 'hu', 'ro', 'bg', 'ru', 'uk', 'el', 'la', 'eo', 'tr', 'sq', 'lt', 'lv', 'et', 'cy',
  'ga', 'af', 'id', 'ms', 'tl', 'vi', 'ar', 'he', 'fa', 'ur', 'ps', 'hi', 'bn', 'ta', 'te',
  'kn', 'ml', 'th', 'zh', 'ja', 'ko',
];

/** Languages with a Wikipedia edition - every app language except Toki Pona
 *  (its Wikipedia was closed in 2005; texts in Toki Pona exist on Wikisource). */
export const WIKIPEDIA_LANGUAGES = [
  'en', 'fr', 'es', 'pt', 'it', 'ca', 'de', 'nl', 'sv', 'da', 'nb', 'fi', 'is', 'pl', 'cs',
  'sk', 'hu', 'ro', 'bg', 'ru', 'uk', 'el', 'la', 'eo', 'tr', 'sq', 'lt', 'lv', 'et', 'cy',
  'ga', 'haw', 'af', 'id', 'ms', 'tl', 'sw', 'vi', 'ar', 'he', 'fa', 'ur', 'ps', 'hi', 'bn',
  'ta', 'te', 'kn', 'ml', 'th', 'lo', 'km', 'my', 'zh', 'ja', 'ko',
];

/** The app's 56 languages (from the seed), used to sanity-check the registry. */
export const APP_LANGUAGES = [
  ...WIKISOURCE_LANGUAGES, 'tok',
];

// ---------------------------------------------------------------- aozora bunko

/**
 * Aozora Bunko (青空文庫): the canonical Japanese free library. There is no
 * keyless search API, so this is a curated shelf of 38 famous public-domain
 * works, built from the official list_person_all_extended_utf8.csv index
 * (downloaded 2026-11; every URL below is taken verbatim from it).
 * Fields: a=author directory, au=author, t=title, z=zip text file (without
 * .zip), h=HTML file (without .html), w=Aozora work id.
 */
export const AOZORA_WORKS = [
  { a: '000885', au: '与謝野晶子', t: 'みだれ髪', z: '51307_ruby_47032', h: '51307_47033', w: '051307' },
  { a: '000119', au: '中島敦', t: '山月記', z: '624_ruby_5668', h: '624_14544', w: '000624' },
  { a: '000038', au: '国木田独歩', t: '武蔵野', z: '329_ruby_5709', h: '329_15886', w: '000329' },
  { a: '001030', au: '堀辰雄', t: '風立ちぬ', z: '4803_ruby_14149', h: '4803_14204', w: '004803' },
  { a: '000148', au: '夏目漱石', t: '坊っちゃん', z: '752_ruby_2438', h: '752_14964', w: '000752' },
  { a: '000148', au: '夏目漱石', t: 'こころ', z: '773_ruby_5968', h: '773_14560', w: '000773' },
  { a: '000148', au: '夏目漱石', t: '草枕', z: '776_ruby_6020', h: '776_14941', w: '000776' },
  { a: '000148', au: '夏目漱石', t: '吾輩は猫である', z: '789_ruby_5639', h: '789_14547', w: '000789' },
  { a: '000035', au: '太宰治', t: '走れメロス', z: '1567_ruby_4948', h: '1567_14913', w: '001567' },
  { a: '000035', au: '太宰治', t: 'ヴィヨンの妻', z: '2253_ruby_1031', h: '2253_14908', w: '002253' },
  { a: '000035', au: '太宰治', t: '富嶽百景', z: '270_ruby_1164', h: '270_14914', w: '000270' },
  { a: '000081', au: '宮沢賢治', t: '注文の多い料理店', z: '43754_ruby_17594', h: '43754_17659', w: '043754' },
  { a: '000081', au: '宮沢賢治', t: 'よだかの星', z: '473_ruby_467', h: '473_42318', w: '000473' },
  { a: '000081', au: '宮沢賢治', t: '銀河鉄道の夜', z: '48222_ruby_59603', h: '48222_59645', w: '048222' },
  { a: '000158', au: '島崎藤村', t: '千曲川のスケッチ', z: '1503_ruby_6001', h: '1503_14594', w: '001503' },
  { a: '000121', au: '新美南吉', t: 'ごん狐', z: '628_ruby_649', h: '628_14895', w: '000628' },
  { a: '000025', au: '有島武郎', t: '一房の葡萄', z: '211_ruby_20471', h: '211_20472', w: '000211' },
  { a: '000074', au: '梶井基次郎', t: '檸檬', z: '46349_ruby_23599', h: '46349_23843', w: '046349' },
  { a: '000129', au: '森鴎外', t: '舞姫', z: '58126_ruby_73643', h: '58126_73682', w: '058126' },
  { a: '000329', au: '楠山正雄', t: '猿かに合戦', z: '18334_ruby_11929', h: '18334_11947', w: '018334' },
  { a: '000329', au: '楠山正雄', t: '桃太郎', z: '18376_ruby_12074', h: '18376_12100', w: '018376' },
  { a: '000329', au: '楠山正雄', t: 'かちかち山', z: '18377_ruby_11923', h: '18377_11982', w: '018377' },
  { a: '000329', au: '楠山正雄', t: '浦島太郎', z: '3390_ruby_6090', h: '3390_33153', w: '003390' },
  { a: '000329', au: '楠山正雄', t: '花咲かじじい', z: '3391_ruby', h: '3391', w: '003391' },
  { a: '001091', au: '楠山正雄', t: '赤ずきんちゃん', z: '42311_ruby_15515', h: '42311_15546', w: '042311' },
  { a: '001091', au: '楠山正雄', t: 'ブレーメンの町楽隊', z: '42314_ruby_15798', h: '42314_15929', w: '042314' },
  { a: '001091', au: '楠山正雄', t: 'ヘンゼルとグレーテル', z: '42315_ruby_15799', h: '42315_15931', w: '042315' },
  { a: '000019', au: '楠山正雄', t: '雪の女王', z: '42387_ruby_20531', h: '42387_20568', w: '042387' },
  { a: '000329', au: '楠山正雄', t: 'ジャックと豆の木', z: '43124_ruby_20869', h: '43124_21541', w: '043124' },
  { a: '000329', au: '楠山正雄', t: '一寸法師', z: '43457_ruby_23696', h: '43457_23938', w: '043457' },
  { a: '000050', au: '泉鏡花', t: '高野聖', z: '43466_ruby_25777', h: '43466_26099', w: '043466' },
  { a: '000050', au: '泉鏡花', t: '夜行巡査', z: '897_ruby_20741', h: '897_20742', w: '000897' },
  { a: '000153', au: '石川啄木', t: '一握の砂', z: '816_ruby_5621', h: '816_15786', w: '000816' },
  { a: '000879', au: '芥川竜之介', t: '羅生門', z: '128_ruby_2046', h: '128_15261', w: '000128' },
  { a: '000879', au: '芥川竜之介', t: '藪の中', z: '24454_ruby_46815', h: '24454_47036', w: '024454' },
  { a: '000879', au: '芥川竜之介', t: '鼻', z: '42_ruby_154', h: '42_15228', w: '000042' },
  { a: '000879', au: '芥川竜之介', t: '地獄変', z: '61_ruby_2706', h: '61_15130', w: '000061' },
  { a: '000879', au: '芥川竜之介', t: '蜘蛛の糸', z: '92_ruby_164', h: '92_14545', w: '000092' },
];

/** URL forms for an Aozora work, in try order:
 *  1. the official HTML edition (Shift-JIS, carries <ruby> furigana which
 *     survives as parenthetical annotations),
 *  2. the aozorahack.org unzipped-text mirror (Shift-JIS plain text),
 *  3. the official .zip of the plain text. */
export function aozoraUrls(work) {
  const dir = `cards/${work.a}/files`;
  return {
    html: `https://www.aozora.gr.jp/${dir}/${work.h}.html`,
    hack: `https://aozorahack.org/aozorabunko_text/${dir}/${work.z}/${work.z}.txt`,
    zip: `https://www.aozora.gr.jp/${dir}/${work.z}.zip`,
    card: `https://www.aozora.gr.jp/cards/${work.a}/card${work.w}.html`,
  };
}

/** ref form used by the catalog/import API: `${a}/${z}`. */
export const AOZORA_REF = (work) => `${work.a}/${work.z}`;
export const aozoraByRef = (ref) =>
  AOZORA_WORKS.find((w) => AOZORA_REF(w) === ref) ?? null;

/** Curated shelf as catalog items (pure; search filters it client-side of
 *  the network entirely). */
export function aozoraCatalogItems(query) {
  const q = String(query ?? '').trim().toLowerCase();
  return AOZORA_WORKS.filter(
    (w) =>
      !q ||
      w.t.toLowerCase().includes(q) ||
      w.au.toLowerCase().includes(q),
  ).map((w) => ({
    provider: 'aozora',
    ref: AOZORA_REF(w),
    title: w.t,
    author: w.au,
    language: 'ja',
    source_url: aozoraUrls(w).card,
    license: 'public-domain (per Aozora Bunko handling rules; each work page is authoritative)',
    description: null,
  }));
}

/** Minimal single-file zip reader (Aozora zips hold exactly one .txt).
 *  Parses the end-of-central-directory record, walks to the first central
 *  directory entry, then inflates the local entry - no dependency needed. */
export function unzipFirstEntry(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error('corrupt zip directory');
  const compression = buf.readUInt16LE(cdOffset + 10);
  const compSize = buf.readUInt32LE(cdOffset + 20);
  const localOffset = buf.readUInt32LE(cdOffset + 42);
  const nameLen = buf.readUInt16LE(localOffset + 26);
  const extraLen = buf.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + compSize);
  return compression === 8 ? inflateRawSync(data) : data;
}

/** Aozora plain-text (.txt from zip or mirror) -> reading text.
 *  Converts the 《reading》 ruby notation to the parenthetical annotation
 *  form the reader understands, drops the ｜ ruby-anchor markers and the
 *  symbol-legend / bibliographic header and footer lines. */
export function aozoraTxtToPlain(raw) {
  let s = String(raw ?? '');
  s = s.replace(/｜(?=[^\n])/g, '');
  s = s.replace(/([^\n「」（）])《([^《》\n]+)》/g, '$1（$2）');
  // The header block (title/author, then a ------- delimited symbol legend)
  // ends at the last separator line near the top; the work itself starts
  // right after it. Files without the legend keep everything.
  const lines = s.split(/\r?\n/);
  const separators = [];
  for (let i = 0; i < Math.min(40, lines.length); i += 1) {
    if (/^[-]{10,}$/.test(lines[i].trim())) separators.push(i);
  }
  const cut = separators.length >= 2 ? separators[separators.length - 1] + 1 : 0;
  const legend = [
    /^[-]{10,}$/,
    /^【テキスト中に現れる記号について】/,
    /^《》：?ルビ/,
    /^（例）/,
    /^［＃.{0,120}］/,
    /^＃[^：]{0,10}：/,
    /^底本[:：]/,
    /^入力[:：]/,
    /^校正[:：]/,
    /^［＃底本/,
  ];
  s = lines
    .slice(cut)
    .filter((line) => !legend.some((re) => re.test(line.trim())))
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

/** Aozora HTML edition -> reading text. Extracts the main_text div (standard
 *  Aozora layout; greedy match because it may contain nested divs), lets
 *  htmlToText turn <ruby> into parenthetical furigana annotations, then cuts
 *  the bibliographic footer that follows the work text. */
export function aozoraHtmlToText(html) {
  const s = String(html ?? '');
  const m = s.match(/<div[^>]*class="main_text"[^>]*>([\s\S]*)<\/div>/i);
  let text = htmlToText(m ? m[1] : s);
  const footer = text.search(/^底本[:：]/m);
  if (footer > 0) text = text.slice(0, footer);
  return text.trim();
}

/** Fetch an Aozora work's text: HTML first (furigana preserved), then the
 *  plain-text mirror, then the official zip. All routes are Shift-JIS.
 *  Returns { text, route } . */
export async function fetchAozoraText(work, fetchers = {}) {
  const urls = aozoraUrls(work);
  const fetchBytes = fetchers.fetchBytes ?? defaultFetchBytes;
  const attempts = [
    { route: 'html', url: urls.html, decode: aozoraHtmlToText, timeoutMs: 20000 },
    { route: 'txt', url: urls.hack, decode: aozoraTxtToPlain, timeoutMs: 15000 },
    { route: 'zip', url: urls.zip, decode: (buf) => aozoraTxtToPlain(unzipFirstEntry(buf)), timeoutMs: 20000 },
  ];
  let lastError = null;
  for (const att of attempts) {
    try {
      const buf = await fetchBytes(att.url, att.timeoutMs);
      const decoded = new TextDecoder('shift_jis').decode(buf);
      const text = att.decode(decoded);
      if (text && text.trim().length > 200) return { text, route: att.route };
      lastError = new Error('no usable text from ' + att.route);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('aozora fetch failed');
}

async function defaultFetchBytes(url, timeoutMs) {
  const res = await safeFetch(url, { timeoutMs, maxBytes: 2 * 1024 * 1024 });
  if (!res.ok) throw new Error(`source responded ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- provider meta

export const PROVIDERS = {
  aozora: {
    label: 'Aozora Bunko (青空文庫)',
    blurb: 'The canonical Japanese free library - a curated shelf of famous public-domain works, furigana included.',
    languages: ['ja'],
    priority: 0,
  },
  gutenberg: {
    label: 'Project Gutenberg',
    blurb: 'Public-domain books in many languages (via the Gutendex catalogue).',
    languages: GUTENBERG_LANGUAGES,
    priority: 1,
  },
  wikisource: {
    label: 'Wikisource',
    blurb: 'Public-domain and freely licensed source texts (license varies per work - check its page).',
    languages: WIKISOURCE_LANGUAGES,
    priority: 2,
  },
  wikipedia: {
    label: 'Wikipedia',
    blurb: 'Encyclopedia articles (CC BY-SA; attribution to the contributors).',
    languages: WIKIPEDIA_LANGUAGES,
    priority: 3,
  },
  wikibooks: {
    label: 'Wikibooks',
    blurb: 'Open textbooks and manuals - structured learning material (CC BY-SA; attribution to the contributors).',
    languages: WIKIBOOKS_LANGUAGES,
    priority: 4,
  },
  wikinews: {
    label: 'Wikinews',
    blurb: 'Community news reports in many languages (CC BY 2.5).',
    languages: WIKINEWS_LANGUAGES,
    priority: 5,
  },
  news: {
    label: 'News feeds',
    blurb: 'Curated stable RSS feeds (BBC, DW, France 24). Article pages are the licensing authority.',
    languages: ['en', 'de', 'fr', 'es'],
    priority: 6,
  },
};

/** Providers that serve a language, in recommended order. */
export function providersForLanguage(language) {
  return Object.entries(PROVIDERS)
    .filter(([, meta]) => (meta.languages ?? []).includes(language))
    .map(([id, meta]) => ({ id, ...meta, languages: undefined }))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

// ---------------------------------------------------------------- memo cache

/**
 * Tiny TTL memo cache for the catalog: Netlify function instances are reused
 * across requests, so a hot language shelf answers instantly instead of
 * hammering rate-limited upstreams (Gutendex throttles bursts; probed 2026-11).
 */
const MEMO = new Map();
export async function memoJson(key, ttlMs, fetcher) {
  const hit = MEMO.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fetcher();
  MEMO.set(key, { value, expires: Date.now() + ttlMs });
  if (MEMO.size > 200) {
    for (const [k, v] of MEMO) {
      if (v.expires < Date.now()) MEMO.delete(k);
    }
  }
  return value;
}
