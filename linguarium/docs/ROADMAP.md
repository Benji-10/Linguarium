# Roadmap

Phase 1 (the initial usable version) is implemented. This is the plan for phases 2 and 3,
carried over from the platform specification. Where phase 1 already laid groundwork,
the groundwork is named.

## Phase 2 — deeper practice and content

**Grammar explanations and practice.** The structures, provenance and four-layer
progression (encountered → recognized → understood → independent use) already exist
(`/api/grammar`, `#/grammar`). Next: generated cloze/transform exercises from the
structures *and from the vocabulary you are actually learning*, feeding the
production dimension of FSRS.

**Listening environment.** Audio referenced by URL with source and license metadata —
never stored as binary blobs in the database. Transcripts open in the same interactive
reader so one knowledge state serves listening and reading; term click-through during
listening records encounters exactly like reading. The `#/listening` screen documents
this honestly today.

**Writing practice.** Prompts built from your current vocabulary and grammar states;
free-text answers with self-assessment feeding production FSRS memory; optional AI
feedback, labelled as unverified. `#/practice` documents this today, and typed
production review already works in `#/review?dimension=production`.

**Improved content discovery.** The scoring hooks already accept frequency ranks and
subject familiarity (`src/shared/difficulty.mjs`); phase 2 adds the shared lexicon
data, per-language frequency lists with licenses, and topic-tagged filtering.

**Offline caching and sync hardening.** The queue and conflict rules exist and are
tested; phase 2 adds background sync where supported, richer conflict surfacing and
an import path for the backup format.

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
