# Database

Neon PostgreSQL. Two schemas separate shared language knowledge from per-user data —
a hard requirement of the platform: **shared knowledge must never mix with user rows.**

- `knowledge` — languages (with tokenizer configs), grammar structures, shared reading
  texts, enrichment cache. No user ids anywhere (custom languages are the one
  exception: `created_by` scopes visibility to their creator).
- `user_data` — every row carries `user_id` (the verified Netlify Identity id):
  profiles, collections + items, vocabulary entries, FSRS memory, review log, texts,
  reading progress, encounters, grammar progress, rate limits.

Phase 2 additions (all applied idempotently by re-running the seed):
- `knowledge.shared_texts.topic` — subject tag (classic, fable, poem, daily-life,
  story, dialogue, letter, culture) used by Discover's topic filter.
- `user_data.texts.topic` — the same tag for your own texts.
- `user_data.texts.audio_url` — listening environment: a REFERENCE to audio at its
  source (https URL, licence asserted by the user). Audio is never stored in the
  database as a binary blob.
- `user_data.rate_limits.window_day` — the column was renamed from `window`,
  which is a reserved keyword in PostgreSQL and broke the original
  `CREATE TABLE` on real databases (caught by validating the SQL against
  embedded Postgres in `scripts/validate-seed.mjs`).

`POST /api/import` restores a backup with merge rules that never overwrite
newer learning progress (see netlify/functions/import.mjs for the exact
conflict semantics; skipped items are reported, not silently dropped).

## Status model (how a collection item / entry is classified)

Statuses reflect **demonstrated performance**, never "the card was opened":

| Status | Meaning |
| --- | --- |
| unencountered | no reviews and no recorded encounters |
| learning | activity exists, below the recognition threshold |
| recognized | recognition stability ≥ 7 days |
| reliably recalled | recall stability ≥ 7 days |
| mastered | production stability ≥ 15 days over ≥ 3 repetitions, **or** both recall and recognition ≥ 30 days |
| due (overlay) | any dimension is due for review |

Stability is the FSRS interval (days) at which predicted recall is 90%. The thresholds
live in one place (`STATUS_THRESHOLDS` in `src/shared/constants.mjs`) and are enforced
in `src/shared/status.mjs` + tests.

## Grammar progression

`user_data.grammar_progress.stage` ∈ encountered → recognized → understood →
independent use. Four layers, independent of any vocabulary entry.

## Offline sync rules (enforced in netlify/functions/sync.mjs)

1. **Review events are append-only with client UUIDs.** `INSERT ... ON CONFLICT (id)
   DO NOTHING`; applying the same event twice is a no-op. Learning progress can never
   be duplicated or overwritten by sync.
2. **Mutable rows apply only when the client version is strictly newer**
   (`updated_at` guard). Otherwise the server version is kept and the outcome is
   *reported* as a conflict — the UI tells you what was kept. Never silent.
3. **Deletions are tombstones** (`deleted_at`), so a delayed sync can never resurrect
   deleted data.

The same rules are mirrored client-side in `src/shared/merge.mjs` for the UI copy.

## Backup format (`/api/export`)

```jsonc
{
  "format": "linguarium-backup",
  "version": 1,
  "exported_at": "…",
  "user": { "id": "…", "display_name": "…" },
  "profiles": [ … ],
  "collections": [ { …, "items": [ … ] } ],
  "entries": [ { …, "memories": { "recognition": { "stability": …, "difficulty": …, "reps": …, "lapses": …, "last_review": …, "due": … } } } ],
  "review_log": [ … up to the 10,000 most recent events … ],
  "texts": [ … ],
  "reading_progress": [ … ],
  "grammar_progress": [ … ],
  "encounters": { "total": …, "last_30_days": … }
}
```

Plain JSON, documented, one file — nothing is locked in.

## Initialization and population

Three equivalent ways to create the schema and load the seed data (languages,
shared reading texts, grammar structures — all shared `knowledge` data, never
user content):

1. **From the deployed site:** set `ADMIN_KEY` in the Netlify UI, then
   `curl -X POST https://<site>.netlify.app/api/admin-seed -H "x-admin-key: $ADMIN_KEY"`.
   The function runs `sql/schema.sql` then `sql/seed.sql` (embedded at build time
   into `netlify/functions/lib/seed-bundle.mjs` by `scripts/build.mjs`), first as a
   single atomic transaction, falling back to statement-by-statement execution
   when it meets pre-existing objects. Timing-safe key comparison; without
   `ADMIN_KEY` the endpoint answers 404.
