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
 *   { mode: 'provider', provider, ref, language_code, wiki? }
 *     Full import from a catalog item (aozora | gutenberg | classics |
 *     wikisource | wikipedia | wikibooks | wikinews | wikivoyage): fetches the text, attaches the
 *     source's own metadata
 *     (author, source URL, license) and stores it as a user text with
 *     provenance 'user-imported'. Gutenberg books longer than the import cap
 *     are cut at a sentence boundary and say so in the adaptation note -
 *     nothing is silently truncated. Aozora works arrive via the official
 *     HTML edition (furigana kept as ruby annotations) with the aozorahack.org
 *     mirror and the official .zip as fallbacks, all decoded from Shift-JIS.
 *     Gutenberg metadata (title/author) comes from the committed catalogue
 *     snapshot, so an import never depends on the flaky live Gutendex API;
 *     the classics shelf fetches the exact verified page from the language's
 *     own Wikisource edition through the normal wiki pipeline.
 *     The optional `wiki` field is the wiki EDITION code the item was found
 *     on ("mi" for mi.wikipedia.org): the custom-edition bridge stamps it on
 *     catalog items whose edition differs from the saved language, so the
 *     import reads exactly the page the user saw.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow, languageFor } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { gutenbergBook } from './lib/gutenberg-shelves.mjs';
