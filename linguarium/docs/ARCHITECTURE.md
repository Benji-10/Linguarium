# Architecture

## Components

```
┌──────────────────────────── Browser (SPA, installable PWA) ───────────────────────────┐
│  src/main.mjs            boot: auth → data loaders → router → shell                    │
│  src/core/auth.mjs       custom auth UI logic on @netlify/identity (headless)         │
│  src/core/router.mjs     hash router (no server rewrites; works offline)               │
│  src/core/store.mjs      observable app state                                          │
│  src/core/idb.mjs        IndexedDB: offline cache + change queue + enrichment cache    │
│  src/core/sync.mjs       queue flush through /api/sync (conflict reporting)             │
│  src/shared/*.mjs        FSRS-5, tokenizer, status model, difficulty, parsers (pure)   │
│  src/views/*.mjs         dashboard, discover, reading, reader, review, ...             │
└───────────────┬───────────────────────────────────────────────────────────────────────┘
                │ same-origin fetch (nf_jwt session cookie rides along)
┌───────────────▼───────────── Netlify Functions v2 (netlify/functions) ──────────────────┐
│  lib/identity.mjs   requireUser(): server-side verified identity (@netlify/identity)  │
│  lib/db.mjs         Neon serverless driver (HTTP mode, no connection state)            │
│  lib/http.mjs       handler wrapper, JSON errors, validation                           │
│  lib/ratelimit.mjs  per-user daily quotas stored in the database                      │
│  lib/sync-core.mjs  idempotent review-event application (shared by /reviews, /sync)     │
│  *.mjs endpoints    languages, profiles, entries, reviews, texts, reading, grammar,    │
│                    collections, collection-items, enrich, ai-status, progress,        │
│                    sync, export, account                                               │
└───────────────┬───────────────────────────────────────────────────────────────────────┘
                │ DATABASE_URL (server-side only)
┌───────────────▼────────────── Neon PostgreSQL ────────────────────────────────────────┐
│  schema knowledge   shared language data (languages, grammar structures, shared texts, │
│                     enrichment cache) — never contains per-user rows                   │
│  schema user_data   everything owned by one user, keyed by the verified identity id    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Key decisions

**No SPA framework.** The specification asks for static hosting with functions for
privileged operations. A vanilla ES-module app bundled by esbuild keeps the surface
small, the deploy trivial and the failure modes boring. The UI is built from a small
design system (`src/ui/components.mjs`) with safe HTML templating (all interpolations
escaped by default).

**The scheduler runs in the client.** FSRS is a pure module (`src/shared/fsrs.mjs`).
This is what makes offline review possible: the queue works without a network and
replays later. The server stores the resulting states and validates ownership and
sanity — it never re-derives learning decisions from untrusted input, and it never
trusts a client-supplied user id (identity comes from the verified session only).

**Append-only review log.** Every review event carries a client-generated UUID; the
server inserts with `ON CONFLICT DO NOTHING` and then upserts the memory state.
Replays are no-ops, so offline sync can never double-count or overwrite progress.

**Two database schemas.** `knowledge.*` is shareable across all users and contains no
user rows; `user_data.*` is private and every row carries the verified user id. This
makes future multi-user content sharing safe by construction.

**Static assets + service worker.** `dist/` is precached (app shell); `/api/*` is
explicitly never cached by the service worker — user data is cached in IndexedDB by
the app itself, where staleness and conflict rules are explicit.

**AI is a peripheral, not an organ.** The single call site is `/api/enrich`; results
are cached per (language, term) for the whole deployment; a per-user daily quota is
enforced in the database; without the API key the endpoint answers 503 with a clear
code and the client renders AI sections as disabled, never broken. See docs/AI.md.

## Security model

- All privileged endpoints resolve the user server-side from the verified Netlify
  Identity session (`lib/identity.mjs`). Client-supplied user ids are ignored.
- All parameters are validated (`lib/http.mjs`, `lib/util.mjs`); writes check
  ownership before mutating.
- API responses are `Cache-Control: no-store`.
- The service worker never caches `/api/*` or `/.netlify/*`.
- Secrets (`DATABASE_URL`, `GEMINI_API_KEY`) exist only as Netlify environment
  variables; `.env` is gitignored and only used by `netlify dev`.
- User content is HTML-escaped by default in every view (`html`` ` in
  `src/ui/components.mjs`); raw markup is only produced by trusted internal templates.

## Sizing notes

- The bundle is ~135 KB (minified, including the identity client) — no framework.
- Functions are per-request; the Neon HTTP driver matches that model (no pool state).
- One Gemini call per (language, term) per deployment, ever (cache table) — the
  free-tier quota goes far.
