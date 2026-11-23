# The AI contract

AI is a peripheral organ, not a vital one. This document is the contract that the
implementation follows; if a future change violates it, the change is wrong.

## Model

Exactly one model: **`gemini-3.1-flash-lite`** (pinned by the platform specification,
hard-coded in `netlify/functions/ai-status.mjs` and used by `enrich.mjs`). No other
model is introduced without an explicit decision.

## Optional by design

- Without `GEMINI_API_KEY`, `/api/enrich` answers **503 with code `ai-not-configured`**
  and `/api/ai-status` reports `available: false`.
- The client renders AI sections as *explicitly disabled* with a short explanation —
  never as errors, never as missing features. Every core feature (accounts, languages,
  collections, reading, review, progress, export) works with no key.
- The Gemini key exists only as a Netlify environment variable; it is never shipped to
  the client.

## What AI may and may not do

| May | May not |
| --- | --- |
| definitions, readings, example sentences, usage notes for a single term | see any other user data (it receives one term + language name only) |
| a mnemonic, clearly separated from etymology | present a mnemonic as the word's history |
| report etymology **only when grounded in established knowledge**, with an explicit confidence | invent etymology, guess cognates, dress speculation as fact |
| answer "unknown" with a note | fabricate a source |

The prompt (`buildPrompt` in `netlify/functions/enrich.mjs`) encodes these rules;
`normalizePayload` then hard-normalizes the response (unknown etymology becomes
`text: null, confidence: "unknown"`).

## Cost control

- **Cache:** results are stored in `knowledge.enrichment_cache` keyed by
  (language, term, schema version). One call per term per deployment, ever — across
  all users.
- **Quota:** per-user daily limit enforced in `user_data.rate_limits`
  (`GEMINI_DAILY_LIMIT`, default 300). Exceeding it answers 429 with a clear message.
- **Timeout:** 30 s abort.
- **Structured output:** the response schema is enforced via `responseSchema`, so the
  model must return parseable, well-shaped JSON.

## Labelling in the UI

Every AI-produced text renders with an *AI generated* badge. Etymology from the model
renders under "Etymology (unverified AI claim)" or as "No reliable etymology
available" — see docs/CONTENT.md for the full provenance policy.

## Text adaptation (`POST /api/adapt`, phase 3)

Same contract, one more capability: re-leveling a chosen text toward a target
difficulty band computed against the user's own knowledge state.

- The model sees: the text itself (fetched server-side, ≤ 12,000 characters), the
  target band, the language, and two bounded term lists derived from that text
  (known / unknown terms for this learner, ≤ 150 each) plus a familiarity percentage.
  It never sees other user data.
- The result is stored as a **new user text with provenance `ai`** — never
  `verified` — keeping the original work's author, source URL, license and topic,
  plus an adaptation note naming the model, the target band and the model's own
  summary of changes. The original text is never modified.
- No cache (adaptations are personal): the daily quota applies (action `adapt`),
  with a 60 s timeout. Longer than 12,000 characters answers 413 with guidance to
  split the text first — no silent truncation.
- Without `GEMINI_API_KEY`: 503 `ai-not-configured`, and reading works exactly as
  before; the button explains itself instead of erroring.

## Text generation (`POST /api/generate-text`, phase 3 refinement)

Same contract, one more capability: writing a **new** reading text for a learner who
wants material a language's open sources do not cover (or wants personalized
material). The platform's content rules apply in full:

- The model sees: the topic, the kind (story / news-style report / essay / dialogue /
  letter), the length band, the target difficulty band, the language name, and two
  bounded term lists (this learner's known terms and in-learning terms) — nothing
  else from their data.
- **Lengths are hard word-count requirements**, not adjectives: short 200–350,
  medium 450–700, long 1000–1500 words (or script equivalents), each with an
  explicit floor ("do NOT stop before N words - write the FULL text"), and the
  response carries an explicit `maxOutputTokens` budget so a long text is never
  silently clipped to a stub.
- **Topics can be left empty**: the server picks one from a curated pool
  (engineering, magic, mystery, neighbours…) and checks the topics already
  generated for this learner (`user_data.texts`, provenance `ai`) so nothing
  repeats; when the pool is exhausted it resets and says so in the response
  (`generation.auto_topic`, `generation.pool_reset`). The chosen topic is stored
  on the text and reported back, so a daily story is one click.
- The difficulty band defaults from the profile's **self-declared level** when the
  learner has set one (complete beginner → comfortable … fluent → challenge);
  it is still just a default the learner can override.
- The prompt **bans the conventional AI register explicitly**: no "tapestry", "delve",
  "in the realm of"; no rule-of-three constructions; no summarizing or moralizing
  closing paragraph; varied sentence lengths; concrete detail; no lists inside prose;
  invented people/events only, never real-world facts presented as true (a
  "news-style" text is explicitly fiction for reading practice).
- The result is stored as a user text with **provenance `ai`** and a generation note
  naming the model, the topic, the kind and the band. It is never presented as real
  content.
- No cache (generations are personal); daily quota (action `generate`,
  `GEMINI_GENERATE_DAILY_LIMIT`, default 40); 60 s timeout; structured output
  (`title` + `body`) enforced with `responseSchema`.
- Without `GEMINI_API_KEY`: 503 `ai-not-configured` with a pointer to the other
  import paths; the Generate tab is simply not shown in the import center.

## Dictionary lookup is NOT AI (`/api/lookup`)

Word lookups are deliberately **not** model calls: the chain is the shared lexicon →
the server-side cache → Wiktionary REST definitions (+ dictionaryapi.dev for
English), all keyless, free and attributed. The AI analysis remains a separate,
explicit button (labelled unverified) for when the dictionaries have nothing — so
quotas are predictable and dictionary content keeps its own license (CC BY-SA).
Online lookups have their own daily quota (`LOOKUP_DAILY_LIMIT`, default 500).
