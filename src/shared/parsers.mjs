/**
 * Collection import parsers (CSV / JSON / plain text).
 *
 * Design rule from the platform specification: nothing that fails to parse
 * is discarded. Unparsed lines are retained with their raw content and a
 * reason, so the user can fix them later instead of losing data.
 *
 * All functions are pure and browser/Node safe.
 */

const TERM_KEYS = ['term', 'word', 'headword', 'lemma', 'front', 'vocab', 'expression', 'phrase'];
const DEFINITION_KEYS = ['definition', 'meaning', 'translation', 'gloss', 'back', 'sense', 'def'];
const READING_KEYS = ['reading', 'pronunciation', 'pron'];
const POS_KEYS = ['part_of_speech', 'pos', 'category'];
const EXAMPLE_KEYS = ['example', 'sentence', 'example_sentence'];
const TAGS_KEYS = ['tags', 'tag'];
const NOTES_KEYS = ['notes', 'note'];

/** Strip common list numbering and bullet markers from a line. */
function stripBullets(line) {
  return line
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\s*[-*•]\s+/, '')
    .trim();
}

/** Detect the most likely format for the pasted/uploaded content. */
export function sniffFormat(text) {
  const trimmed = String(text).trim();
  if (!trimmed) return 'txt';
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* fall through */
    }
  }
  const firstLines = trimmed.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  if (firstLines.length >= 2) {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    for (const line of firstLines) {
      for (const d of Object.keys(counts)) if (line.includes(d)) counts[d] += 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    // A delimiter present in most sample lines suggests CSV.
    if (best[1] >= Math.max(2, firstLines.length - 1) && best[1] > 0) return 'csv';
  }
  return 'txt';
}

/** Parse one CSV row honoring quoted fields ("a,b", "" escapes). */
function parseCsvLine(line, delimiter) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function pickKey(keys, headers) {
  for (const k of keys) {
    const idx = headers.findIndex((h) => h && h.toLowerCase().replace(/[\s-]+/g, '_') === k);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse CSV. Header row is detected from known column names; otherwise the
 * first column is the term and the second the definition.
 */
export function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim() !== '');
  const items = [];
  if (lines.length === 0) return { format: 'csv', items, unparsedCount: 0 };

  const sample = lines.slice(0, 5);
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const line of sample) {
    for (const d of Object.keys(counts)) if (line.includes(d)) counts[d] += 1;
  }
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const firstFields = parseCsvLine(lines[0], delimiter).map((f) => f.trim());
  const hasHeader =
    firstFields.length > 1 &&
    [...TERM_KEYS, ...DEFINITION_KEYS, ...READING_KEYS, ...POS_KEYS, ...EXAMPLE_KEYS, ...TAGS_KEYS, ...NOTES_KEYS]
      .concat('term_normalized', 'normalized')
      .includes(firstFields.map((f) => f.toLowerCase().replace(/[\s-]+/g, '_')).find(Boolean) ?? '');

  let headers = null;
  let start = 0;
  if (hasHeader) {
    headers = firstFields.map((f) => f.toLowerCase().replace(/[\s-]+/g, '_'));
    start = 1;
  } else {
    headers = ['term', 'definition'];
  }

  const termIdx = pickKey(TERM_KEYS, headers) ?? 0;
  const defIdx = pickKey(DEFINITION_KEYS, headers);
  const readIdx = pickKey(READING_KEYS, headers);
  const posIdx = pickKey(POS_KEYS, headers);
  const exIdx = pickKey(EXAMPLE_KEYS, headers);
  const tagsIdx = pickKey(TAGS_KEYS, headers);
  const notesIdx = pickKey(NOTES_KEYS, headers);

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    const fields = parseCsvLine(raw, delimiter).map((f) => f.trim());
    const term = termIdx >= 0 ? fields[termIdx] : '';
    if (!term) {
      items.push({ raw, parsed: false, reason: 'No term in the first column.', term: null, definition: null, extra: {} });
      continue;
    }
    const extra = {};
    if (defIdx >= 0 && fields[defIdx]) extra.definition = fields[defIdx];
    if (readIdx >= 0 && fields[readIdx]) extra.reading = fields[readIdx];
    if (posIdx >= 0 && fields[posIdx]) extra.part_of_speech = fields[posIdx];
    if (exIdx >= 0 && fields[exIdx]) extra.example = fields[exIdx];
    if (tagsIdx >= 0 && fields[tagsIdx]) extra.tags = fields[tagsIdx].split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    if (notesIdx >= 0 && fields[notesIdx]) extra.notes = fields[notesIdx];
    items.push({ raw, parsed: true, term, definition: extra.definition ?? null, extra });
  }
  return {
    format: 'csv',
    items,
    unparsedCount: items.filter((i) => !i.parsed).length,
  };
}