2. **Automatically on deploy:** the Netlify build command runs `node scripts/db-auto.mjs`
   after bundling the app. It hashes `sql/schema.sql` + `sql/seed.sql`; when the hash
   differs from the one stored in `knowledge.db_state` (key `schema+seed`), it applies
   both files with the same idempotent runner as `db:init` and records the new hash.
   Unchanged SQL → no-op; no `DATABASE_URL` → skip; a database error never fails the
   deploy (a warning lands in the build log; `--strict` flips that for local use).
3. **Locally:** `npm run db:init` (schema + seed) or `npm run db:seed` (seed only),
   or `npm run db:auto` (the hash-guarded sync; `--force` re-applies).
   `node scripts/db-init.mjs --dry-run` validates the SQL files without a database.
4. **Neon SQL editor:** paste `sql/schema.sql` followed by `sql/seed.sql`.

Everything is idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING` on natural
keys: language+title for texts, language+name for grammar structures), so
re-running any of these on a populated database is safe and duplicates nothing.
Statement splitting is shared between the local script and the admin function
(`netlify/functions/lib/sqlsplit.mjs`), which is dollar-quote aware, so seed
bodies may contain semicolons and apostrophes freely.

## Hardening-round additions (applied idempotently by the same seed)

- `knowledge.db_state` — one row per build-time migration key (`schema+seed`):
   the content hash of the SQL files last applied by `scripts/db-auto.mjs`, so a
   re-deploy of unchanged SQL is a no-op. Bookkeeping only, no user data.
- `user_data.language_profiles.level` — self-declared proficiency per language
   (`complete-beginner` / `beginner` / `intermediate` / `advanced` / `fluent`,
   NULL = not declared). A starting-point statement the learner owns (Settings
   shows a transparent vocabulary-count suggestion next to it, never applied
   automatically); it defaults the AI generator's difficulty band and is
   displayed honestly next to the knowledge-state-based difficulty estimates,
   which remain computed, not declared.
- ~290 reading-bearing `knowledge.lexicon` entries for Japanese (everyday plus
  Meiji-era literary forms) and Chinese (HSK 3–4 everyday) — they widen both the
  dictionary segmentation and the furigana/pinyin ruby layer for imported texts
  that carry no inline annotations. Community provenance, verify note included,
  exactly like the core lexicon block.

## Phase 3 additions (all applied idempotently by re-running the seed)

- `user_data.language_profiles` gains scheduling preferences:
  - `retention_recognition` / `retention_recall` / `retention_production` (REAL,
    0.70–0.97, default 0.9) — the target retention per ability dimension. The FSRS
    interval is chosen so predicted recall stays above it.
  - `daily_new_limit` / `daily_review_limit` (INTEGER, NULL = no cap) — enforced
    server-side in `GET /api/reviews` and always *reported* in the response, so the
    UI can say why a session is smaller than the raw due queue. Caps count today's
    totals per language across dimensions.
- `user_data.fsrs_weights` — the 19 FSRS-5 parameters fitted to the user's own review
  history by `POST /api/fsrs-optimize` (deterministic hill climb in
  `netlify/functions/lib/fsrs-opt.mjs`). Stored with the review count and the loss
  before/after, provenance `automated`. Included in the backup export; restored by
  import only when the account has none (never silently overwriting).
- `knowledge.contribution_queue` — the community content pipeline: submissions of
  texts, grammar structures and lexicon entries, with mandatory license + source
  (author or source URL) validated in `netlify/functions/lib/contribute-validate.mjs`.
  `submitted_by` references the contributor (the only place a user id touches this
  table); `status` ∈ pending / approved / rejected. Nothing reaches the shared tables
  without `PUT /api/contribute` (admin, `x-admin-key`, same guard as admin-seed).
  Approved items are inserted with provenance `community` — never `verified`.
- `knowledge.lexicon` — shared community term definitions (one row per language +
  term, `UNIQUE`). Consulted by `GET /api/lexicon` for the Knowledge lookup, always
  rendered separately from the user's own entries, always `community`-badged with
  license + source. `mode=dictionary` returns the full term + reading list for a
  language: the client builds the CJK segmentation dictionary (and ruby readings)
  from it, cached in IndexedDB.
- `knowledge.lookup_cache` — the online dictionary chain cache: one row per
  (language, term) per deployment holding the mapped entries from Wiktionary /
  dictionaryapi.dev, with the source name, source URL and license. Written by
  `GET|POST /api/lookup` only on a fresh fetch; the client additionally caches
  lookups in IndexedDB (`lookups` store, DB v2) so looked-up words are readable
  offline.
- `knowledge.resources` — the curated catalog of open per-language resources
  (frequency lists, pronunciation references, corpora, dictionaries) with license
  metadata, seeded through `sql/seed.sql` (Wiktionary/Wikipedia/Tatoeba generated
  per preset language plus hand-curated entries). Links point at the source; the data
  itself is never copied in.
