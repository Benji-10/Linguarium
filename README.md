# Linguarium

**A free, language-agnostic learning platform.** Structured study, natural reading,
active practice and FSRS spaced repetition in one place — built around the idea that
all of it should share a single knowledge state for the learner, and that no language
(least of all small or constructed ones like Toki Pona) should be an afterthought.

> Working title. The name is a single constant in `src/main.mjs`'s companion files
> (`src/ui/layout.mjs`, `manifest.webmanifest`) if you ever want to change it.

Status: **Phases 1, 2 and 3 are implemented and tested.** The specification is
fully covered (see [docs/ROADMAP.md](docs/ROADMAP.md) for what each phase
shipped, including the honest edges).

---

## What is in the box (all three phases)

| Area | What works |
| --- | --- |
| **Accounts** | Fully custom authentication UI on Netlify Identity (login, signup with email confirmation, password recovery incl. reset flow, optional OAuth) — the default widget is never loaded. |
| **Languages** | ~58 language presets with per-language tokenizer behaviour, plus **custom language definitions** (name, code, direction, tokenizer) so any language works, including constructed ones. |
| **Profiles** | Per-language profile with difficulty mode (Comfortable / Stretch / Challenge), gloss language (definitions are never assumed to be in English) and a **self-declared level** (complete beginner → fluent — your own statement per language; Settings shows a transparent vocabulary-based suggestion next to it, never auto-applied). |
| **Vocabulary** | Personal entries with provenance, readings, examples and your own notes; one shared knowledge state for reading, review and collections. |
| **Collections** | Create and import word lists from CSV / JSON / plain text. **Unparsed entries are retained, not discarded**, shown for repair. Export to CSV/JSON any time. |
| **FSRS review** | FSRS-5 spaced repetition with **three separate ability dimensions** (recognition, recall, production — production is typed, not multiple-choice). |
| **Reading** | Interactive reader: click any word (**words, not characters, for Japanese/Chinese** — dictionary segmentation from the shared lexicon + your own vocabulary), keep it, self-assess prior knowledge honestly, see per-reader difficulty estimates with a transparent breakdown. **Furigana/pinyin render as real ruby** above the words (toggleable, never inline; readings also come from dictionary lookups and AI analyses made while reading, and the reader says so honestly when a text has no readings yet), and the library shows **only the language you are studying** — no cross-language mixing. **Long texts are paginated** (Apple-Books-style page turner with keyboard arrows, a page/percent readout and a per-page position save) so imported novels stay fast and comfortable. |
| **Import center** | Six ways to bring texts in: paste, upload `.txt`/`.html`/`.epub` (parsed in your browser), a URL (fetched server-side, previewed, you confirm the metadata), the **open library** (Project Gutenberg via Gutendex, Wikisource, Wikipedia, Wikinews, curated news RSS — all keyless free APIs in your study language, source author/license attached automatically), AI generation, and passages saved straight from other apps via the PWA **share target**. The Gutenberg catalogue uses the fast Gutendex route (browse-by-language with pagination), its search degrades honestly to a filtered shelf when Gutendex's search stalls, and book texts fall back to the **pglaf.org mirror** when gutenberg.org throttles (both labelled). |
| **Listening** | Read & listen: browser speech synthesis follows the transcript sentence by sentence (honestly labelled as synthesized, with live voice-availability reporting), or your own audio items referenced by https URL with mandatory source and licence metadata — never stored in the database. |
| **Knowledge** | Vocabulary lookup with everything known about a term: entry, memory state per dimension, verified etymology when sourced, AI analysis clearly labelled separately, your notes — plus the **online dictionary chain** (shared lexicon → Wiktionary / dictionaryapi.dev, attributed and cached offline) with AI as the explicit fallback. |
| **Word lookup** | Shared lexicon first, then **online dictionaries** (Wiktionary REST definitions for every language + dictionaryapi.dev for English — keyless, free, attributed with their licenses), cached server-side and offline in IndexedDB. The AI analysis stays an explicit, labelled, user-triggered action. |
| **Grammar** | Structures as first-class citizens with a four-layer progression (encountered → recognized → understood → independent use) **and generated cloze/recall exercises** from each structure's example sentences — correct answers advance the stage. Korean and Chinese structure sets are seeded. |
| **Seeded library** | 32 texts across 14 languages with topic tags and honest provenance (public-domain classics transcribed with sources, original demonstration texts labelled as such) — including **six Korean texts** and three Chinese texts. |
| **Progress** | Dashboard aggregates: due counts, streaks, knowledge-state distribution (reflecting real performance, never "opened a card"). |
| **Offline / PWA** | Installable, offline reading/review/lookup/practice via IndexedDB + service worker, change queue with conflict-safe sync (learning progress is never silently overwritten), Background Sync wake-up where supported, portable JSON backup **export and import** (merge rules, nothing newer overwritten). |
| **AI (optional)** | Vocabulary enrichment via **Gemini `gemini-3.1-flash-lite`** — structured output, cached per term, daily per-user quota — plus optional writing-practice feedback (`/api/ai-check`), always labelled unverified. Without `GEMINI_API_KEY` every core feature still works; AI sections show as explicitly disabled. |
| **Writing practice** | Prompts built from the words and grammar you are actually learning; free-text answers with honest self-assessment feeding the production dimension of FSRS through the same review pipeline as everything else. |
| **Text adaptation (p3)** | One click in the reader re-levels a text toward a target difficulty band computed against **your** knowledge state (Gemini, optional). Stored as adapted content: the original's author/source/license intact, an adaptation note, provenance `ai` — never `verified`. The original is never modified. |
| **Personalization (p3)** | Per-language, per-dimension target retention (0.70–0.97); optional daily caps for reviews and new cards — enforced server-side, reported honestly in the session. Optional FSRS-5 parameter refitting from your own review history (deterministic optimizer, ≥300 scored intervals, loss reported, fully reversible). |
| **Community pipeline (p3)** | Contribute texts, grammar structures and lexicon entries with mandatory license + source fields; moderated via an admin key; approved items enter the shared tables as `community` provenance — never `verified`. The shared lexicon shows in Knowledge lookups, clearly separated from your data. |
| **Language resources (p3)** | A curated catalog of open frequency lists, pronunciation references, corpora and dictionaries per language (Wiktionary/Wikipedia/Tatoeba per preset language + CMUdict, JMdict, CC-CEDICT, The Latin Library, Tekstaro, tokipona.org, FrequencyWords...), every entry with license metadata. Links only — data is never copied in. |
| **Themes (p3)** | Light / dark / system mode with a topbar quick toggle, times six accent skins (teal, ocean, forest, rose, amber, violet) — every skin legible in both modes. A real icon set (book + speech-bubble mark) in SVG + PNG. The injected Netlify badge is hidden defensively. |

