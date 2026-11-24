-- =====================================================================
-- Linguarium database schema (Neon PostgreSQL)
--
-- Two schemas keep data domains strictly separated, as required by the
-- platform specification:
--
--   knowledge  - shared language knowledge (languages, lexicon, grammar,
--               enrichment cache, shared reading texts). No per-user data.
--   user_data  - everything owned by a user (profiles, collections,
--               vocabulary entries, FSRS memory states, review history,
--               reading progress, encounters). Every row carries user_id.
--
-- The user id is the Netlify Identity user id (a UUID). It is ALWAYS taken
-- from the server-side verified identity of the request, never from the
-- request body.
--
-- Run this file with sql/seed.sql, either through `npm run db:init`
-- or by pasting it into the Neon SQL editor.
-- All statements end with ";" followed by a newline, which the db-init
-- script relies on. Avoid semicolons at end-of-line inside literals.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS user_data;

-- ---------------------------------------------------------------
-- knowledge schema (shared)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge.languages (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  native_name   TEXT,
  script        TEXT,
  direction     TEXT NOT NULL DEFAULT 'ltr',
  tokenizer     JSONB NOT NULL DEFAULT '{}'::jsonb,
  kind          TEXT NOT NULL DEFAULT 'preset',
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Source edition for custom languages (2026-11): the wiki language code
-- the open library should read for a language whose own code is not a wiki
-- edition ("srs" -> reads "simple"). Defined once in Settings, used by the
-- catalog, the import endpoint and the library tab. Nullable: unset means
-- the custom-edition providers ask for a code per search, as before.
ALTER TABLE knowledge.languages ADD COLUMN IF NOT EXISTS source_edition TEXT;

CREATE TABLE IF NOT EXISTS knowledge.grammar_structures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  name          TEXT NOT NULL,
  summary       TEXT,
  explanation   TEXT,
  examples      JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance    TEXT NOT NULL DEFAULT 'community',
  source_ref    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Natural key so that seeding (and re-seeding) is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grammar_structures_lang_name
  ON knowledge.grammar_structures (language_code, name);

CREATE TABLE IF NOT EXISTS knowledge.shared_texts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  author        TEXT,
  source_url    TEXT,
  license       TEXT NOT NULL DEFAULT 'unspecified',
  adaptation_note TEXT,
  provenance    TEXT NOT NULL DEFAULT 'community',
  source_ref    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Natural key so that seeding (and re-seeding) is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_texts_lang_title
  ON knowledge.shared_texts (language_code, title);
-- For databases initialized from an earlier schema version.
ALTER TABLE knowledge.shared_texts ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- Cache for AI enrichment results. Keyed by (language, term, schema version)
-- so the same term is never sent to the model twice for all users.
CREATE TABLE IF NOT EXISTS knowledge.enrichment_cache (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code  TEXT NOT NULL,
  term           TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  payload        JSONB NOT NULL,
  model          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (language_code, term, schema_version)
);

-- ---------------------------------------------------------------
-- user_data schema (per user)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_data.users (
  id          UUID PRIMARY KEY,
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_data.language_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  language_code  TEXT NOT NULL,
  difficulty_mode TEXT NOT NULL DEFAULT 'stretch',
  gloss_language  TEXT NOT NULL DEFAULT 'en',
  level          TEXT, -- self-declared proficiency: complete-beginner | beginner | intermediate | advanced | fluent
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, language_code)
);

-- Migration guard for databases initialized before the level column existed
-- (re-running is a no-op; seed.sql repeats it for seed-only runs).
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS level TEXT;

CREATE TABLE IF NOT EXISTS user_data.collections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  language_code TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  source_type   TEXT NOT NULL DEFAULT 'user',
  source_url    TEXT,
  license       TEXT NOT NULL DEFAULT 'unspecified',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_data.collection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  raw           TEXT NOT NULL,
  parsed        BOOLEAN NOT NULL DEFAULT FALSE,
  term          TEXT,
  definition    TEXT,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collection_items_coll ON user_data.collection_items (collection_id, position);

