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
  aozoraCatalogItems,
  aozoraByRef,
  AOZORA_REF,
  aozoraTxtToPlain,
  aozoraHtmlToText,
  aozoraUrls,
  unzipFirstEntry,
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

test('wiktionary language matching works via the language name too', () => {
  const json = [{ language: 'Chinese', part_of_speech: 'noun', definitions: [{ definition: 'Chinese entry' }] }];
  const out = mapWiktionaryDefinitions(json, 'zh', 'Chinese');
  assert.equal(out.length, 1);
  assert.equal(out[0].definition, 'Chinese entry');
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
  assert.equal(providersForLanguage('tok').some((p) => p.id === 'wikipedia'), false);
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