### Non-negotiable principles baked into the code

- **No fabricated etymology, ever.** AI is prompted to report etymology only when it is
  established knowledge; anything it returns is labelled *AI-generated, unverified* and
  rendered separately from mnemonics and from sourced etymology. When no reliable source
  exists, the UI says exactly that.
- **Provenance everywhere.** Every piece of content carries one of five levels:
  verified / community / automated / ai / user. Badges are rendered wherever content appears.
- **Not English-centric, not CEFR-centric.** Difficulty is estimated from *your* known-word
  set, sentence length and text length (labelled "automated analysis"), never from a CEFR
  sticker on the material.
- **Server-side identity only.** Functions resolve the user from the verified Netlify
  Identity session; a user id in a request body is never trusted.
- **No third-party trackers, no font CDNs, no analytics.** System font stacks, same-origin API.
- **Free to run.** Static hosting + serverless functions + a free-tier Neon database; the
  only optional paid dependency is the Gemini API key, and the app is complete without it.

---

## Architecture in one paragraph

Static SPA (vanilla ES modules, bundled by esbuild — no framework, no build complexity)
served from `dist/`; all privileged work happens in **Netlify Functions v2**
(`netlify/functions/*.mjs`) behind `/api/*`; data lives in **Neon PostgreSQL** split into
two schemas — `knowledge` (shared language data, never per-user) and `user_data` (everything
owned by a user, keyed by the verified identity id); the FSRS scheduler is a pure shared
module that runs client-side so it works offline; review events are append-only and
idempotent, which is what makes offline sync safe.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/DATABASE.md](docs/DATABASE.md) ·
[docs/AI.md](docs/AI.md) ·
[docs/OFFLINE-AND-SYNC.md](docs/OFFLINE-AND-SYNC.md).

