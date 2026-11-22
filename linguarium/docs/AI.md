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
