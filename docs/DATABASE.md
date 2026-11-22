# Database

Neon PostgreSQL. Two schemas separate shared language knowledge from per-user data —
a hard requirement of the platform: **shared knowledge must never mix with user rows.**

- `knowledge` — languages (with tokenizer configs), grammar structures, shared reading
  texts, enrichment cache. No user ids anywhere (custom languages are the one
  exception: `created_by` scopes visibility to their creator).
- `user_data` — every row carries `user_id` (the verified Netlify Identity id):
  profiles, collections + items, vocabulary entries, FSRS memory, review log, texts,
  reading progress, encounters, grammar progress, rate limits.

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

## Initialization

`npm run db:init` (or paste `sql/schema.sql` + `sql/seed.sql` into the Neon SQL editor).
All statements are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), so re-running
is safe.
