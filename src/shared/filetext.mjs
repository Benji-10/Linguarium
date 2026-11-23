/**
 * File text extraction for the import center: .txt, .html/.htm, .epub.
 *
 * Everything happens in the browser - the file never leaves the device
 * until the user saves the resulting text through POST /api/texts.
 *
 * EPUB is a ZIP of XHTML documents: fflate (MIT) unpacks it, the OPF spine
 * gives the reading order, and each document is read like HTML (ruby-aware:
 * <ruby>漢字<rt>かんじ</rt></ruby> becomes the parenthetical annotation form
 * so the reader's ruby parser can pick it up).
 *
 * Pure functions except the EPUB entry point (needs the file bytes).
 */

import { unzipSync } from 'fflate';

/** Strip scripts/styles/nav/footer, convert block tags to newlines, decode
 *  entities, and convert furigana <ruby> markup to parenthetical annotations. */
export function htmlToReadableText(html) {
  let s = String(html ?? '');
  s = s.replace(/<ruby[^>]*>([\s\S]*?)<\/ruby>/gi, (m, inner) => {
    const parts = [...inner.matchAll(/<rt[^>]*>([\s\S]*?)<\/rt\s*>/gi)].map((x) => x[1]);
    let base = inner.replace(/<rt[\s\S]*?<\/rt\s*>/gi, '').replace(/<[^>]+>/g, '');
    base = decodeEntities(base).trim();
    const reading = parts.map((p) => decodeEntities(p).trim()).join('');
    return reading && base ? `${base}（${reading}）` : base;
  });
  s = s.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|tr|table|figcaption)\s*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
};

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Extract the <title> of an HTML document (best-effort). */
export function htmlTitle(html) {
  const m = String(html ?? '').match(/<title[^>]*>([\s\S]{0,600}?)<\/title\s*>/i);
  if (!m) return null;
  return decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || null;
}

const DECODE = new TextDecoder('utf-8');

function decode(bytes) {
  return DECODE.decode(bytes);
}

/** Read the container.xml -> OPF path (with a fallback scan for *.opf). */
function opfPath(files) {
  const container = files['META-INF/container.xml'];
  if (container) {
    const xml = decode(container);
    const m = xml.match(/full-path=["']([^"']+)["']/i);
    if (m) return m[1];
  }
  const candidate = Object.keys(files).find((n) => n.toLowerCase().endsWith('.opf'));
  return candidate ?? null;
}

/** Parse the OPF: the spine document order and the book's dc:title. */
function parseOpf(opfXml, files) {
  const title = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? null;
  const items = new Map();
  for (const m of opfXml.matchAll(/<item\b[^>]*>/gi)) {
    const tag = m[0];
    const id = tag.match(/id=["']([^"']+)["']/i)?.[1];
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    const type = tag.match(/media-type=["']([^"']+)["']/i)?.[1] ?? '';
    if (id && href) items.set(id, { href: decodeURIComponent(href), type });
  }
  const order = [];
  for (const m of opfXml.matchAll(/<itemref\b[^>]*idref=["']([^"']+)["'][^>]*>/gi)) {
    const item = items.get(m[1]);
    if (item && /x?html/i.test(item.type)) order.push(item.href);
  }
  return { title, order };
}

/**
 * Extract the reading text from an EPUB file (an ArrayBuffer).
 * Returns { title, chapters: [{href, text}] } in spine order.
 */
export function epubToText(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const opf = opfPath(files);
  if (!opf || !files[opf]) {
    throw new Error('This EPUB has no readable package file (.opf).');
  }
  const dir = opf.includes('/') ? `${opf.slice(0, opf.lastIndexOf('/'))}/` : '';
  const { title, order } = parseOpf(decode(files[opf]), files);
  const hrefs = order.length > 0 ? order : Object.keys(files).filter((n) => /\.x?html?$/i.test(n));
  const chapters = [];
  for (const href of hrefs) {
    const key = `${dir}${href}`;
    const file = files[key] ?? files[href];
    if (!file) continue;
    const text = htmlToReadableText(decode(file));
    if (text) chapters.push({ href, text });
  }
  if (chapters.length === 0) {
    throw new Error('No readable documents were found inside this EPUB.');
  }
  return { title, chapters };
}

/** Join EPUB chapters into one reading text with chapter separators. */
export function epubChaptersToBody(chapters, { separator = '\n\n' } = {}) {
  return chapters.map((c) => c.text.trim()).join(separator).trim();
}

/** Extract text from a File the user selected (.txt / .html / .htm / .epub). */
export async function extractFromFile(file) {
  const name = (file?.name ?? '').toLowerCase();
  if (name.endsWith('.epub')) {
    const { title, chapters } = epubToText(await file.arrayBuffer());
    const approx = epubChaptersToBody(chapters);
    const over = approx.length > 200000;
    return {
      kind: 'epub',
      title: title ?? (file.name.replace(/\.epub$/i, '') || null),
      text: over ? approx.slice(0, 200000) : approx,
      truncated: over,
      chapters: chapters.length,
    };
  }
  const raw = await file.text();
  if (name.endsWith('.html') || name.endsWith('.htm') || /<\/?(html|body|div|p|br)\b/i.test(raw.slice(0, 4000))) {
    return { kind: 'html', title: htmlTitle(raw), text: htmlToReadableText(raw), truncated: false };
  }
  return { kind: 'txt', title: file.name.replace(/\.[a-z]+$/i, '') || null, text: raw.trim(), truncated: false };
}