---

## Deploying from this repository (GitHub → Netlify)

You need: a GitHub account, a Netlify account (free), and a Neon database (free tier).

### 1. Push this project to GitHub

```bash
git init
git add .
git commit -m "Linguarium phase 1"
# create the repository on github.com, then:
git remote add origin git@github.com:<you>/linguarium.git
git push -u origin main
```

### 2. Create the Neon database

1. Sign up at [neon.com](https://neon.com) and create a project.
2. Copy the **pooled** connection string (`...-pooler...neon.tech/...?sslmode=require`).

### 3. Populate the database (schema + seed content)

The app needs the schema and seed data in the database before the shared library,
grammar catalog and language presets appear. Three equivalent ways, pick one:

- **From the deployed site (easiest):** set `ADMIN_KEY` in the Netlify UI (a long
  random string, e.g. `openssl rand -hex 32`), then once after the first deploy:

  ```bash
  curl -X POST https://<your-site>.netlify.app/api/admin-seed -H "x-admin-key: $ADMIN_KEY"
  ```

  Safe to call repeatedly: every statement is idempotent, and the endpoint only
  ever creates shared `knowledge` data and empty `user_data` tables — it can
  never touch user content. Without `ADMIN_KEY` the endpoint answers 404.
- **Automatically on every deploy (recommended):** the Netlify build command runs
  `node scripts/db-auto.mjs` after the bundle build: it hashes `sql/schema.sql` +
  `sql/seed.sql`, and whenever they changed it applies them (the same idempotent
  runner as `db:init`), recording the hash in `knowledge.db_state`. It skips
  silently when `DATABASE_URL` is unset and never fails a deploy over a database
  hiccup - warnings land in the build log. Pull a change that touches SQL and the
  deploy syncs the database for you; nothing to run by hand.
- **Locally:** `cp .env.example .env`, fill `DATABASE_URL`, then `npm run db:init`
  (schema + seed) or `npm run db:seed` (seed only, after schema creation), or
  `npm run db:auto` (the hash-guarded sync the build uses; `--force` re-applies).
  `node scripts/db-init.mjs --dry-run` validates the SQL files without a database.
- **In the Neon SQL editor:** paste the contents of `sql/schema.sql` followed by
  `sql/seed.sql`.

Validate the SQL without any database (embedded Postgres, no connection):

```bash
node scripts/validate-seed.mjs         # schema + seed apply cleanly, topics/grammar present
node scripts/validate-phase2-sql.mjs   # the phase-2 statements run on real Postgres
node scripts/validate-phase3-sql.mjs   # phase-3 tables/columns, seeds and catalog coverage
```

Upgrading a database seeded before phase 3: re-run the same seed - it is
idempotent (IF NOT EXISTS / ON CONFLICT), it only adds the personalization
columns, the community tables, the shared lexicon starter entries and the
resource catalog.

Upgrading a database seeded before this refinement round: re-run the seed the
same way - it adds the `knowledge.lookup_cache` table (online dictionary cache)
and the **Japanese / Chinese core lexicon** (~300 + ~150 terms with readings)
that powers word segmentation, ruby readings and lookup for no-space scripts.

The seed loads ~58 language presets, a shared reading library (public-domain
classics with full citations + demonstration texts), a starter grammar catalog,
starter shared-lexicon entries and the open-resources catalog. Everything seeded
carries provenance labels; `verified` entries cite the page they were
transcribed from, `community` entries say exactly what they are.

### 4. Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub** → pick the repository.
2. Build settings (auto-filled from `netlify.toml`, verify anyway):
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables (Site configuration → Environment variables):
   - `DATABASE_URL` — the Neon pooled connection string (**required**)
   - `GEMINI_API_KEY` — optional; without it AI features are disabled but everything else works
   - `GEMINI_DAILY_LIMIT` — optional per-user daily enrichment quota (default 300)
   - `GEMINI_GENERATE_DAILY_LIMIT` — optional per-user daily AI text generation quota (default 40)
   - `LOOKUP_DAILY_LIMIT` — optional per-user daily online dictionary lookup quota (default 500)
   - `ADMIN_KEY` — optional; enables `POST /api/admin-seed` (see step 3)
4. Deploy.

### 5. Enable Netlify Identity

1. Site configuration → **Identity** → Enable.
2. Under Registration: allow open signups (or invite-only, your choice).
3. Recommendation: keep **email confirmation** on (the app handles both flows).
4. Optional: add OAuth providers (Google, GitHub, …). The custom login screen picks them up automatically.

### 6. (Optional) remove the "powered by Netlify" badge

Netlify injects a small badge iframe (`#nl-badge-frame`) into served HTML when the
site badge is enabled. The app already hides it defensively (a CSS rule plus a
runtime removal in `src/core/theme.mjs`), but the clean fix is to turn it off at
the source: **Site configuration → Domain management → Netlify badge → disable**
(older UI: Settings → Domain management → Netlify badge). Either way it never
shows in your app.

### 7. (Optional) moderate community contributions

Phase 3 lets users submit texts, grammar structures and lexicon entries for the
shared library (`#/contribute`). Submissions wait in a moderation queue; nothing
is published without an approval. Moderation uses the same `ADMIN_KEY` you set
in step 3 (constant-time compared; without the key the routes answer 404):

```bash
# list the pending queue (payloads included):
curl https://<your-site>.netlify.app/api/contribute?pending=1 -H "x-admin-key: $ADMIN_KEY"

# approve (inserts into the shared tables, provenance 'community'):
curl -X PUT https://<your-site>.netlify.app/api/contribute      -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json"      -d '{"id": "<submission-uuid>", "action": "approve", "note": "license and source check out"}'

# reject (with a note the contributor sees):
curl -X PUT https://<your-site>.netlify.app/api/contribute      -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json"      -d '{"id": "<submission-uuid>", "action": "reject", "note": "no source; license unclear"}'
```

Check the license and provenance claims before approving - the same rules the seed
data follows (docs/CONTENT.md). Approved items appear in Discover, Grammar and
Knowledge for everyone, always labelled `community`, never `verified`.

That's it — visit your site, create an account, add a language, import a word list,
read something, review. The seeded shared library (public-domain classics + demo
content), the shared lexicon starter entries and the resource catalog appear once
the database has been populated (step 3).

## Local development

Requires Node.js ≥ 20 (the build uses Node 22 on Netlify — see `.nvmrc`).

```bash
npm install                # esbuild, @netlify/identity, @neondatabase/serverless
cp .env.example .env       # fill DATABASE_URL (local or Neon); GEMINI_API_KEY optional
npm run db:init            # create schema + seed (npm run db:seed = seed only)

# Upgrading a database seeded before phase 2 or 3:
# re-run the same command - the seed is idempotent (IF NOT EXISTS / ON CONFLICT),
# it only adds the new texts, topics, grammar structures, personalization
# columns, community tables, lexicon starter entries and resource catalog.
# The refinement round adds the lookup cache table and the Japanese/Chinese
# core lexicon (readings for segmentation + ruby).
# The hardening round adds the level column on language_profiles (self-declared
# proficiency) and ~290 reading-bearing Japanese/Chinese lexicon entries.
# Deployed sites need none of this: `npm run build` now ends with db-auto sync.
npm run db:seed
npm run dev                # netlify dev (via npx): dist + functions + local Identity
```

`netlify-cli` is deliberately **not** a dependency (it needs Node ≥ 22.13 and is
not needed on the build server); `npm run dev` fetches it on demand via `npx`,
or install it globally yourself (`npm i -g netlify-cli`).

`netlify dev` provides the local Identity endpoint that `@netlify/identity` expects
(sign-up, login and email flows work locally). For a quick static preview without
functions, `npm run dev:ui` builds and serves `dist` on port 3000.

## Testing and checks

```bash
npm test     # 91 unit tests: FSRS-5 identities and behaviour, tokenizer, parsers,
             # status thresholds, difficulty bands, offline merge rules, SQL splitter,
             # the FSRS parameter fitter, retention-aware scheduling, contribution
             # validation
npm run check # node --check over every source and function file
npm run build # esbuild bundle into dist/
```

## Project layout

```
├── index.html, manifest.webmanifest, sw.js    PWA shell (sw stamped per build)
├── netlify.toml                               build & functions configuration (Node 22)
├── sql/schema.sql, sql/seed.sql               Neon schema (knowledge + user_data) and seeds
├── scripts/                                   build (incl. seed bundle), serve, db-init
│                                              (schema / seed / --dry-run), syntax check,
│                                              SQL validators, render-icons.py (regenerates
│                                              the PNG icon set from icons/icon.svg)
├── src/
│   ├── shared/         pure learning logic: FSRS-5, tokenizer, status model,
│   │                   difficulty estimation, import parsers, merge rules (all tested)
│   ├── core/           auth (@netlify/identity), api client, store, router,
│   │                   IndexedDB cache + offline queue, sync, data loaders
│   ├── ui/             design system, components, app shell
│   └── views/          dashboard, discover, reading, reader, review, practice,
│                       listening, knowledge, grammar, collections, contribute,
│                       settings, auth
└── netlify/functions/  v2 functions: identity guard, db access, all /api/* endpoints,
                         admin-seed (populates the DB, ADMIN_KEY gated),
                         Gemini enrichment (cache + quota + honesty rules),
                         ai-check (writing feedback), adapt (text adaptation),
                         fsrs-optimize (parameter fitting), contribute (+ moderation),
                         resources, lexicon, sync, export, account deletion
```

## Documentation set

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — components, data flow, security model
- [docs/DATABASE.md](docs/DATABASE.md) — schema, status thresholds, sync conflict rules
- [docs/CONTENT.md](docs/CONTENT.md) — content policy, provenance levels, etymology rules, difficulty modes
- [docs/AI.md](docs/AI.md) — the AI contract: what it may and may not do
- [docs/OFFLINE-AND-SYNC.md](docs/OFFLINE-AND-SYNC.md) — offline behaviour, queue, backup format
- [docs/PRIVACY.md](docs/PRIVACY.md) — what is stored, what is never collected, deletion
- [docs/ROADMAP.md](docs/ROADMAP.md) — phase 2 and 3 plans

## License

MIT (see [LICENSE](LICENSE)). The seeded demonstration content is described and sourced in
`sql/seed.sql`; replace it with properly licensed material before running an open community.

## Credits

- **FSRS** — the FSRS-5 scheduler implementation follows the open-spaced-repetition
  community specification ([awesome-fsrs wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)).
- **Netlify Identity** via the headless [`@netlify/identity`](https://www.npmjs.com/package/@netlify/identity) library.
- **Neon PostgreSQL** via the [`@neondatabase/serverless`](https://neon.com/docs/serverless/serverless-driver) driver.
- **Gemini** (`gemini-3.1-flash-lite`) — optional enrichment only.
