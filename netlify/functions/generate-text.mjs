/**
 * POST /api/generate-text - generate a reading text with Gemini (phase 3).
 *
 * The platform's AI rules apply: the only model is "gemini-3.1-flash-lite",
 * it is optional (503 without GEMINI_API_KEY), per-user daily quota, nothing
 * is silently cached (the result is personal), and the stored text carries
 * provenance 'ai' plus an honest generation note.
 *
 * The prompt engineering is explicit about NOT writing in the conventional
 * AI register: no "tapestry/delve/realm" vocabulary, no rule-of-three
 * triads, no moralizing summary paragraph, varied sentence lengths,
 * concrete detail, and a real structure for the requested kind.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow, languageFor } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { consumeDailyQuota } from './lib/ratelimit.mjs';
import { GEMINI_MODEL } from './ai-status.mjs';

const MAX_OUTPUT_CHARS = 40000;

// Output token budget: JSON mode + a high ceiling so a 'long' text is never
// clipped by the default (a clipped JSON response = the short texts users
// reported). 8192 tokens comfortably fits 1,500 words in any script.
const MAX_OUTPUT_TOKENS = 8192;

const KINDS = {
  story: {
    label: 'Story',
    guide:
      'A short story with a real arc: a situation, a complication that turns it, and an ending that resolves it concretely (not a moral lesson). Show the place and the people through specific detail instead of describing emotions abstractly.',
  },
  news: {
    label: 'News-style report',
    guide:
      'A news-style report: the most important facts first, then context, then detail. Concrete who/what/where/when. Frame uncertain things as uncertain. This is reading practice material, NOT real news - it must be plausible fiction about an invented but ordinary event.',
  },
  essay: {
    label: 'Short essay',
    guide:
      'A short essay that makes one clear, arguable point and supports it with two concrete examples or observations. No straw men, no survey of everything ever written about the topic.',
  },
  dialogue: {
    label: 'Dialogue',
    guide:
      'A dialogue between two people with distinct voices and a reason to talk. Natural interruptions, disagreements, small talk that does something. Stage directions in parentheses only where needed.',
  },
  letter: {
    label: 'Letter',
    guide:
      'A letter from a specific person to a specific person about something that matters to both. Personal voice, references to shared history, one or two stories inside it.',
  },
};

// Word counts are HARD minimums, not adjectives: the model gets the range
// and an explicit floor, and the response has the token budget to reach it.
const LENGTH_GUIDE = {
  short: '200-350 words (or the equivalent length in the target script). Do NOT stop before 200 words.',
  medium: '450-700 words (or the equivalent length in the target script). Do NOT stop before 450 words.',
  long: '1000-1500 words (or the equivalent length in the target script). Do NOT stop before 1000 words - write the FULL text, never a summary or an outline of one.',
};

const BAND_GUIDE = {
  comfortable: 'Use only very common vocabulary and short, plain sentences.',
  stretch: 'Use mostly everyday vocabulary with a handful of less common words; sentences of varied but moderate length.',
  challenge: 'Use natural, rich vocabulary and full sentence variety; keep it comprehensible to an advanced learner.',
};

/**
 * The topic pool for auto-picked ("surprise me") generations: generic,
 * durable themes - engineering, magic, mystery and neighbours - phrased as
 * concrete scene seeds so the model has somewhere to start. The server
 * checks the learner's already-generated topics and picks an UNUSED one;
 * when the whole pool has been used it resets (and says so).
 */