CREATE TABLE IF NOT EXISTS user_data.vocab_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  language_code  TEXT NOT NULL,
  term           TEXT NOT NULL,
  normalized     TEXT NOT NULL,
  reading        TEXT,
  part_of_speech TEXT,
  definition     TEXT,
  gloss_language TEXT,
  example        TEXT,
  notes          TEXT,
  source_type    TEXT NOT NULL DEFAULT 'user',
  source_ref     TEXT,
  collection_id  UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vocab_entries_user_lang_norm
  ON user_data.vocab_entries (user_id, language_code, normalized)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_lang ON user_data.vocab_entries (user_id, language_code) WHERE deleted_at IS NULL;

-- One row per (entry, ability dimension). Dimensions: recognition, recall, production.
-- State values are produced by the FSRS-5 scheduler (src/shared/fsrs.mjs).
CREATE TABLE IF NOT EXISTS user_data.fsrs_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  entry_id    UUID NOT NULL,
  dimension   TEXT NOT NULL,
  stability   REAL NOT NULL,
  difficulty  REAL NOT NULL,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_review TIMESTAMPTZ,
  due         TIMESTAMPTZ,
  UNIQUE (entry_id, dimension)
);
CREATE INDEX IF NOT EXISTS idx_fsrs_memory_due ON user_data.fsrs_memory (user_id, due);

