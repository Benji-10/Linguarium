/**
 * POST /api/enrich - AI enrichment for one vocabulary term (Gemini).
 *
 * Rules from the platform specification:
 *   - The ONLY model used is "gemini-3.1-flash-lite" (pinned by spec).
 *   - AI is optional: no GEMINI_API_KEY => 503 with a clear code; every
 *     core feature keeps working.
 *   - Results are cached in knowledge.enrichment_cache keyed by
 *     (language, term, schema version): the model is called at most once
 *     per term for the whole deployment.
 *   - A daily per-user quota is enforced in the database.
 *   - Etymology must never be invented. The prompt only allows attested
 *     etymology, and anything the model returns is labelled provenance
 *     'ai' (unverified) in the UI, clearly separated from mnemonics and
 *     from verified etymology fields.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { consumeDailyQuota } from './lib/ratelimit.mjs';
import { GEMINI_MODEL } from './ai-status.mjs';

const SCHEMA_VERSION = 1;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    definitions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['text'],
      },
    },
    part_of_speech: { type: 'STRING' },
    reading: { type: 'STRING' },
    pronunciation_ipa: { type: 'STRING' },
    example_sentences: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          translation: { type: 'STRING' },
        },
        required: ['text'],
      },
    },
    usage_notes: { type: 'STRING' },
    etymology: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING' },
        confidence: { type: 'STRING', enum: ['attested', 'likely', 'unknown'] },
        note: { type: 'STRING' },
      },
    },
    mnemonic: { type: 'STRING' },
    gloss_language: { type: 'STRING' },
  },
  required: ['definitions', 'etymology'],
};

function buildPrompt({ languageName, languageCode, term, glossLanguage }) {
  return [
    `You are enriching one vocabulary entry for a language learner.`,
    `Language: ${languageName} (code: ${languageCode}).`,
    `Term: "${term}".`,
    `Write definitions, notes and translations in language "${glossLanguage}".`,
    '',
    'Rules, in order of importance:',
    '1. Definitions: give 1-3 concise senses of the term as actually used in this language. If you do not reliably know this term, return an empty definitions array.',
    '2. Etymology honesty is absolute. Only include etymology ("text" non-null) when it is established knowledge you can trace to reliable scholarship. If you are not fully confident, set etymology.text to null, confidence "unknown", and a short note explaining that no reliable etymological source is available. Never guess, never present plausible-sounding invention as history, never invent cognates.',
    '3. Mnemonic: optionally provide a short memory aid. A mnemonic is a learning device, never a claim about the history of the word, so it must not dress itself up as etymology.',
    '4. reading / pronunciation_ipa: use the conventions of the language. If unknown, omit.',
    '5. example_sentences: up to 3 short natural sentences using the term, each with a translation.',
    '6. Keep every string short (under 300 characters).',
  ].join('\n');
}

function normalizePayload(raw, glossLanguage) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const definitions = Array.isArray(p.definitions)
    ? p.definitions
        .filter((d) => d && typeof d.text === 'string' && d.text.trim() !== '')
        .slice(0, 3)
        .map((d) => ({
          text: d.text.slice(0, 400),
          ...(d.note && typeof d.note === 'string' ? { note: d.note.slice(0, 300) } : {}),
        }))
    : [];

  const et = p.etymology && typeof p.etymology === 'object' ? p.etymology : {};
  const confidence = ['attested', 'likely', 'unknown'].includes(et.confidence) ? et.confidence : 'unknown';
  const etymology = {
    text: typeof et.text === 'string' && et.text.trim() !== '' ? et.text.slice(0, 600) : null,
    confidence: typeof et.text === 'string' && et.text.trim() !== '' ? confidence : 'unknown',
    note: typeof et.note === 'string' ? et.note.slice(0, 400) : null,
  };

  const examples = Array.isArray(p.example_sentences)
    ? p.example_sentences
        .filter((e) => e && typeof e.text === 'string' && e.text.trim() !== '')
        .slice(0, 3)
        .map((e) => ({
          text: e.text.slice(0, 300),
          ...(e.translation && typeof e.translation === 'string' ? { translation: e.translation.slice(0, 300) } : {}),
        }))
    : [];

  const str = (v, n) => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, n) : null);

  return {
    definitions,
    part_of_speech: str(p.part_of_speech, 40),
    reading: str(p.reading, 200),
    pronunciation_ipa: str(p.pronunciation_ipa, 200),
    example_sentences: examples,
    usage_notes: str(p.usage_notes, 800),
    etymology,
    mnemonic: str(p.mnemonic, 400),
    gloss_language: str(p.gloss_language, 16) ?? glossLanguage,
  };
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(
      502,
      'ai-provider-error',
      `The AI provider rejected the request (status ${res.status}). ${detail.slice(0, 200)}`,
    );
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new HttpError(502, 'ai-empty', 'The AI model returned an empty response for this term.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'ai-invalid-json', 'The AI response could not be parsed as JSON.');
  }
}

export default handler({
  POST: async (req) => {
    const user = await requireUser();
    const data = await body(req);
    const language = requireString(data, 'language_code', { max: 16 });
    const term = requireString(data, 'term', { max: 300 });
    const glossLanguage = requireString(data, 'gloss_language', { max: 16, optional: true }) ?? 'en';

    if (!process.env.GEMINI_API_KEY) {
      throw new HttpError(
        503,
        'ai-not-configured',
        'AI enrichment is not configured on this deployment (GEMINI_API_KEY missing). All core features work without it.',
      );
    }

    // Language metadata for the prompt.
    const langRows = await sql()`
      SELECT code, name FROM knowledge.languages WHERE code = ${language}`;
    const languageName = langRows[0]?.name ?? language;

    // 1. Cache hit?
    const cached = await sql()`
      SELECT payload, model, created_at FROM knowledge.enrichment_cache
      WHERE language_code = ${language} AND term = ${term} AND schema_version = ${SCHEMA_VERSION}`;
    if (cached.length > 0) {
      const payload = typeof cached[0].payload === 'string' ? JSON.parse(cached[0].payload) : cached[0].payload;
      return json({
        cached: true,
        provenance: 'ai',
        model: cached[0].model,
        created_at: cached[0].created_at,
        payload: normalizePayload(payload, glossLanguage),
      });
    }

    // 2. Daily quota (survives across invocations - stored in the database).
    const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || 300;
    const used = await consumeDailyQuota(user.id, 'enrich');
    if (used > dailyLimit) {
      throw new HttpError(
        429,
        'rate-limited',
        `Daily AI enrichment limit reached (${dailyLimit} per user). The limit resets tomorrow.`,
      );
    }

    // 3. Call the model.
    const raw = await callGemini(buildPrompt({ languageName, languageCode: language, term, glossLanguage }));
    const payload = normalizePayload(raw, glossLanguage);

    await sql()`
      INSERT INTO knowledge.enrichment_cache (language_code, term, schema_version, payload, model)
      VALUES (${language}, ${term}, ${SCHEMA_VERSION}, ${JSON.stringify(payload)}::jsonb, ${GEMINI_MODEL})
      ON CONFLICT (language_code, term, schema_version) DO NOTHING`;

    return json({
      cached: false,
      provenance: 'ai',
      model: GEMINI_MODEL,
      created_at: new Date().toISOString(),
      payload,
    });
  },
});

export const config = { path: '/api/enrich' };