const TOPIC_POOL = [
  'engineering', 'magic', 'mystery', 'cooking', 'the ocean', 'a long train ride',
  'a village postman', 'baking bread', 'a night market', 'gardening',
  'an old radio', 'mountain weather', 'a library card', 'a lost umbrella',
  'friendship', 'a chess club', 'repairing a bicycle', 'a fishing harbour',
  'learning to swim', 'a summer storm', 'a small bakery', 'honey and bees',
  'a rooftop at dusk', 'a broken clock', 'maps', "a potter's studio",
  "grandmother's recipe", 'a border town', 'a lighthouse keeper',
  'school in another era', 'a city park in autumn', 'the first snow',
  'a stray cat', 'a bookshop on a rainy day', 'a bus driver', 'farming',
  'a concert rehearsal', "an inventor's notebook", 'a river ferry',
  'translation mistakes', 'an old photograph', 'a mountain guide',
  'a hospital night shift', 'a train station cafe', 'paper and ink',
  "a distant cousin's wedding", 'a science fair', 'a blackout',
  'learning an instrument', 'a snowbound inn', 'birdwatching',
  'a bar of soap', "a tailor's shop", 'a long walk home', 'new year food',
  'a ferry crossing', 'an allotment garden', 'a museum guard', 'starlight',
  'a bicycle courier', 'a quiet dentist', 'a seagull problem', 'a wool shop',
  'hot springs', 'an apology letter', 'a water mill', 'an eclipse',
  'a family car trip', 'a rooftop garden', 'an old well', 'a village doctor',
  'a delivery drone', 'a raincoat', 'a passport found', 'tides',
  'a wine cellar', 'a school reunion', 'a stuck elevator', 'a bridge at dawn',
  'an honest tax inspector', 'a cat with two homes', 'a fruit stall', 'a night bus',
];

/** Pick a topic the learner has NOT generated before (case-insensitive
 *  against the topics already stored on their AI texts). Returns
 *  { topic, reset } - reset=true means the pool was exhausted and started over. */
async function pickFreshTopic(userId) {
  const rows = await sql()`
    SELECT DISTINCT topic FROM user_data.texts
    WHERE user_id = ${userId} AND provenance = 'ai' AND topic IS NOT NULL`;
  const used = new Set(rows.map((r) => String(r.topic ?? '').toLowerCase().trim()).filter(Boolean));
  const fresh = TOPIC_POOL.filter((t) => !used.has(t));
  const pool = fresh.length > 0 ? fresh : TOPIC_POOL;
  const topic = pool[Math.floor(Math.random() * pool.length)];
  return { topic, reset: fresh.length === 0 };
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    body: { type: 'STRING' },
  },
  required: ['title', 'body'],
};

function listOfStrings(v, max) {
  if (!Array.isArray(v)) return [];
  return v.filter((t) => typeof t === 'string' && t.trim() !== '').map((t) => t.trim().slice(0, 60)).slice(0, max);
}

