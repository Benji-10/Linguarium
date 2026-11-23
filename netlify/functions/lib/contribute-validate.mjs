/**
 * Contribution validation (phase 3) - PURE, so it is unit-testable.
 *
 * Every community submission must be traceable to a source and carry an
 * explicit license (never "unspecified"): texts, grammar structures and
 * lexicon entries follow the same provenance rules as the seed data
 * (docs/CONTENT.md). This module turns raw request data into either a
 * normalized, insertable payload or a list of human-readable errors.
 */

export const CONTRIBUTION_KINDS = ['text', 'grammar', 'lexicon'];

const MAX_TEXT_BODY = 50000;

const str = (v, n) => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, n) : null);

/**
 * Validate one submission.
 *
 * @param {{kind?: string, language_code?: string, payload?: object,
 *          license?: string, source_url?: string}} raw
 * @returns {{ok: true, kind: string, language_code: string, title: string,
 *            license: string, source_url: string, payload: object}
 *          | {ok: false, errors: string[]}}
 */
export function validateContribution(raw) {
  const errors = [];
  if (raw == null || typeof raw !== 'object') return { ok: false, errors: ['The submission must be a JSON object.'] };

  const kind = str(raw.kind, 20);
  if (!CONTRIBUTION_KINDS.includes(kind)) {
    errors.push('kind must be one of: text, grammar, lexicon.');
  }

  const languageCode = str(raw.language_code, 16);
  if (!languageCode) errors.push('language_code is required.');

  const license = str(raw.license, 200);
  if (!license) errors.push('license is required (what license the content is shared under).');
  if (license && /^(unspecified|unknown)$/i.test(license.trim())) {
    errors.push('license cannot be "unspecified": contributions must state a real license.');
  }

  const sourceUrl = str(raw.source_url, 1000);
  if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) {
    errors.push('source_url must be an absolute http(s) URL.');
  }

  let payload = null;
  let title = null;
  const p = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload) ? raw.payload : null;
  if (!p) {
    errors.push('payload is required (a JSON object with the contribution content).');
  } else if (kind === 'text') {
    title = str(p.title, 300);
    if (!title) errors.push('payload.title is required.');
    const rawBody = typeof p.body === 'string' ? p.body : null;
    if (!rawBody || rawBody.trim() === '') {
      errors.push('payload.body is required (the full text).');
    } else if (rawBody.length > MAX_TEXT_BODY) {
      errors.push(`payload.body is longer than ${MAX_TEXT_BODY} characters; split it or link it.`);
    }
    const body = rawBody ? rawBody.trim().slice(0, MAX_TEXT_BODY) : null;
    const author = str(p.author, 300);
    const topic = str(p.topic, 40);
    const adaptationNote = str(p.adaptation_note, 2000);
    if (!author && !sourceUrl) {
      errors.push('a text needs an author or a source URL - provenance must be traceable.');
    }
    if (!errors.length) {
      payload = { title, body, author, topic, adaptation_note: adaptationNote };
    }
  } else if (kind === 'grammar') {
    title = str(p.name, 300);
    if (!title) errors.push('payload.name is required (the structure name).');
    const explanation = str(p.explanation, 20000);
    if (!explanation) errors.push('payload.explanation is required (how the structure works).');
    const summary = str(p.summary, 600);
    let examples = [];
    if (Array.isArray(p.examples)) {
      examples = p.examples
        .filter((e) => e && typeof e === 'object' && typeof e.text === 'string' && e.text.trim() !== '')
        .slice(0, 12)
        .map((e) => ({
          text: e.text.trim().slice(0, 600),
          ...(typeof e.translation === 'string' && e.translation.trim() !== '' ? { translation: e.translation.trim().slice(0, 600) } : {}),
        }));
    }
    if (examples.length === 0) errors.push('payload.examples is required: at least one example sentence with the structure.');
    if (!errors.length) {
      payload = { name: title, summary, explanation, examples };
    }
  } else if (kind === 'lexicon') {
    title = str(p.term, 300);
    if (!title) errors.push('payload.term is required.');
    const definition = str(p.definition, 2000);
    if (!definition) errors.push('payload.definition is required.');
    const reading = str(p.reading, 200);
    const partOfSpeech = str(p.part_of_speech, 40);
    const glossLanguage = str(p.gloss_language, 16) ?? 'en';
    if (!errors.length) {
      payload = { term: title, definition, reading, part_of_speech: partOfSpeech, gloss_language: glossLanguage };
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, kind, language_code: languageCode, title, license, source_url: sourceUrl, payload };
}
