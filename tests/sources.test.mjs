/**
 * Source library tests: the pure mappers/parsers behind /api/catalog,
 * /api/import-source and /api/lookup (no network access needed).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  ssrfSafeUrl,
  safeFetch,
  htmlToText,
  htmlTitle,
  mapWiktionaryDefinitions,
  mapWiktionaryWikitext,
  mapWiktionaryParseHtml,
  mapFreeDictionaryApi,
  mapGutendex,
  mapMediawikiSearch,
  extractFromMwExtracts,
  extractFromMwParse,
  parseRss,
  GUTENDEX_BROWSE_URL,
  GUTENDEX_SEARCH_URL,
  GUTENBERG_TEXT_URLS,
  gutendexPageInfo,
  providersForLanguage,
  GUTENBERG_LANGUAGES,
  WIKISOURCE_LANGUAGES,
  APP_LANGUAGES,
  MW_HOST,
  MW_SEARCH_URL,
  MW_EXTRACT_URL,
  validWikiCode,
  aozoraCatalogItems,
  aozoraByRef,
  AOZORA_REF,
  aozoraTxtToPlain,
  aozoraHtmlToText,
  aozoraUrls,
  unzipFirstEntry,
  memoJson,
  memoJsonStale,
  NEWS_FEEDS,
  PROVIDERS,
  WIKIVOYAGE_LANGUAGES,
} from '../netlify/functions/lib/sources.mjs';

test('ssrf guard blocks private and odd targets', () => {
  for (const bad of [
    'http://localhost/x',
    'http://127.0.0.1/x',
    'http://10.0.0.1/x',
    'http://192.168.1.1/x',
    'http://172.16.0.1/x',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/x',
    'file:///etc/passwd',
    'ftp://example.com/f',
    'http://user:pass@example.com/',
    'http://example.com:8080/x',
    'not a url',
  ]) {
    assert.throws(() => ssrfSafeUrl(bad), undefined, `should reject ${bad}`);
  }
  for (const ok of ['https://www.gutenberg.org/cache/epub/1/pg1.txt', 'https://ja.wikipedia.org/wiki/x', 'http://example.com/']) {
    assert.ok(ssrfSafeUrl(ok) instanceof URL, `should allow ${ok}`);
  }
});

test('htmlToText strips markup, keeps line structure, decodes entities', () => {
  const html = `<html><head><title>T</title><style>.x{}</style></head><body>
    <nav>menu junk</nav>
    <article><h1>One</h1><p>First &amp; para.</p><p>Second&nbsp;para.</p></article>
    <footer>foot junk</footer></body></html>`;
  const text = htmlToText(html);
  assert.equal(text.includes('menu junk'), false);
  assert.equal(text.includes('foot junk'), false);
  assert.ok(text.includes('First & para.'));
  assert.ok(text.includes('Second para.'));
  assert.ok(text.includes('\n'));
});

test('htmlToText preserves furigana ruby as parenthetical annotations', () => {
  const html = '<p><ruby>漢字<rt>かんじ</rt></ruby>を勉強します。</p>';
  const text = htmlToText(html);
  assert.equal(text, '漢字（かんじ）を勉強します。');
});

test('htmlTitle extracts and cleans the title', () => {
  assert.equal(htmlTitle('<title>Hello &amp; Welcome</title>'), 'Hello & Welcome');
  assert.equal(htmlTitle('<html><body>no title</body></html>'), null);
});

test('wiktionary definitions are mapped for the matching language only', () => {
  const json = [
    { language: 'Latin', language_code: 'la', part_of_speech: 'noun', definitions: [{ definition: 'Latin entry - must be skipped' }] },
    {
      language: 'Japanese',
      language_code: 'ja',
      part_of_speech: 'noun',
      definitions: [{ definition: 'a <i>cat</i>', examples: ['猫が鳴いた。'] }],
    },
  ];
  const out = mapWiktionaryDefinitions(json, 'ja', 'Japanese');
  assert.equal(out.length, 1);
  assert.equal(out[0].definition, 'a cat');
  assert.deepEqual(out[0].examples, ['猫が鳴いた。']);
});

test('wiktionary REST definitions: the live object shape is flattened (the neck/sibling root cause)', () => {
  // The REST endpoint returns {"en": [...]} keyed by language code with
  // camelCase fields - the old mapper only accepted the bare array, so an
  // ANSWERING endpoint still produced zero entries (and blocked the parse
  // fallback). This is the actual "dictionary finds nothing" bug.
  const json = {
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        languageCode: 'en',
        definitions: [{ definition: 'The part of the body connecting the head and the trunk.' }],
      },
    ],
    la: [
      { partOfSpeech: 'Noun', language: 'Latin', languageCode: 'la', definitions: [{ definition: 'colum' }] },
    ],
  };
  const out = mapWiktionaryDefinitions(json, 'en', 'English');
  assert.equal(out.length, 1);
  assert.equal(out[0].part_of_speech, 'Noun');
  assert.equal(out[0].definition, 'The part of the body connecting the head and the trunk.');
  // Latin section skipped for English lookups
  assert.equal(mapWiktionaryDefinitions(json, 'la', 'Latin').length, 1);
  assert.equal(mapWiktionaryDefinitions({ foo: 'not-an-array' }, 'en', 'English').length, 0);
});

test('wiktionary language matching works via the language name too', () => {
  const json = [{ language: 'Chinese', part_of_speech: 'noun', definitions: [{ definition: 'Chinese entry' }] }];
  const out = mapWiktionaryDefinitions(json, 'zh', 'Chinese');
  assert.equal(out.length, 1);
  assert.equal(out[0].definition, 'Chinese entry');
});

test('wiktionary wikitext parser: senses, labels, links, ux examples (the neck/sibling fix)', () => {
  const wikitext = [
    '==English==',
    '===Etymology 1===',
    'From Middle English.',
    '====Noun====',
    '# {{lb|en|anatomy}} The part of the body connecting the [[head]] and the trunk.',
    '#* {{ux|en|The cat slept on the neck of the bottle.}}',
    "# The part of a shirt which fits a person's neck.",
    '====Synonyms====',
    '* {{l|en|collar}}',
    '===Pronunciation===',
    '#: this is a usage note, not a sense',
    '==French==',
    '===Noun===',
    '# {{lb|fr|anatomy}} neck',
    "#* ''Il a mal au cou.''",
  ].join('\n');

  const en = mapWiktionaryWikitext(wikitext, 'en', 'English');
  assert.equal(en.length, 2);
  assert.equal(en[0].part_of_speech, 'noun'); // h4 POS inside the etymology
  assert.equal(en[0].definition, '(anatomy) The part of the body connecting the head and the trunk.');
  assert.deepEqual(en[0].examples, ['The cat slept on the neck of the bottle.']);
  assert.equal(en[1].definition, "The part of a shirt which fits a person's neck.");

  // Only the French section for French; the synonym line ('* {{l|...}}') and
  // the usage note ('#:') are not senses.
  const fr = mapWiktionaryWikitext(wikitext, 'fr', 'French');
  assert.equal(fr.length, 1);
  assert.equal(fr[0].definition, '(anatomy) neck');
  assert.deepEqual(fr[0].examples, ['Il a mal au cou.']);

  // Unknown language yields nothing, never a crash.
  assert.deepEqual(mapWiktionaryWikitext(wikitext, 'de', 'German'), []);
  assert.deepEqual(mapWiktionaryWikitext('', 'en', 'English'), []);
  assert.deepEqual(mapWiktionaryWikitext(undefined, 'en', 'English'), []);
});

test('wiktionary wikitext parser: Japanese headword templates carry the kana reading', () => {
  const wikitext = ['==Japanese==', '===Noun===', '{{ja-noun|くび|hhira=くび}}', '# {{lb|ja|anatomy}} neck'].join('\n');
  const ja = mapWiktionaryWikitext(wikitext, 'ja', 'Japanese');
  assert.equal(ja.length, 1);
  assert.equal(ja[0].reading, 'くび'); // lights up furigana in the reader
  assert.equal(ja[0].definition, '(anatomy) neck');
});

test('wiktionary parse-HTML parser never crashes on li items without nested lists', () => {
  // Regression: the gateway/Parsoid HTML shape - a bare <li> with no nested
  // list used to crash mapWiktionaryParseHtml (split()[1] was undefined).
  const html = [
    '<h2><span>English</span></h2>',
    '<h3><span>Noun</span></h3>',
    '<ol><li>A bare sense with no nested anything.</li></ol>',
  ].join('');
  const out = mapWiktionaryParseHtml(html, 'en', 'English');
  assert.equal(out.length, 1);
  assert.equal(out[0].definition, 'A bare sense with no nested anything.');
  assert.deepEqual(out[0].examples, []);
});

test('free dictionary api entries are mapped with phonetics', () => {
  const json = [
    {
      phonetic: '/kæt/',
      meanings: [
        { partOfSpeech: 'noun', definitions: [{ definition: 'An animal.', example: 'The cat slept.' }] },
      ],
    },
  ];
  const { entries, phonetic } = mapFreeDictionaryApi(json);
  assert.equal(phonetic, '/kæt/');
  assert.equal(entries[0].part_of_speech, 'noun');
  assert.equal(entries[0].definition, 'An animal.');
  assert.deepEqual(entries[0].examples, ['The cat slept.']);
});

test('gutendex results are mapped to catalog items', () => {
  const json = {
    results: [
      { id: 30254, title: '吾輩は猫である', authors: [{ name: '夏目漱石' }], languages: ['ja'] },
      { id: 84, title: 'Frankenstein', authors: [], languages: ['en'] },
    ],
  };
  const items = mapGutendex(json);
  assert.equal(items.length, 2);
  assert.equal(items[0].provider, 'gutenberg');
  assert.equal(items[0].ref, '30254');
  assert.equal(items[0].author, '夏目漱石');
  assert.equal(items[0].language, 'ja');
  assert.equal(items[0].license, 'public-domain');
});

test('mediawiki search results are mapped with honest licenses', () => {
  const json = { query: { search: [{ title: '猫', snippet: 'a <b>cat</b> is...' }] } };
  const items = mapMediawikiSearch(json, 'wikipedia', 'ja', 'cc-by-sa-4.0');
  assert.equal(items[0].provider, 'wikipedia');
  assert.equal(items[0].author, 'Wikipedia contributors');
  assert.equal(items[0].license, 'cc-by-sa-4.0');
  assert.equal(items[0].description, 'a cat is...');
});

test('mediawiki extract and parse routes both yield plain text', () => {
  const extracts = { query: { pages: { '1': { extract: '吾輩は猫である。' } } } };
  assert.equal(extractFromMwExtracts(extracts), '吾輩は猫である。');
  const parsed = { parse: { text: { '*': '<p>First</p><p>Second</p>' } } };
  assert.equal(extractFromMwParse(parsed), 'First\nSecond');
});

test('rss 2.0 and atom feeds parse into honest items', () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>
    <item><title><![CDATA[Storm hits coast]]></title><link>https://example.com/a1</link><description>Rain and wind.</description></item>
    <item><title>Second</title><link>https://example.com/a2</link></item>
  </channel></rss>`;
  const items = parseRss(rss);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Storm hits coast');
  assert.equal(items[0].source_url, 'https://example.com/a1');
  assert.equal(items[0].description, 'Rain and wind.');

  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>Atom item</title><link href="https://example.com/b1"/><summary>Sum.</summary></entry>
  </feed>`;
  const atomItems = parseRss(atom);
  assert.equal(atomItems.length, 1);
  assert.equal(atomItems[0].title, 'Atom item');
  assert.equal(atomItems[0].source_url, 'https://example.com/b1');
});

test('gutendex URLs use the fast route: trailing slash + explicit page', () => {
  // Reproduced 2026-11: gutendex.com/books?languages=ja (no slash, no page)
  // hangs for minutes; /books/?languages=ja&page=1 answers in ~250ms.
  const browse = GUTENDEX_BROWSE_URL('ja', 1);
  assert.equal(browse, 'https://gutendex.com/books/?languages=ja&page=1');
  const browseEn = GUTENDEX_BROWSE_URL('en');
  assert.equal(browseEn, 'https://gutendex.com/books/?page=1');
  const search = GUTENDEX_SEARCH_URL('Stars', 'ja', 1);
  assert.equal(search, 'https://gutendex.com/books/?search=Stars&languages=ja&page=1');
  // page is clamped
  assert.ok(GUTENDEX_BROWSE_URL('ja', 999).endsWith('page=100'));
  assert.ok(GUTENDEX_BROWSE_URL('ja', -4).endsWith('page=1'));
});

test('gutendexPageInfo maps next/previous/count defensively', () => {
  assert.deepEqual(gutendexPageInfo({ count: 75, next: 'https://x', previous: null }), {
    count: 75,
    next: true,
    previous: false,
  });
  assert.deepEqual(gutendexPageInfo({}), { count: null, next: false, previous: false });
});

test('gutenberg text candidates put the reliable mirror first', () => {
  const urls = GUTENBERG_TEXT_URLS(1342);
  assert.equal(urls[0], 'https://gutenberg.pglaf.org/cache/epub/1342/pg1342.txt');
  assert.ok(urls.includes('https://www.gutenberg.org/cache/epub/1342/pg1342.txt'));
  assert.ok(urls.includes('https://www.gutenberg.org/files/1342/1342-0.txt'));
});

// ------------------------------------------------------------- new sources tests

test('safeFetch does not crash on responses with a content-length (the 2026-11 maxBytes regression)', async () => {
  // Regression: safeFetch referenced an undefined `maxBytes` variable, so
  // EVERY non-redirect response with a content-length header (Gutenberg
  // mirror book files, RSS feeds...) threw ReferenceError instead of
  // returning - which surfaced to users as "source responded 503".
  const realFetch = globalThis.fetch;
  const body = 'x'.repeat(1000);
  globalThis.fetch = async () =>
    new Response(body, {
      status: 200,
      headers: { 'content-length': String(body.length), 'content-type': 'text/plain' },
    });
  try {
    const res = await safeFetch('https://example.com/book.txt', { timeoutMs: 5000, maxBytes: 5 * 1024 * 1024 });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text.length, body.length);
    // And the cap still refuses oversized declared bodies.
    await assert.rejects(
      () => safeFetch('https://example.com/book.txt', { timeoutMs: 5000, maxBytes: 10 }),
      /too large/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('per-language registry: every app language has at least one provider', () => {
  for (const lang of APP_LANGUAGES) {
    const list = providersForLanguage(lang);
    assert.ok(list.length >= 1, `${lang} should have at least one provider`);
  }
});

test('per-language registry: gutenberg only where stocked, aozora leads Japanese', () => {
  // Probed 2026-11: Korean has 1 book (useless shelf), so Gutenberg is not
  // offered; Japanese leads with Aozora Bunko; the wiki family is everywhere.
  assert.equal(GUTENBERG_LANGUAGES.includes('ko'), false);
  assert.equal(GUTENBERG_LANGUAGES.includes('ja'), true);
  assert.equal(providersForLanguage('ja')[0].id, 'aozora');
  assert.ok(providersForLanguage('ja').some((p) => p.id === 'gutenberg'));
  assert.equal(providersForLanguage('ko')[0].id, 'wikisource');
  assert.equal(providersForLanguage('fr')[0].id, 'gutenberg');
  // Toki Pona's Wikipedia was relaunched on tok.wikipedia.org (verified live
  // 2026-11 via siteinfo) and its texts live on the multilingual
  // wikisource.org - so Toki Pona is no longer source-less.
  assert.equal(providersForLanguage('tok').some((p) => p.id === 'wikipedia'), true);
  assert.equal(providersForLanguage('tok').some((p) => p.id === 'wikisource'), true);
});

test('wiki host remap: Norwegian (nb) editions live on the no. subdomain', () => {
  assert.equal(MW_HOST('wikisource', 'nb'), 'no.wikisource.org');
  assert.equal(MW_HOST('wikipedia', 'nb'), 'nb.wikipedia.org');
  assert.equal(MW_HOST('wikinews', 'nb'), 'no.wikinews.org');
  assert.ok(MW_SEARCH_URL('wikisource', 'nb', 'test').startsWith('https://no.wikisource.org/'));
  assert.ok(GUTENDEX_BROWSE_URL('nb', 1).includes('languages=no'));
  const items = mapMediawikiSearch({ query: { search: [{ title: 'Nord' }] } }, 'wikisource', 'nb', 'x');
  assert.ok(items[0].source_url.startsWith('https://no.wikisource.org/wiki/'));
});

test('custom wiki edition codes: validation and URL routing (the Maori bridge)', () => {
  // validWikiCode is the gate for both the catalog search (?wiki=) and the
  // import (edition override): plain lowercase codes only, host-segment safe.
  assert.equal(validWikiCode('mi'), 'mi');
  assert.equal(validWikiCode('scn'), 'scn');
  assert.equal(validWikiCode('simple'), 'simple');
  assert.equal(validWikiCode('zh-min-nan'), 'zh-min-nan');
  assert.equal(validWikiCode('MI'), null); // uppercase rejected
  assert.equal(validWikiCode(''), null);
  assert.equal(null ?? validWikiCode(undefined), null);
  assert.equal(validWikiCode('evil.example.com'), null);
  assert.equal(validWikiCode('x'), null); // too short (2 chars minimum)
  assert.equal(validWikiCode('a'.repeat(20)), null); // too long

  // A custom code routes every wiki call to that edition, so a Maori learner
  // with a differently-coded language still reads mi.wikipedia.org.
  assert.equal(MW_HOST('wikipedia', 'mi'), 'mi.wikipedia.org');
  assert.ok(MW_SEARCH_URL('wikipedia', 'mi', 'Aotearoa').startsWith('https://mi.wikipedia.org/w/api.php'));
  assert.ok(MW_EXTRACT_URL('wikipedia', 'mi', 'Aotearoa').startsWith('https://mi.wikipedia.org/w/api.php'));

  // Catalog items carry the edition in source_url (built from urlLang), so
  // the UI can stamp data-import-wiki from the same payload.
  const items = mapMediawikiSearch({ query: { search: [{ title: 'Aotearoa' }] } }, 'wikipedia', 'mri', 'cc-by-sa-4.0', 'mi');
  assert.equal(items[0].provider, 'wikipedia');
  assert.ok(items[0].source_url.startsWith('https://mi.wikipedia.org/wiki/Aotearoa'));
});

test('htmlToText: <rp> fallback parentheses do not leak into the ruby base', () => {
  // Aozora XHTML form: <ruby><rb>或日</rb><rp>（</rp><rt>あるひ</rt><rp>）</rp></ruby>
  const html = '<p><ruby><rb>或日</rb><rp>（</rp><rt>あるひ</rt><rp>）</rp></ruby>の暮方の事である。</p>';
  assert.equal(htmlToText(html), '或日（あるひ）の暮方の事である。');
});

test('aozoraTxtToPlain: ruby 《》 -> parenthetical, legend and footer stripped', () => {
  const raw = [
    '羅生門', '芥川竜之介', '',
    '-------------------------------------------------------',
    '【テキスト中に現れる記号について】', '',
    '《》：ルビ', '（例）或日《あるひ》', '',
    '-------------------------------------------------------',
    '　或日《あるひ》の暮方の事である。',
    '　｜羅生門《らしやうもん》の下で雨やみを待つてゐた。',
  ].join('\n');
  const out = aozoraTxtToPlain(raw);
  assert.ok(out.startsWith('或日（あるひ）'), `legend/header should be cut: ${out.slice(0, 30)}`);
  assert.ok(out.includes('或日（あるひ）の暮方'));
  assert.ok(out.includes('羅生門（らしやうもん）'));
  assert.equal(out.includes('テキスト中に現れる記号について'), false);
});

test('aozoraHtmlToText: main_text extraction + footer cut', () => {
  const html = [
    '<html><body><div class="header">岩波文庫</div>',
    '<div class="main_text"><p>或日<ruby>（<rp>）<rt>あるひ</rt></ruby>の事。</p></div>',
    '<div class="bibliographical_information">底本：岩波文庫</div></body></html>',
  ].join('');
  const out = aozoraHtmlToText(html);
  assert.ok(out.includes('の事。'));
  assert.equal(out.includes('底本'), false);
  assert.equal(out.includes('岩波文庫'), false);
});

test('aozora catalog: ref roundtrip and search', () => {
  const items = aozoraCatalogItems('');
  assert.ok(items.length >= 30, `curated shelf should be substantial (${items.length})`);
  const cat = aozoraCatalogItems('猫');
  assert.deepEqual(cat.map((c) => c.title), ['吾輩は猫である']);
  const work = aozoraByRef(cat[0].ref);
  assert.equal(work.t, '吾輩は猫である');
  assert.equal(AOZORA_REF(work), cat[0].ref);
  assert.equal(aozoraByRef('000000/nonexistent'), null);
});

test('aozoraUrls builds the three fetch routes from a work', () => {
  const urls = aozoraUrls({ a: '000879', z: '128_ruby_2046', h: '128_15261', w: '000128' });
  assert.equal(urls.html, 'https://www.aozora.gr.jp/cards/000879/files/128_15261.html');
  assert.equal(urls.hack, 'https://aozorahack.org/aozorabunko_text/cards/000879/files/128_ruby_2046/128_ruby_2046.txt');
  assert.equal(urls.zip, 'https://www.aozora.gr.jp/cards/000879/files/128_ruby_2046.zip');
  assert.equal(urls.card, 'https://www.aozora.gr.jp/cards/000879/card000128.html');
});

test('unzipFirstEntry inflates a single-file deflate zip', () => {
  const content = Buffer.from('或日（あるひ）の暮方の事である。'.repeat(40), 'utf8');
  const name = Buffer.from('work.txt');
  const comp = deflateRawSync(content);
  const local = Buffer.alloc(30 + name.length + comp.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  name.copy(local, 30);
  comp.copy(local, 30 + name.length);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10); // deflate
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(0, 42); // local offset
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8); // 1 entry
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(local.length, 16); // cd offset = after the local entry
  const zip = Buffer.concat([local, central, eocd]);
  const out = unzipFirstEntry(zip);
  assert.equal(out.toString('utf8'), content.toString('utf8'));
  assert.throws(() => unzipFirstEntry(Buffer.from('not a zip at all')), /not a zip/);
});

// ---------------------------------------------------------------
// 2026-11 feedback round: Gutenberg card blurbs, stale memo fallback,
// source coverage for ko/zh/ru/fr/es, Wikivoyage provider.
// ---------------------------------------------------------------

test('mapGutendex fills the card blurb from shelves and subjects (honest metadata)', () => {
  const items = mapGutendex({
    results: [
      {
        id: 2701,
        title: 'Moby Dick; Or, The Whale',
        authors: [{ name: 'Melville, Herman' }],
        languages: ['en'],
        bookshelves: ['Adventure'],
        subjects: ['Sea stories', 'Whaling -- Fiction', 'A very long subject heading that should be skipped because it exceeds the length cap and clutters the card'],
      },
      { id: 1342, title: 'Pride and Prejudice', authors: [], languages: ['en'] },
    ],
  });
  assert.equal(items[0].description, 'Adventure · Sea stories · Whaling - Fiction');
  assert.equal(items[0].author, 'Melville, Herman');
  assert.equal(items[1].description, null); // no subjects -> no invented blurb
  assert.equal(items[1].author, null);
});

test('memoJson serves the last successful value after TTL expiry (stale-while-error)', async () => {
  const key = `test:stale:${Math.random()}`;
  const first = await memoJson(key, 1, async () => ({ page: 1 }));
  assert.deepEqual(first, { page: 1 });
  assert.equal(memoJsonStale(key), first); // fresh now
  await new Promise((r) => setTimeout(r, 5)); // TTL lapses
  let fetched = false;
  await assert.rejects(() => memoJson(key, 1, async () => {
    fetched = true;
    throw new Error('gutendex rate limit');
  }));
  assert.equal(fetched, true);
  assert.deepEqual(memoJsonStale(key), { page: 1 }); // stale survives the failure
  assert.equal(memoJsonStale('never-fetched-key'), null);
});

test('news feeds cover the feedback-round languages and stay deduplicated', () => {
  for (const lang of ['fr', 'es', 'ru', 'zh', 'ja']) {
    assert.ok(NEWS_FEEDS.some((f) => f.language === lang), `${lang} has a feed`);
    assert.ok(NEWS_FEEDS.filter((f) => f.language === lang).length >= 2, `${lang} has 2+ feeds`);
  }
  const urls = NEWS_FEEDS.map((f) => f.url);
  assert.equal(new Set(urls).size, urls.length); // no duplicate feeds
});

test('Wikivoyage is a registered provider serving the feedback-round languages (except Korean)', () => {
  assert.ok(PROVIDERS.wikivoyage, 'provider exists');
  for (const lang of ['zh', 'ru', 'fr', 'es']) {
    assert.ok(WIKIVOYAGE_LANGUAGES.includes(lang), `${lang} has a Wikivoyage edition`);
    assert.ok(providersForLanguage(lang).some((p) => p.id === 'wikivoyage'), `${lang} gets Wikivoyage in its source list`);
  }
  // Korean has no Wikivoyage edition - the portal lists none (2026-11).
  assert.ok(!WIKIVOYAGE_LANGUAGES.includes('ko'));
});

test('mw hosts resolve for wikivoyage editions (the generic wiki family route)', () => {
  assert.equal(MW_HOST('wikivoyage', 'fr'), 'fr.wikivoyage.org');
  assert.equal(MW_HOST('wikivoyage', 'zh'), 'zh.wikivoyage.org');
});