function buildPrompt({ languageName, languageCode, topic, kind, length, band, knownTerms, unknownTerms, glossLanguage }) {
  return [
    `You are writing ONE complete reading text for a language learner.`,
    `Language of the text: ${languageName} (code: ${languageCode}). Every word of the text itself is in that language.`,
    `Topic (from the learner): ${topic}`,
    `Kind: ${KINDS[kind].label}. ${KINDS[kind].guide}`,
    `Length: ${LENGTH_GUIDE[length]} This is a word-count requirement, not a suggestion - write the whole text, complete, with a real ending.`,
    `Difficulty: ${BAND_GUIDE[band]}`,
    knownTerms.length > 0 ? `Prefer using these terms the learner already knows where natural: ${knownTerms.join(', ')}.` : '',
    unknownTerms.length > 0
      ? `Weave in a few of these terms the learner is currently learning (about one per paragraph, used meaningfully): ${unknownTerms.join(', ')}.`
      : '',
    glossLanguage !== 'en' ? `The title may optionally be glossed in ${glossLanguage}; the body stays in ${languageName}.` : '',
    '',
    'Style rules - these are strict:',
    '1. Do NOT write in the conventional AI register: no "tapestry", "delve", "in the realm of", "it is important to note", "navigate the landscape", no empty intensifiers.',
    '2. Do NOT build everything in threes; do NOT end with a summarizing or moralizing closing paragraph; no "In conclusion".',
    '3. Vary sentence length deliberately: some very short, some long. Concrete nouns and observed detail over abstractions.',
    '4. NO lists, headings, or bullet points inside the text - flowing prose (or pure dialogue lines for a dialogue).',
    '5. NO invented real-world facts presented as true: people, places and events must be ordinary invented ones; a "news" piece is explicitly fiction for reading practice.',
    `6. The title is short and specific, in ${languageName}.`,
    '7. Return the complete text in "body". No preface, no explanation, no stopping early.',
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
        temperature: 0.9,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
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

    const languageCode = requireString(data, 'language_code', { max: 16 });
    const requestedTopic = requireString(data, 'topic', { max: 300, optional: true });
    const kind = requireString(data, 'kind', { max: 16 }) ?? 'story';
    const length = requireString(data, 'length', { max: 10 }) ?? 'medium';
    const band = requireString(data, 'target_band', { max: 12 }) ?? 'stretch';
    const glossLanguage = requireString(data, 'gloss_language', { max: 16, optional: true }) ?? 'en';
    const knownTerms = listOfStrings(data.known_terms, 120);
    const unknownTerms = listOfStrings(data.unknown_terms, 40);

    if (!KINDS[kind]) throw new HttpError(400, 'invalid-field', `Field "kind" must be one of ${Object.keys(KINDS).join(', ')}.`);
    if (!LENGTH_GUIDE[length]) throw new HttpError(400, 'invalid-field', 'Field "length" must be short, medium or long.');
    if (!BAND_GUIDE[band]) throw new HttpError(400, 'invalid-field', 'Field "target_band" must be comfortable, stretch or challenge.');

    if (!process.env.GEMINI_API_KEY) {
      throw new HttpError(
        503,
        'ai-not-configured',
        'AI text generation is not configured on this deployment (GEMINI_API_KEY missing). Import from the library, paste or upload texts - everything else works.',
      );
    }

    const language = await languageFor(languageCode);
    if (!language) throw new HttpError(404, 'language-not-found', 'Unknown language code.');
    const languageName = language.name ?? languageCode;

    const dailyLimit = Number(process.env.GEMINI_GENERATE_DAILY_LIMIT) || 40;
    const used = await consumeDailyQuota(user.id, 'generate');
    if (used > dailyLimit) {
      throw new HttpError(429, 'rate-limited', `Daily AI generation limit reached (${dailyLimit}). The limit resets tomorrow.`);
    }

    // Topic: given, or auto-picked without repeating anything already
    // generated for this learner.
    let topic = (requestedTopic ?? '').trim();
    let autoTopic = false;
    let poolReset = false;
    if (!topic) {
      const picked = await pickFreshTopic(user.id);
      topic = picked.topic;
      autoTopic = true;
      poolReset = picked.reset;
    }

    const raw = await callGemini(
      buildPrompt({ languageName, languageCode, topic, kind, length, band, knownTerms, unknownTerms, glossLanguage }),
    );

    const bodyText = typeof raw?.body === 'string' ? raw.body.trim().slice(0, MAX_OUTPUT_CHARS) : '';
    const title = typeof raw?.title === 'string' && raw.title.trim() !== '' ? raw.title.trim().slice(0, 300) : `${topic} (AI-generated ${KINDS[kind].label.toLowerCase()})`;
    if (bodyText.length < 80) {
      throw new HttpError(502, 'ai-empty', 'The AI model returned an unusable text (too short). Nothing was saved.');
    }

    const generationNote =
      `Generated by ${GEMINI_MODEL} on Linguarium (${autoTopic ? 'auto-picked' : 'learner-given'} topic: "${topic}", ${KINDS[kind].label.toLowerCase()}, ${length}, ${band} band, personalized to this learner's vocabulary). ` +
      `AI-generated content - unverified; the AI is an optional feature, provenance 'ai'.`;

    const rows = await sql()`
      INSERT INTO user_data.texts
        (user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic)
      VALUES
        (${user.id}, ${languageCode}, ${title}, ${bodyText}, null, null, 'unspecified', ${generationNote}, 'ai', ${topic.slice(0, 40)})
      RETURNING id, user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, created_at, updated_at`;

    return json(
      {
        text: rows[0],
        generation: { model: GEMINI_MODEL, kind, length, band, topic, auto_topic: autoTopic, pool_reset: poolReset },
      },
      201,
    );
  },
});

export const config = { path: '/api/generate-text' };
