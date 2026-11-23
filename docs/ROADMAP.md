# Roadmap

Phase 1 and phase 2 are implemented. This is the plan for phase 3,
carried over from the platform specification. Where phase 1/2 laid groundwork,
the groundwork is named.

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

## Phase 3 — content pipeline and personalization

**Automatic adaptation of texts you choose.** Simplification at a target difficulty
band for *your* knowledge state — always stored as *adapted* content with the
original work's metadata intact, per the content policy (docs/CONTENT.md).

**Finer personalization.** Per-dimension target retention, FSRS parameter
optimization from your own review history (the log is already append-only and
exported), scheduling preferences per language profile.

**Community content pipeline.** The `knowledge` schema is already user-data-free by
construction; phase 3 opens moderated community contribution of texts, grammar
structures and shared lexicon entries — with mandatory provenance and license fields,
the same rules the seed data follows.

**Extended language resources.** Frequency lists, pronunciation references and
learner corpora per language, all with license metadata, prioritizing under-resourced
languages — the reason the whole language model is data, not code.
