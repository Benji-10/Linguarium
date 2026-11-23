/**
 * POST /api/import-source - fetch texts from the open sources and import them.
 *
 * Two modes:
 *
 *   { mode: 'url', url, language_code }
 *     Fetches the page server-side (SSRF-guarded), extracts the reading text
 *     (ruby-aware: NHK-Easy-style furigana is preserved as annotations) and
 *     returns a PREVIEW { title, text, final_url } - the client shows it with
 *     the metadata form so the user asserts source/license themselves before
 *     the text is saved through POST /api/texts. Nothing is stored here.
 *
 *   { mode: 'provider', provider, ref, language_code }
 *     Full import from a catalog item (gutenberg | wikisource | wikipedia |
 *     wikinews): fetches the text, attaches the source's own metadata
 *     (author, source URL, license) and stores it as a user text with
 *     provenance 'user-imported'. Gutenberg books longer than the import cap
 *     are cut at a sentence boundary and say so in the adaptation note -
 *     nothing is silently truncated.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow, languageFor } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import {
  fetchText,
  fetchTextCapped,
  fetchJsonRetry,
  htmlToText,
  htmlTitle,
  GUTENBERG_TEXT_URLS,
  GUTENDEX_BOOK_URL,
  MW_EXTRACT_URL,
  MW_PARSE_URL,
  extractFromMwExtracts,
  extractFromMwParse,
} from './lib/sources.mjs';

const MAX_BODY_CHARS = 200000;
// The mirror is slow but reliable (~30 KB/s observed); the main site refuses
// datacenter traffic with an instant 503. Each candidate gets a timeout
// that fits the TOTAL function budget (~28 s worst case).
const GUTENBERG_CANDIDATE_TIMEOUTS = [24000, 8000, 8000];
const GUTENBERG_BYTE_CAP = 700 * 1024; // > the 200k-char import cut for every script
const TEXT_PROVIDERS = new Set(['gutenberg', 'wikisource', 'wikipedia', 'wikinews']);

const PROVIDER_META = {
  gutenberg: {
    license: 'public-domain',
    authorOf: (meta) => meta?.author ?? null,
    pageUrl: (ref) => `https://www.gutenberg.org/ebooks/${ref}`,
    note: 'Public-domain book fetched from the Project Gutenberg text archive.',
  },
  wikisource: {
    license: 'unspecified (varies per work - check the work page)',
    authorOf: () => null,
    pageUrl: (language, ref) => `https://${language}.wikisource.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Source text from Wikisource. The license varies per work - open the source page and correct the license/author if needed.',
  },
  wikipedia: {
    license: 'cc-by-sa-4.0',
    authorOf: () => 'Wikipedia contributors',
    pageUrl: (language, ref) => `https://${language}.wikipedia.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Wikipedia article text (CC BY-SA 4.0, attribution: Wikipedia contributors).',
  },
  wikinews: {
    license: 'cc-by-2.5',
    authorOf: () => 'Wikinews contributors',
    pageUrl: (language, ref) => `https://${language}.wikinews.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Wikinews article text (CC BY 2.5, attribution: Wikinews contributors).',
  },
};

/** Cut at a sentence boundary near the cap; return {text, truncated}. */
function cutAtSentence(text, cap) {
  if (text.length <= cap) return { text, truncated: false };
  const slice = text.slice(0, cap);
  const cut = Math.max(
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
  );
  const end = cut > cap * 0.5 ? cut + 1 : cap;
  return { text: slice.slice(0, end).trim(), truncated: true };
}

async function fetchUrlPreview(rawUrl) {
  const res = await fetchText(rawUrl, { timeoutMs: 25000, maxBytes: 5 * 1024 * 1024 });
  let text;
  let title = null;
  const raw = typeof res === 'string' ? res : '';
  const looksHtml = /<\/?(html|body|div|p|br|article|h1)\b/i.test(raw.slice(0, 4000));
  if (looksHtml) {
    title = htmlTitle(raw);
    text = htmlToText(raw);
  } else {
    text = raw.trim();
  }
  if (text.length < 60) {
    throw new HttpError(
      422,
      'not-readable',
      'That page did not yield readable text (heavy JavaScript rendering or a non-HTML content type). Try another page or paste the text directly.',
    );
  }
  const { text: cut, truncated } = cutAtSentence(text, MAX_BODY_CHARS);
  return { title, text: cut, truncated };
}

/** Gutenberg book body. Candidates in order (mirror first - it works from
 *  datacenter IPs, gutenberg.org 503-throttles them), streaming with a byte
 *  cap so multi-megabyte books stop downloading at the import limit.
 *  Returns { body, byteCapped } so the caller can report it honestly. */
async function fetchGutenbergBody(bookId) {
  const urls = GUTENBERG_TEXT_URLS(bookId);
  let lastError = null;
  for (let i = 0; i < urls.length; i += 1) {
    try {
      const { text, capped } = await fetchTextCapped(urls[i], {
        timeoutMs: GUTENBERG_CANDIDATE_TIMEOUTS[i] ?? 8000,
        maxBytes: GUTENBERG_BYTE_CAP,
      });
      if (text && text.trim().length > 200) return { body: text, byteCapped: capped };
      lastError = new Error('source returned no usable text');
    } catch (err) {
      lastError = err;
    }
  }
  throw new HttpError(
    502,
    'source-unreachable',
    `The book text could not be fetched from Project Gutenberg or its mirror. ${lastError?.message ?? ''}`,
  );
}

