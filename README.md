# Linguarium

**A free, language-agnostic learning platform.** Structured study, natural reading,
active practice and FSRS spaced repetition in one place — built around the idea that
all of it should share a single knowledge state for the learner, and that no language
(least of all small or constructed ones like Toki Pona) should be an afterthought.

> Working title. The name is a single constant in `src/main.mjs`'s companion files
> (`src/ui/layout.mjs`, `manifest.webmanifest`) if you ever want to change it.

Status: **Phase 1 and Phase 2 are implemented and tested.** Phase 3 remains
planned (see [docs/ROADMAP.md](docs/ROADMAP.md)).

---

## What is in the box (phases 1 + 2)

| Area | What works |
| --- | --- |
| **Accounts** | Fully custom authentication UI on Netlify Identity (login, signup with email confirmation, password recovery incl. reset flow, optional OAuth) — the default widget is never loaded. |
| **Languages** | ~58 language presets with per-language tokenizer behaviour, plus **custom language definitions** (name, code, direction, tokenizer) so any language works, including constructed ones. |
| **Profiles** | Per-language profile with difficulty mode (Comfortable / Stretch / Challenge) and gloss language — definitions are never assumed to be in English. |
| **Vocabulary** | Personal entries with provenance, readings, examples and your own notes; one shared knowledge state for reading, review and collections. |
| **Collections** | Create and import word lists from CSV / JSON / plain text. **Unparsed entries are retained, not discarded**, shown for repair. Export to CSV/JSON any time. |
| **FSRS review** | FSRS-5 spaced repetition with **three separate ability dimensions** (recognition, recall, production — production is typed, not multiple-choice). |
| **Reading** | Interactive reader: click any word (per-character for languages without spaces), keep it, self-assess prior knowledge honestly, see per-reader difficulty estimates with a transparent breakdown. The library follows the language you are studying (with an "All languages" toggle). |
| **Listening** | Read & listen: browser speech synthesis follows the transcript sentence by sentence (honestly labelled as synthesized, with live voice-availability reporting), or your own audio items referenced by https URL with mandatory source and licence metadata — never stored in the database. |
| **Knowledge** | Vocabulary lookup with everything known about a term: entry, memory state per dimension, verified etymology when sourced, AI analysis clearly labelled separately, your notes. |
| **Grammar** | Structures as first-class citizens with a four-layer progression (encountered → recognized → understood → independent use) **and generated cloze/recall exercises** from each structure's example sentences — correct answers advance the stage. Korean and Chinese structure sets are seeded. |
| **Seeded library** | 32 texts across 14 languages with topic tags and honest provenance (public-domain classics transcribed with sources, original demonstration texts labelled as such) — including **six Korean texts** and three Chinese texts. |
| **Progress** | Dashboard aggregates: due counts, streaks, knowledge-state distribution (reflecting real performance, never "opened a card"). |
| **Offline / PWA** | Installable, offline reading/review/lookup/practice via IndexedDB + service worker, change queue with conflict-safe sync (learning progress is never silently overwritten), Background Sync wake-up where supported, portable JSON backup **export and import** (merge rules, nothing newer overwritten). |
| **AI (optional)** | Vocabulary enrichment via **Gemini `gemini-3.1-flash-lite`** — structured output, cached per term, daily per-user quota — plus optional writing-practice feedback (`/api/ai-check`), always labelled unverified. Without `GEMINI_API_KEY` every core feature still works; AI sections show as explicitly disabled. |
| **Writing practice** | Prompts built from the words and grammar you are actually learning; free-text answers with honest self-assessment feeding the production dimension of FSRS through the same review pipeline as everything else. |

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
- **Locally:** `cp .env.example .env`, fill `DATABASE_URL`, then `npm run db:init`
  (schema + seed) or `npm run db:seed

# Validate the SQL without any database (embedded Postgres, no connection):
node scripts/validate-seed.mjs         # schema + seed apply cleanly, topics/grammar present
node scripts/validate-phase2-sql.mjs   # the phase-2 statements run on real Postgres` (seed only, after schema creation).
  `node scripts/db-init.mjs --dry-run` validates the SQL files without a database.
- **In the Neon SQL editor:** paste the contents of `sql/schema.sql` followed by
  `sql/seed.sql`.

The seed loads ~58 language presets, a shared reading library (public-domain
  classics with full citations + demonstration texts) and a starter grammar catalog.
Everything seeded carries provenance labels; `verified` entries cite the page they
were transcribed from, `community` entries say exactly what they are.

### 4. Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub** → pick the repository.
2. Build settings (auto-filled from `netlify.toml`, verify anyway):
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables (Site configuration → Environment variables):
   - `DATABASE_URL` — the Neon pooled connection string (**required**)
   - `GEMINI_API_KEY` — optional; without it AI features are disabled but everything else works
   - `GEMINI_DAILY_LIMIT` — optional per-user daily enrichment quota (default 300)
   - `ADMIN_KEY` — optional; enables `POST /api/admin-seed` (see step 3)
4. Deploy.

### 5. Enable Netlify Identity

1. Site configuration → **Identity** → Enable.
2. Under Registration: allow open signups (or invite-only, your choice).
3. Recommendation: keep **email confirmation** on (the app handles both flows).
4. Optional: add OAuth providers (Google, GitHub, …). The custom login screen picks them up automatically.

That's it — visit your site, create an account, add a language, import a word list,
read something, review. The seeded shared library (public-domain classics + demo
content) appears once the database has been populated (step 3).

## Local development

Requires Node.js ≥ 20 (the build uses Node 22 on Netlify — see `.nvmrc`).

```bash
npm install                # esbuild, @netlify/identity, @neondatabase/serverless
cp .env.example .env       # fill DATABASE_URL (local or Neon); GEMINI_API_KEY optional
npm run db:init            # create schema + seed (npm run db:seed = seed only)

# Upgrading a database seeded before phase 2:
# re-run the same command - the seed is idempotent (IF NOT EXISTS / ON CONFLICT),
# it only adds the new texts, topics, grammar structures and columns.
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
npm test     # 67 unit tests: FSRS-5 identities and behaviour, tokenizer, parsers,
             # status thresholds, difficulty bands, offline merge rules, SQL splitter
npm run check # node --check over every source and function file
npm run build # esbuild bundle into dist/
```

## Project layout

```
├── index.html, manifest.webmanifest, sw.js    PWA shell (sw stamped per build)
├── netlify.toml                               build & functions configuration (Node 22)
├── sql/schema.sql, sql/seed.sql               Neon schema (knowledge + user_data) and seeds
├── scripts/                                   build (incl. seed bundle), serve, db-init
│                                              (schema / seed / --dry-run), syntax check
├── src/
│   ├── shared/         pure learning logic: FSRS-5, tokenizer, status model,
│   │                   difficulty estimation, import parsers, merge rules (all tested)
│   ├── core/           auth (@netlify/identity), api client, store, router,
│   │                   IndexedDB cache + offline queue, sync, data loaders
│   ├── ui/             design system, components, app shell
│   └── views/          dashboard, discover, reading, reader, review, practice (p2),
│                       listening (p2), knowledge, grammar, collections, settings, auth
└── netlify/functions/  v2 functions: identity guard, db access, all /api/* endpoints,
                         admin-seed (populates the DB, ADMIN_KEY gated),
                         Gemini enrichment (cache + quota + honesty rules), sync, export,
                         account deletion
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