/** Parse a JSON export: array of entries, {name, items}, or {items}. */
export function parseJson(text) {
  const items = [];
  let collectionName = null;
  let data;
  try {
    data = JSON.parse(String(text));
  } catch (err) {
    return {
      format: 'json',
      items: [{ raw: String(text).slice(0, 500), parsed: false, reason: `Invalid JSON: ${err.message}`, term: null, definition: null, extra: {} }],
      unparsedCount: 1,
    };
  }
  const rows = Array.isArray(data) ? data : data?.items;
  if (Array.isArray(rows)) {
    if (!Array.isArray(data) && typeof data.name === 'string') collectionName = data.name;
    rows.forEach((row) => {
      if (row == null || typeof row !== 'object') {
        items.push({ raw: JSON.stringify(row), parsed: false, reason: 'Not an object.', term: null, definition: null, extra: {} });
        return;
      }
      const term = TERM_KEYS.map((k) => row[k]).find((v) => typeof v === 'string' && v.trim() !== '');
      if (!term) {
        items.push({ raw: JSON.stringify(row).slice(0, 300), parsed: false, reason: 'Missing a term field.', term: null, definition: null, extra: {} });
        return;
      }
      const extra = {};
      const def = DEFINITION_KEYS.map((k) => row[k]).find((v) => typeof v === 'string');
      if (def) extra.definition = def;
      const read = READING_KEYS.map((k) => row[k]).find((v) => typeof v === 'string');
      if (read) extra.reading = read;
      const pos = POS_KEYS.map((k) => row[k]).find((v) => typeof v === 'string');
      if (pos) extra.part_of_speech = pos;
      const ex = EXAMPLE_KEYS.map((k) => row[k]).find((v) => typeof v === 'string');
      if (ex) extra.example = ex;
      if (Array.isArray(row.tags)) extra.tags = row.tags.filter((t) => typeof t === 'string');
      else if (typeof row.tags === 'string') extra.tags = row.tags.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
      if (typeof row.notes === 'string') extra.notes = row.notes;
      items.push({ raw: JSON.stringify(row).slice(0, 300), parsed: true, term: term.trim(), definition: extra.definition ?? null, extra });
    });
  } else {
    items.push({ raw: String(text).slice(0, 500), parsed: false, reason: 'Expected a JSON array of entries or {name, items}.', term: null, definition: null, extra: {} });
  }
  return {
    format: 'json',
    items,
    collectionName,
    unparsedCount: items.filter((i) => !i.parsed).length,
  };
}

/** Plain text: one entry per line with an optional separator. */
export function parseTxt(text) {
  const SEPARATORS = ['\t', ' — ', ' – ', ' - ', ' : ', ' :: ', ' = ', ' ='];
  const items = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const line = stripBullets(rawLine);
    if (!line) continue;

    let cut = -1;
    let sepLen = 0;
    for (const sep of SEPARATORS) {
      const idx = line.indexOf(sep);
      if (idx > 0 && (cut === -1 || idx < cut)) {
        cut = idx;
        sepLen = sep.length;
      }
    }
    if (cut === -1) {
      // Try the simple colon with no space requirement as a last resort.
      const idx = line.indexOf(':');
      if (idx > 0) {
        cut = idx;
        sepLen = 1;
      }
    }

    if (cut === -1) {
      items.push({ raw: rawLine, parsed: true, term: line, definition: null, extra: {} });
    } else {
      const term = line.slice(0, cut).trim();
      const definition = line.slice(cut + sepLen).trim();
      if (!term) {
        items.push({ raw: rawLine, parsed: false, reason: 'Empty term.', term: null, definition: null, extra: {} });
      } else {
        items.push({ raw: rawLine, parsed: true, term, definition: definition || null, extra: {} });
      }
    }
  }
  return {
    format: 'txt',
    items,
    unparsedCount: items.filter((i) => !i.parsed).length,
  };
}

/**
 * Parse content in any supported format. Format is auto-detected unless
 * explicitly given.
 */
export function parseImport(text, format = null) {
  const fmt = format || sniffFormat(text);
  if (fmt === 'json') return parseJson(text);
  if (fmt === 'csv') return parseCsv(text);
  return parseTxt(text);
}

/** CSV serialization for collection export. */
export function toCsv(items) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['term,definition,reading,part_of_speech,example,notes'];
  for (const item of items) {
    const e = item.extra ?? {};
    lines.push(
      [item.term, item.definition ?? e.definition, e.reading, e.part_of_speech, e.example, e.notes]
        .map(esc)
        .join(','),
    );
  }
  return lines.join('\n');
}

/** JSON serialization for collection export (the portable interchange form). */
export function toJson(collection) {
  return JSON.stringify(
    {
      format: 'linguarium-collection',
      version: 1,
      name: collection.name,
      language: collection.language_code,
      items: (collection.items ?? []).map((item) => ({
        term: item.term,
        definition: item.definition,
        ...(item.extra && Object.keys(item.extra).length ? { extra: item.extra } : {}),
        parsed: item.parsed,
        raw: item.raw,
      })),
    },
    null,
    2,
  );
}
