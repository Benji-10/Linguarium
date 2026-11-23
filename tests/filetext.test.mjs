/**
 * File text extraction tests: HTML reading text, ruby preservation, and a
 * full EPUB round trip built with fflate's zipSync.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { htmlToReadableText, htmlTitle, epubToText, epubChaptersToBody } from '../src/shared/filetext.mjs';

test('html reading text strips junk and keeps paragraphs', () => {
  const html = `<html><head><title>A</title></head><body>
    <nav>menu</nav>
    <article><p>First line.</p><p>Second line.</p></article>
    <script>bad()</script>
    <footer>foot</footer>
  </body></html>`;
  const text = htmlToReadableText(html);
  assert.ok(text.includes('First line.'));
  assert.ok(text.includes('Second line.'));
  assert.equal(text.includes('bad()'), false);
  assert.equal(text.includes('menu'), false);
  assert.equal(text.includes('foot'), false);
});

test('ruby markup becomes parenthetical annotations for the reader', () => {
  const html = '<p><ruby>漢字<rt>かんじ</rt></ruby>を勉強します。</p>';
  assert.equal(htmlToReadableText(html), '漢字（かんじ）を勉強します。');
});

test('htmlTitle works', () => {
  assert.equal(htmlTitle('<title>吾輩は猫である</title>'), '吾輩は猫である');
  assert.equal(htmlTitle('<p>no title</p>'), null);
});

function buildEpub() {
  const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
  const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>吾輩は猫である (opening)</dc:title>
    <dc:language>ja</dc:language>
  </metadata>
  <manifest>
    <item id="c1" href="text/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`;
  const chapter1 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head>
<body><p>吾輩は猫である。名前はまだ無い。</p></body></html>`;
  const chapter2 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head>
<body><p><ruby>見当<rt>けんとう</rt></ruby>がつかぬ。</p></body></html>`;
  return zipSync({
    'mimetype': new Uint8Array([0x41, 0x50, 0x50, 0x4c, 0x49, 0x43, 0x41, 0x54, 0x49, 0x4f, 0x4e /* "APPLICATION" no, keep simple */, 0x2f, 0x65, 0x70, 0x75, 0x62]),
    'META-INF/container.xml': new TextEncoder().encode(container),
    'OEBPS/content.opf': new TextEncoder().encode(opf),
    'OEBPS/text/chapter1.xhtml': new TextEncoder().encode(chapter1),
    'OEBPS/text/chapter2.xhtml': new TextEncoder().encode(chapter2),
  });
}

test('epub extraction follows the spine, keeps the title, preserves ruby', () => {
  const buffer = buildEpub().buffer.slice(buildEpub().byteOffset, buildEpub().byteOffset + buildEpub().byteLength);
  const { title, chapters } = epubToText(buffer);
  assert.equal(title, '吾輩は猫である (opening)');
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].text, '吾輩は猫である。名前はまだ無い。');
  assert.equal(chapters[1].text, '見当（けんとう）がつかぬ。');
  const body = epubChaptersToBody(chapters);
  assert.equal(body, '吾輩は猫である。名前はまだ無い。\n\n見当（けんとう）がつかぬ。');
});

test('epub without an opf fails honestly', () => {
  const bytes = zipSync({ 'chapter.xhtml': new TextEncoder().encode('<html><body><p>x</p></body></html>') });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.throws(() => epubToText(buffer), /readable package/i);
});
