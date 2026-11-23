/**
 * Open content sources for the import pipeline and the word-lookup chain.
 *
 * Everything here is keyless, free, and honestly attributed:
 *   - Project Gutenberg via Gutendex (public-domain books)
 *   - Wikisource / Wikipedia / Wikinews via the standard MediaWiki API
 *     (Wikinews CC BY 2.5; Wikipedia CC BY-SA; Wikisource varies per work)
 *   - a small curated list of stable news RSS feeds
 *   - Wiktionary REST definitions (CC BY-SA) + dictionaryapi.dev (English)
 *
 * This module is PURE where possible (mappers and parsers take strings) so it
 * is unit-tested without network access. The fetch helpers carry the SSRF
 * guard every server-side fetch must pass.
 */

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
export async function safeFetch(rawUrl, { timeoutMs = 20000, maxBytes = 8 * 1024 * 1024, maxRedirects = 3 } = {}) {
  let url = ssrfSafeUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Linguarium/0.1 (language-learning reading app)' },
      signal: AbortSignal.timeout(timeoutMs),
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
    let base = inner.replace(/<rt[\s\S]*?<\/rt\s*>/gi, '').replace(/<[^>]+>/g, '');
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

export const GUTENDEX_SEARCH_URL = (q, language) => {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set('search', q.trim().slice(0, 200));
  if (language && language !== 'en') params.set('languages', language);
  return `https://gutendex.com/books?${params.toString()}`;
};

export const GUTENBERG_TEXT_URLS = (id) => [
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
];

// ---------------------------------------------------------------- mediawiki

export const MW_SEARCH_URL = (project, lang, q) => {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: q.slice(0, 200),
    srlimit: '20',
    format: 'json',
  });
  return `https://${lang}.${project}.org/w/api.php?${params.toString()}`;
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
    source_url: `https://${lang}.${project}.org/wiki/${encodeURIComponent(String(h.title).replace(/ /g, '_'))}`,
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
  return `https://${lang}.${project}.org/w/api.php?${params.toString()}`;
};

export const MW_PARSE_URL = (project, lang, title) => {
  const params = new URLSearchParams({
    action: 'parse',
    page: title.slice(0, 300),
    prop: 'text',
    format: 'json',
  });
  return `https://${lang}.${project}.org/w/api.php?${params.toString()}`;
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

// ---------------------------------------------------------------- provider meta

export const PROVIDERS = {
  gutenberg: {
    label: 'Project Gutenberg',
    blurb: 'Public-domain books in many languages (via the Gutendex catalogue).',
  },
  wikisource: {
    label: 'Wikisource',
    blurb: 'Public-domain and freely licensed source texts (license varies per work - check its page).',
  },
  wikipedia: {
    label: 'Wikipedia',
    blurb: 'Encyclopedia articles (CC BY-SA; attribution to the contributors).',
  },
  wikinews: {
    label: 'Wikinews',
    blurb: 'Community news reports in many languages (CC BY 2.5).',
  },
  news: {
    label: 'News feeds',
    blurb: 'Curated stable RSS feeds (BBC, DW, France 24). Article pages are the licensing authority.',
  },
};