-- Append-only review history. The id is generated on the client (a UUID), which
-- makes the log naturally idempotent and conflict-free during offline sync:
-- syncing the same event twice is a no-op (ON CONFLICT DO NOTHING).
CREATE TABLE IF NOT EXISTS user_data.review_log (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL,
  entry_id     UUID NOT NULL,
  dimension    TEXT NOT NULL,
  rating       INTEGER NOT NULL,
  stability    REAL,
  difficulty   REAL,
  elapsed_days REAL,
  next_due     TIMESTAMPTZ,
  reviewed_at  TIMESTAMPTZ NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_log_user_time ON user_data.review_log (user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_log_entry ON user_data.review_log (entry_id);

CREATE TABLE IF NOT EXISTS user_data.texts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  language_code  TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  author         TEXT,
  source_url     TEXT,
  license        TEXT NOT NULL DEFAULT 'unspecified',
  adaptation_note TEXT,
  provenance     TEXT NOT NULL DEFAULT 'user-imported',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_texts_user ON user_data.texts (user_id, language_code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_data.reading_progress (
  user_id     UUID NOT NULL,
  text_kind   TEXT NOT NULL,
  text_id     UUID NOT NULL,
  position    JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, text_kind, text_id)
);

-- Every time a term is seen in a reading text (or looked up), an encounter is
-- logged. Encounters are the lowest layer of the learning progression
-- (encountered -> recognized -> understood -> independent use).
CREATE TABLE IF NOT EXISTS user_data.encounters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  entry_id    UUID,
  term_raw     TEXT NOT NULL,
  text_kind   TEXT,
  text_id     UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_encounters_user_time ON user_data.encounters (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_entry ON user_data.encounters (entry_id);

CREATE TABLE IF NOT EXISTS user_data.grammar_progress (
  user_id      UUID NOT NULL,
  structure_id UUID NOT NULL,
  stage        TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, structure_id)
);

-- Simple daily quota per user and action, for AI-enrichment rate limiting.
CREATE TABLE IF NOT EXISTS user_data.rate_limits (
  user_id UUID NOT NULL,
  window_day DATE NOT NULL,
  action  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, window_day, action)
);

-- ---------------------------------------------------------------
-- Phase 3: finer personalization.
--
-- Per-language-profile scheduling preferences: target retention for each
-- ability dimension (FSRS intervals are chosen so predicted recall stays
-- above it) and optional daily caps. NULL limits mean "no cap".
-- ---------------------------------------------------------------

ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS retention_recognition REAL NOT NULL DEFAULT 0.9;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS retention_recall       REAL NOT NULL DEFAULT 0.9;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS retention_production    REAL NOT NULL DEFAULT 0.9;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS daily_new_limit     INTEGER;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS daily_review_limit  INTEGER;

-- FSRS-5 parameters fitted to the user's own review history (phase 3).
-- Weights are the 19 FSRS-5 values; the fit is honest: loss values and the
-- review count it was trained from are stored alongside and shown in the UI.
CREATE TABLE IF NOT EXISTS user_data.fsrs_weights (
  user_id        UUID PRIMARY KEY,
  weights        JSONB NOT NULL,
  trained_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_count   INTEGER NOT NULL DEFAULT 0,
  loss_default   REAL,
  loss_optimized REAL,
  provenance     TEXT NOT NULL DEFAULT 'automated'
);

-- ---------------------------------------------------------------
-- Phase 3: community content pipeline (shared knowledge).
--
-- Contribution queue: texts, grammar structures and lexicon entries
-- submitted by users, held for moderation. Nothing enters the shared
-- knowledge tables without an explicit admin approval; every submission
-- carries mandatory provenance and license fields.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge.contribution_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL,                -- text | grammar | lexicon
  language_code TEXT NOT NULL,
  title         TEXT,
  payload       JSONB NOT NULL,
  submitted_by  UUID NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  moderated_at  TIMESTAMPTZ,
  moderator_note TEXT,
  provenance    TEXT NOT NULL DEFAULT 'community',
  license       TEXT NOT NULL DEFAULT 'unspecified',
  source_url    TEXT
);
CREATE INDEX IF NOT EXISTS idx_contribution_queue_status ON knowledge.contribution_queue (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_contribution_queue_submitter ON knowledge.contribution_queue (submitted_by);

-- Shared lexicon: community-maintained term definitions (consulted by the
-- Knowledge lookup next to the user's own entries and AI enrichment).
CREATE TABLE IF NOT EXISTS knowledge.lexicon (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  term          TEXT NOT NULL,
  reading       TEXT,
  part_of_speech TEXT,
  definition    TEXT NOT NULL,
  gloss_language TEXT NOT NULL DEFAULT 'en',
  provenance    TEXT NOT NULL DEFAULT 'community',
  source_url    TEXT,
  license       TEXT NOT NULL DEFAULT 'unspecified',
  source_ref    TEXT,
  created_by    UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lexicon_lang_term
  ON knowledge.lexicon (language_code, term);
CREATE INDEX IF NOT EXISTS idx_lexicon_lang ON knowledge.lexicon (language_code);

-- Online-lookup cache (Wiktionary / free dictionary APIs): the server-side
-- cache of the word-lookup chain (local lexicon -> online dictionaries ->
-- user-triggered AI fallback). One row per (language, term) per deployment.
CREATE TABLE IF NOT EXISTS knowledge.lookup_cache (
  language_code TEXT NOT NULL,
  term          TEXT NOT NULL,
  payload       JSONB NOT NULL,
  source        TEXT NOT NULL,
  source_url    TEXT,
  license       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (language_code, term)
);

-- Extended language resources: a curated catalog of open frequency lists,
-- pronunciation references, learner corpora and dictionaries per language,
-- each with license metadata. Links point at the source - the data itself
-- is never copied in (docs/CONTENT.md).
CREATE TABLE IF NOT EXISTS knowledge.resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  kind          TEXT NOT NULL,               -- dictionary | pronunciation | corpus | frequency_list
  name          TEXT NOT NULL,
  description   TEXT,
  source_url    TEXT NOT NULL,
  license       TEXT NOT NULL,
  provenance    TEXT NOT NULL DEFAULT 'community',
  source_ref    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_lang_name
  ON knowledge.resources (language_code, name);
