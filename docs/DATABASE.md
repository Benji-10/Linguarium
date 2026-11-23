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
2. **Locally:** `npm run db:init` (schema + seed) or `npm run db:seed` (seed only).
   `node scripts/db-init.mjs --dry-run` validates the SQL files without a database.
3. **Neon SQL editor:** paste `sql/schema.sql` followed by `sql/seed.sql`.

Everything is idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING` on natural
keys: language+title for texts, language+name for grammar structures), so
re-running any of these on a populated database is safe and duplicates nothing.
Statement splitting is shared between the local script and the admin function
(`netlify/functions/lib/sqlsplit.mjs`), which is dollar-quote aware, so seed
bodies may contain semicolons and apostrophes freely.