import {
  fetchText,
  fetchTextCapped,
  fetchJson,
  fetchJsonRetry,
  htmlToText,
  htmlTitle,
  aozoraByRef,
  aozoraUrls,
  fetchAozoraText,
  classicsByRef,
  validWikiCode,
  fetchWikiJson,
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
const TEXT_PROVIDERS = new Set(['gutenberg', 'classics', 'wikisource', 'wikipedia', 'wikibooks', 'wikinews', 'wikivoyage', 'aozora']);

const PROVIDER_META = {
  aozora: {
    license: 'public-domain (per Aozora Bunko handling rules; the work page is authoritative)',
    note: 'Text from Aozora Bunko (青空文庫), the Japanese free library. Furigana readings from the work itself are preserved as ruby annotations.',
  },
  gutenberg: {
    license: 'public-domain',
    // Live Gutendex returns { authors: [{ name, ... }], ... } - anonymous
    // works (author: null / empty array) must not crash the import; they fall
    // back to an honest "Unknown author". Used only when the committed
    // catalogue snapshot does not know the id (books beyond its 20,000
    // English cap found through the live search supplement).
    authorOf: (meta) =>
      (Array.isArray(meta?.authors) ? meta.authors.map((a) => a?.name).filter(Boolean).join(', ') : '') || null,
    pageUrl: (ref) => `https://www.gutenberg.org/ebooks/${ref}`,
    note: 'Public-domain book fetched from the Project Gutenberg text archive.',
  },
  classics: {
    license: 'unspecified (varies per work - check the work page)',
    authorOf: (meta) => meta?.author ?? null,
    pageUrl: (language, ref) => `https://${language}.wikisource.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Text from the curated classic literature shelf, hosted on the language own Wikisource edition - the license varies per work; open the source page and correct the license/author if needed.',
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
  wikibooks: {
    license: 'cc-by-sa-4.0',
    authorOf: () => 'Wikibooks contributors',
    pageUrl: (language, ref) => `https://${language}.wikibooks.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Textbook page from Wikibooks (CC BY-SA 4.0, attribution: Wikibooks contributors).',
  },
  wikinews: {
    license: 'cc-by-2.5',
    authorOf: () => 'Wikinews contributors',
    pageUrl: (language, ref) => `https://${language}.wikinews.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Wikinews article text (CC BY 2.5, attribution: Wikinews contributors).',
  },
  wikivoyage: {
    license: 'cc-by-sa-4.0',
    authorOf: () => 'Wikivoyage contributors',
    pageUrl: (language, ref) => `https://${language}.wikivoyage.org/wiki/${encodeURIComponent(ref)}`,
    note: 'Travel guide page from Wikivoyage (CC BY-SA 4.0, attribution: Wikivoyage contributors).',
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
  // Both via fetchWikiJson: HTTP/2 first, because the Wikimedia CDN
  // 403-refuses plain HTTP/1.1 from whole datacenter ranges.
  try {
    const data = await fetchWikiJson(MW_EXTRACT_URL(project, language, title), { timeoutMs: 25000 });
    const extract = extractFromMwExtracts(data);
    if (extract && extract.trim().length > 0) return extract.trim();
  } catch {
    /* fall through to the parse route */
  }
  try {
    const data = await fetchWikiJson(MW_PARSE_URL(project, language, title), { timeoutMs: 25000 });
    const parsed = extractFromMwParse(data);
    if (parsed && parsed.trim().length > 0) return parsed.trim();
  } catch {
    /* both routes failed */
  }
  throw new HttpError(502, 'source-unreachable', 'That page exists but its text could not be extracted from the wiki API.');
}

/** Aozora Bunko import: resolve the curated work by ref, fetch via the three
 *  routes (official HTML with furigana -> plain-text mirror -> official zip),
 *  decode Shift-JIS. Returns { body, author, sourceUrl, note }. */
async function fetchAozoraWork(ref, languageCode) {
  if (languageCode !== 'ja') {
    throw new HttpError(400, 'not-for-language', 'Aozora Bunko serves Japanese only.');
  }
  const work = aozoraByRef(ref);
  if (!work) {
    throw new HttpError(400, 'invalid-ref', 'Unknown Aozora work (the curated shelf in the catalog is the source of truth).');
  }
  const urls = aozoraUrls(work);
  let fetched;
  try {
    fetched = await fetchAozoraText(work);
  } catch (err) {
    throw new HttpError(
      502,
      'source-unreachable',
      `The work could not be fetched from Aozora Bunko or its mirror. ${err?.message ?? ''}`,
    );
  }
  return {
    body: fetched.text,
    author: work.au,
    sourceUrl: urls.card,
    note: `${PROVIDER_META.aozora.note} Fetched from the ${fetched.route === 'html' ? 'official HTML edition' : fetched.route === 'txt' ? 'aozorahack.org text mirror' : 'official text archive'}.`,
  };
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
        // Metadata from the committed catalogue snapshot first: instant,
        // offline, and immune to the Gutendex outages that used to land books
        // as "Gutenberg book 78105, Unknown author". The live API is only
        // consulted for ids the snapshot does not carry (recent uploads found
        // through the live search supplement) and its failure is harmless.
        const snap = gutenbergBook(ref);
        let meta = null;
        if (!snap) {
          try {
            meta = await fetchJsonRetry(GUTENDEX_BOOK_URL(ref), { timeoutMs: 9000 });
          } catch {
            /* best-effort only; the text fetch below decides */
          }
        }
        const fetched = await fetchGutenbergBody(ref);
        body = fetched.body;
        byteCapped = fetched.byteCapped;
        const meta2 = PROVIDER_META.gutenberg;
        // `meta` can still be null (snapshot miss + live API slow) or an
        // object with an empty authors array (anonymous works): every access
        // is guarded and the fallback is an honest "Unknown author".
        author = snap?.author || meta2.authorOf(meta) || 'Unknown author';
        license = meta2.license;
        sourceUrl = meta2.pageUrl(ref);
        note = snap
          ? `${meta2.note} Title and author from the bundled catalogue snapshot.`
          : meta2.note;
        title = snap?.title ?? meta?.title ?? `Gutenberg book ${ref}`;
      } else if (provider === 'classics') {
        // Curated classic literature: the ref names the exact Wikisource page
        // that was verified to carry the text. It is fetched through the
        // normal wikisource pipeline; the curated entry supplies the display
        // title and author.
        const work = classicsByRef(languageCode, ref);
        if (!work) {
          throw new HttpError(400, 'invalid-ref', 'Unknown classics entry (the curated shelf in the catalog is the source of truth).');
        }
        if (validWikiCode(data.wiki) && validWikiCode(data.wiki) !== languageCode) {
          throw new HttpError(400, 'invalid-wiki-code', 'Classic literature is fixed to the work own language edition - the wiki code cannot be overridden here.');
        }
        body = await fetchWikiPage('wikisource', languageCode, work.ref);
        const meta = PROVIDER_META.classics;
        author = work.au;
        license = meta.license;
        sourceUrl = meta.pageUrl(languageCode, work.ref);
        note = meta.note;
        title = work.t;
      } else if (provider === 'aozora') {
        const fetched = await fetchAozoraWork(ref, languageCode);
        body = fetched.body;
        author = fetched.author;
        license = PROVIDER_META.aozora.license;
        sourceUrl = fetched.sourceUrl;
        note = fetched.note;
        title = aozoraByRef(ref)?.t ?? ref;
      } else {
        const project = provider; // wikisource | wikipedia | wikibooks | wikinews | wikivoyage
        // Wiki edition to fetch from, in priority order: the edition the
        // catalog stamped on this item (the browsed edition), then the
        // SOURCE EDITION the user defined once in Settings for a custom
        // language, then the language's own code (the historical default).
        const edition = validWikiCode(data.wiki) ?? validWikiCode(language.source_edition) ?? languageCode;
        if (data.wiki != null && data.wiki !== '' && edition !== data.wiki) {
          throw new HttpError(400, 'invalid-wiki-code', 'The wiki edition code looks invalid - use a plain code like "mi" or "simple".');
        }
        body = await fetchWikiPage(project, edition, ref);
        const meta = PROVIDER_META[provider];
        author = meta.authorOf();
        license = meta.license;
        sourceUrl = meta.pageUrl(edition, ref);
        note =
          edition !== languageCode
            ? `${meta.note} Imported from the ${edition} edition; saved under your active language.`
            : meta.note;
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