async function fetchWikiPage(project, language, title) {
  // Plain extract first; Wikisource pages sometimes need the HTML route.
  try {
    const data = await fetchJson(MW_EXTRACT_URL(project, language, title), { timeoutMs: 25000 });
    const extract = extractFromMwExtracts(data);
    if (extract && extract.trim().length > 0) return extract.trim();
  } catch {
    /* fall through to the parse route */
  }
  try {
    const data = await fetchJson(MW_PARSE_URL(project, language, title), { timeoutMs: 25000 });
    const parsed = extractFromMwParse(data);
    if (parsed && parsed.trim().length > 0) return parsed.trim();
  } catch {
    /* both routes failed */
  }
  throw new HttpError(502, 'source-unreachable', 'That page exists but its text could not be extracted from the wiki API.');
}

export default handler({
  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);
    const mode = requireString(data, 'mode', { max: 16 });
    const languageCode = requireString(data, 'language_code', { max: 16 });

    const language = await languageFor(languageCode);
    if (!language) throw new HttpError(404, 'language-not-found', 'Unknown language code.');

    // ---- URL preview mode: fetch and return, store nothing.
    if (mode === 'url') {
      const rawUrl = requireString(data, 'url', { max: 1000 });
      let preview;
      try {
        preview = await fetchUrlPreview(rawUrl);
      } catch (err) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(502, 'source-unreachable', `That URL could not be fetched (${err.message}).`);
      }
      return json({
        mode: 'url',
        language_code: languageCode,
        title: preview.title,
        text: preview.text,
        truncated: preview.truncated,
        truncated_note: preview.truncated
          ? `Only the first ${MAX_BODY_CHARS} characters (cut at a sentence boundary) are shown - the source page is longer.`
          : null,
      });
    }

    // ---- Provider import mode: fetch and store as a user text.
    if (mode === 'provider') {
      const provider = requireString(data, 'provider', { max: 16 });
      const ref = requireString(data, 'ref', { max: 300 });
      if (!TEXT_PROVIDERS.has(provider)) {
        throw new HttpError(400, 'invalid-provider', `Provider must be one of ${[...TEXT_PROVIDERS].join(', ')}.`);
      }

      let body;
      let author = null;
      let license;
      let sourceUrl;
      let note;
      let byteCapped = false;
      let title = ref;

      if (provider === 'gutenberg') {
        if (!/^\d+$/.test(ref)) throw new HttpError(400, 'invalid-ref', 'Gutenberg refs are numeric book ids.');
        let meta = null;
        try {
          meta = await fetchJsonRetry(GUTENDEX_BOOK_URL(ref), { timeoutMs: 10000 });
        } catch {
          /* metadata is best-effort; the text fetch below decides */
        }
        const fetched = await fetchGutenbergBody(ref);
        body = fetched.body;
        byteCapped = fetched.byteCapped;
        const meta2 = PROVIDER_META.gutenberg;
        author = meta.author ?? meta2.authorOf(meta);
        license = meta2.license;
        sourceUrl = meta2.pageUrl(ref);
        note = meta2.note;
        title = meta?.title ?? `Gutenberg book ${ref}`;
      } else {
        const project = provider; // wikisource | wikipedia | wikinews
        body = await fetchWikiPage(project, languageCode, ref);
        const meta = PROVIDER_META[provider];
        author = meta.authorOf();
        license = meta.license;
        sourceUrl = meta.pageUrl(languageCode, ref);
        note = meta.note;
        title = ref;
      }

      const { text: cut, truncated } = cutAtSentence(body, MAX_BODY_CHARS);
      if (cut.trim().length < 20) {
        throw new HttpError(422, 'not-readable', 'The source returned no usable text.');
      }
      const truncatedByBytes = byteCapped && cut.length < MAX_BODY_CHARS;
      const adaptationNote = truncated
        ? `${note} Only the first ${MAX_BODY_CHARS} characters (cut at a sentence boundary) were imported - the source is longer.`
        : truncatedByBytes
          ? `${note} The download stopped at the import byte limit, so only about the first ${MAX_BODY_CHARS} characters are here - the source is longer.`
          : note;

      const rows = await sql()`
        INSERT INTO user_data.texts
          (user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance)
        VALUES
          (${user.id}, ${languageCode}, ${String(title).slice(0, 300)}, ${cut},
           ${author}, ${sourceUrl}, ${license}, ${adaptationNote}, 'user-imported')
        RETURNING id, user_id, language_code, title, author, source_url, license, adaptation_note, provenance, topic, created_at, updated_at`;
      return json({ text: rows[0], truncated: truncated || truncatedByBytes }, 201);
    }

    throw new HttpError(400, 'invalid-mode', 'Field "mode" must be "url" or "provider".');
  },
});

export const config = { path: '/api/import-source' };
