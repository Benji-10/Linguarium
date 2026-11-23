/**
 * Source library tests: the pure mappers/parsers behind /api/catalog,
 * /api/import-source and /api/lookup (no network access needed).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ssrfSafeUrl,
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
