# Linguarium

**A free, language-agnostic learning platform.** Structured study, natural reading,
active practice and FSRS spaced repetition in one place — built around the idea that
all of it should share a single knowledge state for the learner, and that no language
(least of all small or constructed ones like Toki Pona) should be an afterthought.

> Working title. The name is a single constant in `src/main.mjs`'s companion files
> (`src/ui/layout.mjs`, `manifest.webmanifest`) if you ever want to change it.

Status: **Phase 1 (initial usable version) is implemented and tested.** Phases 2 and 3
are planned and architecturally prepared (see [docs/ROADMAP.md](docs/ROADMAP.md)).

---

## What is in the box (phase 1)

| Area | What works |
| --- | --- |
| **Accounts** | Fully custom authentication UI on Netlify Identity (login, signup with email confirmation, password recovery incl. reset flow, optional OAuth) — the default widget is never loaded. |
| **Languages** | ~58 language presets with per-language tokenizer behaviour, plus **custom language definitions** (name, code, direction, tokenizer) so any language works, including constructed ones. |
| **Profiles** | Per-language profile with difficulty mode (Comfortable / Stretch / Challenge) and gloss language — definitions are never assumed to be in English. |
| **Vocabulary** | Personal entries with provenance, readings, examples and your own notes; one shared knowledge state for reading, review and collections. |
| **Collections** | Create and import word lists from CSV / JSON / plain text. **Unparsed entries are retained, not discarded**, shown for repair. Export to CSV/JSON any time. |
| **FSRS review** | FSRS-5 spaced repetition with **three separate ability dimensions** (recognition, recall, production — production is typed, not multiple-choice). |
| **Reading** | Interactive reader: click any word (per-character for languages without spaces), keep it, self-assess prior knowledge honestly, see per-reader difficulty estimates with a transparent breakdown. |
| **Knowledge** | Vocabulary lookup with everything known about a term: entry, memory state per dimension, verified etymology when sourced, AI analysis clearly labelled separately, your notes. |
| **Grammar** | Structures as first-class citizens with a four-layer progression (encountered → recognized → understood → independent use). |
| **Progress** | Dashboard aggregates: due counts, streaks, knowledge-state distribution (reflecting real performance, never "opened a card"). |
| **Offline / PWA** | Installable, offline reading/review/lookup via IndexedDB + service worker, change queue with conflict-safe sync (learning progress is never silently overwritten), portable JSON backup export. |
| **AI (optional)** | Vocabulary enrichment via **Gemini `gemini-3.1-flash-lite`** — structured output, cached per term, daily per-user quota. Without `GEMINI_API_KEY` every core feature still works; AI sections show as explicitly disabled. |

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
3. Initialize the schema and seed data (either way):
   - locally: `cp .env.example .env`, fill `DATABASE_URL`, then `npm run db:init`;
   - or open the Neon SQL editor and paste the contents of `sql/schema.sql` followed by `sql/seed.sql`.

### 3. Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub** → pick the repository.
2. Build settings (auto-filled from `netlify.toml`, verify anyway):
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables (Site configuration → Environment variables):
   - `DATABASE_URL` — the Neon pooled connection string (**required**)
   - `GEMINI_API_KEY` — optional; without it AI features are disabled but everything else works
   - `GEMINI_DAILY_LIMIT` — optional per-user daily enrichment quota (default 300)
4. Deploy.

### 4. Enable Netlify Identity

1. Site configuration → **Identity** → Enable.
2. Under Registration: allow open signups (or invite-only, your choice).
3. Recommendation: keep **email confirmation** on (the app handles both flows).
4. Optional: add OAuth providers (Google, GitHub, …). The custom login screen picks them up automatically.

That's it — visit your site, create an account, add a language, import a word list,
read something, review. The seeded shared library (public-domain classics + demo content)
appears once `sql/seed.sql` has run.

## Local development

```bash
npm install                # esbuild, netlify-cli, @netlify/identity, @neondatabase/serverless
cp .env.example .env       # fill DATABASE_URL (local or Neon); GEMINI_API_KEY optional
npm run db:init            # create schema + seed
npm run dev                # netlify dev: dist served locally + functions + local Identity
```

`netlify dev` provides the local Identity endpoint that `@netlify/identity` expects
(sign-up, login and email flows work locally). For a quick static preview without
functions, `npm run dev:ui` builds and serves `dist` on port 3000.

## Testing and checks

```bash
npm test     # 60 unit tests: FSRS-5 identities and behaviour, tokenizer, parsers,
             # status thresholds, difficulty bands, offline merge rules
npm run check # node --check over every source and function file
npm run build # esbuild bundle into dist/
```

## Project layout

```
├── index.html, manifest.webmanifest, sw.js    PWA shell (sw stamped per build)
├── netlify.toml                               build & functions configuration
├── sql/schema.sql, sql/seed.sql               Neon schema (knowledge + user_data) and seeds
├── scripts/                                   build, serve, db-init, syntax check
├── src/
│   ├── shared/         pure learning logic: FSRS-5, tokenizer, status model,
│   │                   difficulty estimation, import parsers, merge rules (all tested)
│   ├── core/           auth (@netlify/identity), api client, store, router,
│   │                   IndexedDB cache + offline queue, sync, data loaders
│   ├── ui/             design system, components, app shell
│   └── views/          dashboard, discover, reading, reader, review, practice (p2),
│                       listening (p2), knowledge, grammar, collections, settings, auth
└── netlify/functions/  v2 functions: identity guard, db access, all /api/* endpoints,
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
