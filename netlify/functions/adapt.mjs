/**
 * POST /api/adapt - automatic adaptation of a text you choose (phase 3).
 *
 * Simplifies or re-levels a text toward a target difficulty band computed
 * against the USER's knowledge state. Following the content policy
 * (docs/CONTENT.md):
 *   - The result is ALWAYS stored as an adapted user text that keeps the
 *     original work's metadata (author, source URL, license, topic) and
 *     carries an adaptation note describing what changed and which model
 *     produced it.
 *   - Provenance of the stored text is 'ai' (unverified), never 'verified'.
 *   - The ONLY model is "gemini-3.1-flash-lite"; without GEMINI_API_KEY the
 *     endpoint answers 503 and reading works exactly as before.
 *   - Per-user daily quota (action 'adapt'), nothing is cached (the result
 *     depends on the user's personal knowledge state).
 *
 * The text itself is fetched server-side (ownership verified); the client's
 * known/unknown term lists only shape the prompt, they are never trusted as
 * data.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { consumeDailyQuota } from './lib/ratelimit.mjs';
import { GEMINI_MODEL } from './ai-status.mjs';

const MAX_INPUT_CHARS = 12000;
const MAX_OUTPUT_CHARS = 24000;

const BAND_GUIDE = {
  comfortable:
    'comfortable band: nearly every word should already be familiar to this learner. Replace or gloss the unknown terms with the simplest natural equivalents, shorten long sentences, keep the narrative plain and flowing.',
  stretch:
    'stretch band: mostly familiar with a few new elements. Keep the vocabulary largely intact, simplify only unusually long or nested sentences, and keep at most the listed unknown terms as the new material to learn.',
  challenge:
    'challenge band: keep the vocabulary and sentence structure close to the original; only smooth out constructions that are truly extreme. New terms stay in the text.',
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    adapted_body: { type: 'STRING' },
    summary_of_changes: { type: 'STRING' },
  },
  required: ['adapted_body', 'summary_of_changes'],
};

function listOfStrings(v, max, len) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t) => typeof t === 'string' && t.trim() !== '')
    .map((t) => t.trim().slice(0, 60))
    .slice(0, max)
    .filter((t) => t.length <= len);
}

function buildPrompt({ languageName, languageCode, textBody, title, targetBand, knownTerms, unknownTerms, difficultyHint }) {
  return [
    `You are adapting a reading text for one language learner.`,
    `Language of the text: ${languageName} (code: ${languageCode}).`,
    `Title of the text: ${title}.`,
    `The learner's estimated familiarity with this text: ${Math.round(difficultyHint * 100)}% of its distinct terms are already known to them.`,
    `Target difficulty: ${BAND_GUIDE[targetBand]}`,
    knownTerms.length > 0
      ? `Terms the learner already knows (prefer these when rephrasing; do not simplify them away): ${knownTerms.join(', ')}.`
      : '',
    unknownTerms.length > 0
      ? `Terms in the text the learner does NOT know yet (these are the candidates to simplify, replace or support): ${unknownTerms.join(', ')}.`
      : '',
    '',
    'Rules, in order of importance:',
    '1. Return the COMPLETE adapted text in adapted_body - never excerpts, never a translation, never a summary. Same language as the original.',
    '2. Preserve the meaning, the voice and the narrative order of the original. Do not invent content, do not add commentary, do not add glossaries inside the text.',
    '3. Keep proper nouns (names, places, titles) unchanged.',
    '4. summary_of_changes: one or two honest sentences in English describing what you changed and why it serves the target band.',
    '5. If the text is already at or below the target band, say so in summary_of_changes and return the text essentially unchanged.',
    '',
    'Original text:',
    textBody,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(502, 'ai-provider-error', `The AI provider rejected the request (status ${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? '').join('').trim();
  if (!text) throw new HttpError(502, 'ai-empty', 'The AI model returned an empty response.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'ai-invalid-json', 'The AI response could not be parsed as JSON.');
  }
}

export default handler({
  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    const textId = requireString(data, 'text_id', { max: 64 });
    const kind = requireString(data, 'kind', { max: 10 });
    if (kind !== 'user' && kind !== 'shared') {
      throw new HttpError(400, 'invalid-field', 'Field "kind" must be "user" or "shared".');
    }
    const targetBand = requireString(data, 'target_band', { max: 12 });
    if (!['comfortable', 'stretch', 'challenge'].includes(targetBand)) {
      throw new HttpError(400, 'invalid-field', 'Field "target_band" must be comfortable, stretch or challenge.');
    }
    const knownTerms = listOfStrings(data.known_terms, 150, 60);
    const unknownTerms = listOfStrings(data.unknown_terms, 150, 60);
    const familiarity = Number(data.familiarity);
    const difficultyHint = Number.isFinite(familiarity) ? Math.min(1, Math.max(0, familiarity)) : 0.5;

    if (!process.env.GEMINI_API_KEY) {
      throw new HttpError(
        503,
        'ai-not-configured',
        'Text adaptation is not configured on this deployment (GEMINI_API_KEY missing). Reading and everything else works without it.',
      );
    }

    // Fetch the text server-side: the user's own, or the shared library.
    let original;
    if (kind === 'user') {
      const rows = await sql()`
        SELECT id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic
        FROM user_data.texts
        WHERE id = ${textId} AND user_id = ${user.id} AND deleted_at IS NULL`;
      if (rows.length === 0) throw new HttpError(404, 'not-found', 'Text not found.');
      original = rows[0];
    } else {
      const rows = await sql()`
        SELECT id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic
        FROM knowledge.shared_texts WHERE id = ${textId}`;
      if (rows.length === 0) throw new HttpError(404, 'not-found', 'Shared text not found.');
      original = rows[0];
    }

    if ((original.body ?? '').length > MAX_INPUT_CHARS) {
      throw new HttpError(
        413,
        'text-too-long',
        `This text is longer than the ${MAX_INPUT_CHARS} characters the adapter can handle in one pass. Split it into shorter texts first (Settings of your copy stay with each part).`,
      );
    }

    const langRows = await sql()`SELECT code, name FROM knowledge.languages WHERE code = ${original.language_code}`;
    const languageName = langRows[0]?.name ?? original.language_code;

    const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || 300;
    const used = await consumeDailyQuota(user.id, 'adapt');
    if (used > dailyLimit) {
      throw new HttpError(429, 'rate-limited', `Daily AI limit reached (${dailyLimit} per user). The limit resets tomorrow.`);
    }

    const raw = await callGemini(
      buildPrompt({
        languageName,
        languageCode: original.language_code,
        textBody: original.body ?? '',
        title: original.title,
        targetBand,
        knownTerms,
        unknownTerms,
        difficultyHint,
      }),
    );

    const adaptedBody = typeof raw?.adapted_body === 'string' ? raw.adapted_body.trim().slice(0, MAX_OUTPUT_CHARS) : '';
    const summary =
      typeof raw?.summary_of_changes === 'string' && raw.summary_of_changes.trim() !== ''
        ? raw.summary_of_changes.trim().slice(0, 600)
        : 'The model did not summarize the changes.';
    if (adaptedBody.length < 20) {
      throw new HttpError(502, 'ai-empty', 'The AI model returned an unusable adaptation (empty body). The original text is untouched.');
    }

    // Store as ADAPTED content: the original work's metadata stays intact and
    // the adaptation is described and labelled. Provenance 'ai', never 'verified'.
    const newTitle = `${original.title} - adapted (${targetBand})`.slice(0, 300);
    const adaptationNote = (
      `Adapted by ${GEMINI_MODEL} for the ${targetBand} band of this learner's current knowledge state. ` +
      `Summary: ${summary} ` +
      `Original: "${original.title}"${original.adaptation_note ? ` (itself an adaptation: ${original.adaptation_note})` : ''}. ` +
      `AI-generated, unverified - compare against the original.`
    ).slice(0, 2000);
    const rows = await sql()`
      INSERT INTO user_data.texts
        (user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic)
      VALUES
        (${user.id}, ${original.language_code}, ${newTitle}, ${adaptedBody}, ${original.author}, ${original.source_url},
         ${original.license ?? 'unspecified'}, ${adaptationNote}, 'ai', ${original.topic ?? null})
      RETURNING id, user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, created_at, updated_at`;

    return json(
      {
        text: rows[0],
        adaptation: {
          source_kind: kind,
          source_id: original.id,
          source_title: original.title,
          target_band: targetBand,
          model: GEMINI_MODEL,
          provenance: 'ai',
          summary,
        },
      },
      201,
    );
  },
});

export const config = { path: '/api/adapt' };
