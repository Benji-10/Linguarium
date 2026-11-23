# Roadmap

All three phases of the platform specification are implemented and tested.
This file records what shipped and the honest edges that remain.

## Phase 2 — deeper practice and content (SHIPPED)

**Grammar explanations and practice.** Structures, provenance and the four-layer
progression (encountered → recognized → understood → independent use) with
generated cloze/recall exercises from each structure's own example sentences
(`#/grammar` → "Practise this structure"). A correct exercise advances the
structure's stage; progress saves offline through the sync queue like everything
else. Korean and Chinese structure sets are seeded.

**Listening environment.** `#/listening` lists material for the active language
and opens it in the reader with playback started. Texts without recordings are
read aloud by the browser's speech system — labelled for what it is: synthesized,
not a native recording, with honest voice-availability reporting. Audio items
you add reference their https URL with mandatory source and license metadata and
are never stored as binary blobs. Transcripts are interactive: term click-through
during listening records encounters exactly like reading.

**Writing practice.** `#/practice` builds prompts from the vocabulary you are
actually learning and the grammar structures in progress; free-text answers get
an honest self-assessment that feeds the production dimension of FSRS through the
same review pipeline, and grammar stage progression when a structure was used.
Optional AI feedback (Gemini, `gemini-3.1-flash-lite`) is offered when configured,
labelled unverified everywhere.

**Improved content discovery.** Topic-tagged filtering (`shared_texts.topic`,
chips on `#/discover`) over a much larger seeded library — including six Korean
texts (previously Korean had none), Chinese, Greek and more public-domain
classics, all with the usual provenance labels. The difficulty hooks for
frequency ranks remain ready for real frequency data.

**Offline caching and sync hardening.** Background Sync registration wherever the
browser supports it (service worker wakes the app to flush the queue), the same
tested conflict rules, and an import path for the backup format
(Settings → Import backup; merge semantics in docs/DATABASE.md and
netlify/functions/import.mjs).

## Phase 3 — content pipeline and personalization (SHIPPED)

**Automatic adaptation of texts you choose.** The reader's "Adapt" button
re-levels the current text toward a target difficulty band computed against
*your* knowledge state (the known/unknown term lists of that very text go into
the prompt). The result is stored as **adapted content**: a new user text with
provenance `ai`, the original work's author/source/license intact, and an
adaptation note naming the model, the band and what changed (`POST /api/adapt`;
docs/AI.md). Gemini `gemini-3.1-flash-lite`, quota'd, no cache (it is personal),
12k-character cap with an honest 413 instead of silent truncation.

**Finer personalization.** Three things, all labelled and reversible
(Settings → Personalization):

- *Per-dimension target retention* (0.70–0.97 per ability dimension per language
  profile) — the FSRS interval is chosen so predicted recall stays above your
  number; the review session reports which retention is in effect.
- *Daily caps per language profile* (new cards and reviews per day, optional) —
  enforced server-side in the queue and **reported** in the session, never applied
  silently.
- *FSRS parameter fitting from your own review history*: `POST /api/fsrs-optimize`
  refits the 19 FSRS-5 weights with a deterministic hill climb over the
  recall-likelihood of your own review log (`netlify/functions/lib/fsrs-opt.mjs`,
  unit-tested). It refuses to run under 300 scored intervals, refuses to return a
  worse fit than the defaults, and the client applies fitted weights only when
  you choose to (localStorage + backup export included; revert any time).

**Community content pipeline.** `#/contribute`: texts, grammar structures and
lexicon entries submitted with mandatory license + source validation
(`lib/contribute-validate.mjs`, tested), rate-limited, queued in
`knowledge.contribution_queue`, and moderated via `PUT /api/contribute`
(admin `x-admin-key`, constant-time compare, same guard as admin-seed). Approved
items enter the shared tables with provenance `community` — never `verified`.
The shared community lexicon is consulted by the Knowledge lookup
(`GET /api/lexicon`), always rendered separately from your own entries.

**Extended language resources.** `knowledge.resources`: a curated catalog of
open frequency lists, pronunciation references, learner corpora and dictionaries
per language — seeded for every preset language (Wiktionary category, Wikipedia
edition, Tatoeba sentences where they exist) plus hand-curated entries
(Wiktionary frequency lists, CMUdict, JMdict, CC-CEDICT, The Latin Library,
Tekstaro, tokipona.org, FrequencyWords), every row with license metadata and a
"verify at the source" note. Shown on Discover for the active language. The data
itself is never copied in — links only (docs/CONTENT.md).

**Themes and branding polish.** A proper theme system: light / dark / system
mode (topbar quick toggle) times six accent skins (teal, ocean, forest, rose,
amber, violet) — every skin legible in both modes, PWA `theme-color` kept in sync
(`src/core/theme.mjs`). A real icon: open book + speech bubble mark, SVG +
192/512/maskable/apple-touch PNGs (`icons/`, rendered by
`scripts/render-icons.py`). The injected Netlify badge iframe
(`#nl-badge-frame`) is hidden defensively (CSS + runtime removal) and can also
be disabled in the Netlify UI.

## Honest edges (what is deliberately NOT claimed)

- Frequency data for familiarity estimates is still *cataloged, not ingested* —
  difficulty estimation remains based on your known-word set until you import a
  frequency list into the shared tables yourself.
- The FSRS fit is a curve fit to your history (log-loss on recall outcomes), not
  the full research optimizer (no stability-consistency term); it says so in the
  UI and stores its losses for inspection.
- Adaptation quality depends on the model; the UI always offers the original
  next to the adapted copy, and the adaptation note says exactly what was done.
