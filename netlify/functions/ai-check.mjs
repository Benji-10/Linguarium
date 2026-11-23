/**
 * POST /api/ai-check - optional AI feedback on a writing-practice answer
 * (Gemini).
 *
 * Same rules as enrichment:
 *   - The ONLY model is "gemini-3.1-flash-lite".
 *   - No GEMINI_API_KEY => 503 with a clear code; writing practice keeps
 *     working through self-assessment alone.
 *   - Per-user daily quota (shared budget with enrichment, action 'check').
 *   - Nothing is cached (answers are unique) and nothing is stored.
 *   - Everything the model says is returned labelled provenance 'ai':
 *     unverified machine analysis, never a grade of record. The honest
 *     self-assessment the learner gives themselves always counts more.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { consumeDailyQuota } from './lib/ratelimit.mjs';
import { GEMINI_MODEL } from './ai-status.mjs';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    naturalness: { type: 'STRING', enum: ['natural', 'mostly-natural', 'unnatural'] },
    corrections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          issue: { type: 'STRING' },
          original: { type: 'STRING' },
          suggestion: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['issue', 'suggestion'],
      },
    },
    did_use_terms: { type: 'ARRAY', items: { type: 'STRING' } },
    translation: { type: 'STRING' },
    note: { type: 'STRING' },
  },
  required: ['naturalness', 'corrections'],
};

function buildPrompt({ languageName, languageCode, prompt, answer, terms, glossLanguage }) {
  return [
    `You are giving writing feedback to a language learner.`,
    `Language being learned: ${languageName} (code: ${languageCode}).`,
    `The learner was asked: ${prompt}`,
    terms.length > 0 ? `The answer was supposed to use these terms: ${terms.join(', ')}.` : '',
    `The learner's answer: "${answer}"`,
    `Write feedback (explanations) in language "${glossLanguage}".`,
    '',
    'Rules, in order of importance:',
    '1. corrections: list concrete language issues in the answer (grammar, word choice, spelling, register). Each needs a short explanation. If the answer is fine, return an empty array.',
    '2. did_use_terms: list which of the requested terms actually appear (in any correct inflected form). If none were requested, return an empty array.',
    '3. translation: a natural translation of the learner answer as written (preserving their meaning, not correcting it).',
    '4. note: at most two sentences of encouragement or advice. Never invent grammar rules; if unsure about a point, say so briefly.',
    '5. Do not give grades or scores.',
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
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(502, 'ai-provider-error', `The AI provider rejected the request (status ${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? '').join('').trim();
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
    const data = await body(req);
    const language = requireString(data, 'language_code', { max: 16 });
    const prompt = requireString(data, 'prompt', { max: 600 });
    const answer = requireString(data, 'answer', { max: 4000 });
    const terms = Array.isArray(data.terms) ? data.terms.filter((t) => typeof t === 'string').slice(0, 6).map((t) => t.slice(0, 200)) : [];
    const glossLanguage = requireString(data, 'gloss_language', { max: 16, optional: true }) ?? 'en';

    if (!process.env.GEMINI_API_KEY) {
      throw new HttpError(
        503,
        'ai-not-configured',
        'AI feedback is not configured on this deployment (GEMINI_API_KEY missing). Self-assessment works fully without it.',
      );
    }

    const langRows = await sql()`SELECT code, name FROM knowledge.languages WHERE code = ${language}`;
    const languageName = langRows[0]?.name ?? language;

    const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || 300;
    const used = await consumeDailyQuota(user.id, 'check');
    if (used > dailyLimit) {
      throw new HttpError(429, 'rate-limited', `Daily AI limit reached (${dailyLimit} per user). The limit resets tomorrow.`);
    }

    const raw = await callGemini(
      buildPrompt({ languageName, languageCode: language, prompt, answer, terms, glossLanguage }),
    );

    const str = (v, n) => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, n) : null);
    const corrections = Array.isArray(raw.corrections)
      ? raw.corrections
          .filter((c) => c && typeof c === 'object' && typeof c.suggestion === 'string')
          .slice(0, 8)
          .map((c) => ({
            issue: str(c.issue, 120) ?? 'language issue',
            original: str(c.original, 300),
            suggestion: c.suggestion.slice(0, 300),
            explanation: str(c.explanation, 400),
          }))
      : [];

    return json({
      provenance: 'ai',
      model: GEMINI_MODEL,
      created_at: new Date().toISOString(),
      payload: {
        naturalness: ['natural', 'mostly-natural', 'unnatural'].includes(raw.naturalness) ? raw.naturalness : null,
        corrections,
        did_use_terms: Array.isArray(raw.did_use_terms) ? raw.did_use_terms.filter((t) => typeof t === 'string').slice(0, 6) : [],
        translation: str(raw.translation, 600),
        note: str(raw.note, 600),
      },
    });
  },
});
